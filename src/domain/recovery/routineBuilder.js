import {
  estimateExerciseSeconds,
  getCatalogExercises,
  getMovementById,
  MOBILITY_MOVEMENTS,
  MOBILITY_ROUTINE_TYPES,
  resolveVettedExerciseSelections,
} from './exerciseCatalog'

const TYPE_ALIASES = {
  session: 'session_recovery',
  competition: 'session_recovery',
  quick: 'full_body',
  'full-body': 'full_body',
  targeted: 'custom_mobility',
  'recovery-day': 'light_recovery',
  'pre-event': 'warm_up',
  mobility: 'full_body',
}

const LOWER_REGIONS = new Set(['hips', 'hip', 'hamstrings', 'hamstring', 'quadriceps', 'thigh', 'knee', 'knees', 'ankles', 'ankle', 'calves', 'calf', 'feet', 'foot', 'glutes', 'groin', 'adductors', 'balance'])
const UPPER_REGIONS = new Set(['shoulders', 'shoulder', 'scapular_region', 'thoracic_spine', 'upper_back', 'neck', 'wrists', 'wrist', 'forearms', 'forearm'])

export function normalizeRoutineType(value) {
  const type = TYPE_ALIASES[String(value ?? '').toLowerCase()] ?? String(value ?? '').toLowerCase()
  return MOBILITY_ROUTINE_TYPES.includes(type) ? type : 'full_body'
}

export function normalizeEquipmentList(values = []) {
  return [...new Set(values.map((value) => {
    const normalized = String(value ?? '').toLowerCase().replaceAll('-', '_').replace(/\s+/g, '_')
    if (/band/.test(normalized)) return 'resistance_band'
    if (/chair|bench/.test(normalized)) return 'bench_or_chair'
    if (/foam_roller/.test(normalized)) return 'foam_roller'
    if (/massage_ball/.test(normalized)) return 'massage_ball'
    return normalized
  }).filter((value) => value && !['nothing', 'none', 'mat', 'exercise_mat', 'wall', 'floor', 'doorway', 'stable_support'].includes(value)))]
}

export function normalizePainRegions(values = []) {
  const list = Array.isArray(values) ? values : Object.keys(values ?? {})
  return [...new Set(list.flatMap((value) => String(value ?? '').toLowerCase().replaceAll('-', '_').split(/[^a-z]+/)).filter(Boolean))]
}

export function replaySavedMobilityRoutine(savedRecord) {
  const routine = savedRecord?.routine?.routine ?? savedRecord?.routine ?? savedRecord?.plan?.routine ?? (savedRecord?.exercises ? savedRecord : null)
  return routine ? structuredClone(routine) : null
}

export function expandUnilateralMovement(movement) {
  if (!movement?.unilateral || /^(left|right)$/i.test(String(movement.side ?? ''))) return movement ? [movement] : []
  return ['Left', 'Right'].map((side) => ({ ...movement, side, unilateral: false, pairedMovementId: movement.id }))
}

export function filterMovementCatalog({ routineType = 'full_body', equipmentAvailable = [], painSensitiveRegions = [], targetBodyParts = [] } = {}) {
  const type = normalizeRoutineType(routineType)
  const equipment = new Set(normalizeEquipmentList(equipmentAvailable))
  const pain = new Set(normalizePainRegions(painSensitiveRegions))
  const targets = normalizePainRegions(targetBodyParts)

  return MOBILITY_MOVEMENTS.filter((movement) => {
    if (!movement.routineTypes.includes(type)) return false
    if (!movement.equipment.every((item) => equipment.has(item))) return false
    if (movement.painSensitiveRegions.some((region) => pain.has(region))) return false
    if (targets.length && !movementMatchesTargets(movement, targets)) return false
    if (type === 'warm_up' && movement.prescriptionType === 'time' && movement.defaults.durationSeconds > 30) return false
    return true
  })
}

export function estimateRoutineSeconds(exercises = []) {
  return exercises.reduce((total, exercise, index) => total + estimateExerciseSeconds(exercise, index === exercises.length - 1 ? 0 : 10), 0)
}

export function validateGeneratedRoutine({
  routine,
  routineType = 'full_body',
  requestedDurationSeconds = 600,
  equipmentAvailable = [],
  painSensitiveRegions = [],
  targetBodyParts = [],
  durationTolerance = 0.1,
} = {}) {
  const type = normalizeRoutineType(routineType)
  const eligible = filterMovementCatalog({ routineType: type, equipmentAvailable, painSensitiveRegions, targetBodyParts })
  const eligibleIds = new Set(eligible.map((movement) => movement.id))
  const supplied = Array.isArray(routine?.exercises) ? routine.exercises : []
  const errors = []
  const seen = new Set()
  const resolved = []

  for (const selection of supplied) {
    const id = String(selection?.movementId ?? selection?.id ?? '')
    const catalogMovement = getMovementById(id)
    if (!catalogMovement) { errors.push(`unknown_movement:${id || 'missing'}`); continue }
    if (seen.has(id)) { errors.push(`duplicate_movement:${id}`); continue }
    if (!catalogMovement.routineTypes.includes(type)) { errors.push(`unsupported_routine_type:${id}`); continue }
    if (!eligibleIds.has(id)) {
      const available = new Set(normalizeEquipmentList(equipmentAvailable))
      if (!catalogMovement.equipment.every((item) => available.has(item))) errors.push(`equipment_unavailable:${id}`)
      else errors.push(`pain_or_target_excluded:${id}`)
      continue
    }
    const [movement] = resolveVettedExerciseSelections([selection])
    if (!movement) { errors.push(`invalid_prescription:${id}`); continue }
    const generatedInstruction = normalizeHowToPerform(selection?.howToPerform ?? selection?.instructions)
    if (generatedInstruction) {
      movement.instructions = generatedInstruction
      movement.instruction = generatedInstruction
      movement.steps = [generatedInstruction]
    }
    seen.add(id)
    resolved.push(movement)
  }

  if (supplied.length === 0) errors.push('empty_routine')
  if (type === 'warm_up') {
    const longStaticCount = resolved.filter((movement) => movement.prescriptionType === 'time' && movement.prescription.durationSeconds >= 30).length
    if (longStaticCount > Math.floor(resolved.length / 3)) errors.push('warm_up_too_static')
  }
  if (type !== 'warm_up' && resolved.length > 1) {
    const minimumHolds = Math.min(2, Math.max(1, Math.floor(resolved.length / 4)))
    if (resolved.filter((movement) => movement.prescriptionType === 'time').length < minimumHolds) errors.push('static_recovery_missing')
  }
  if (type === 'lower_body' && resolved.length && resolved.filter(isLowerBodyMovement).length / resolved.length < 0.65) errors.push('lower_body_focus_missing')
  if (type === 'upper_body' && resolved.length && resolved.filter(isUpperBodyMovement).length / resolved.length < 0.65) errors.push('upper_body_focus_missing')

  const ordered = orderCoherentRoutine(resolved, type)
  const estimatedDurationSeconds = estimateRoutineSeconds(ordered)
  const target = Math.max(300, Math.min(1_800, Number(requestedDurationSeconds) || 600))
  if (estimatedDurationSeconds < target * (1 - durationTolerance) || estimatedDurationSeconds > target * (1 + durationTolerance)) errors.push('duration_out_of_range')

  return {
    errors,
    valid: errors.length === 0,
    routine: {
      routineName: String(routine?.routineName ?? routine?.title ?? formatRoutineName(type, target)),
      title: String(routine?.routineName ?? routine?.title ?? formatRoutineName(type, target)),
      goal: String(routine?.goal ?? formatRoutineGoal(type)),
      routineType: type,
      estimatedDurationSeconds,
      exercises: ordered,
    },
  }
}

export function createValidatedMobilityRoutine(options = {}) {
  const requestedDurationSeconds = Math.max(300, Math.min(1_800, Number(options.requestedDurationSeconds ?? options.availableMinutes * 60) || 600))
  const validation = validateGeneratedRoutine({ ...options, requestedDurationSeconds })
  if (validation.valid) return { ...validation, usedFallback: false }
  const fallback = buildDeterministicMobilityRoutine({ ...options, requestedDurationSeconds })
  return { errors: validation.errors, valid: true, routine: fallback, usedFallback: true }
}

export function buildDeterministicMobilityRoutine({
  routineType = 'full_body',
  requestedDurationSeconds = 600,
  availableMinutes,
  equipmentAvailable = [],
  painSensitiveRegions = [],
  targetBodyParts = [],
  excludedIds = [],
  previousMovementIds = [],
} = {}) {
  const type = normalizeRoutineType(routineType)
  const target = Math.max(300, Math.min(1_800, Number(requestedDurationSeconds ?? availableMinutes * 60) || 600))
  const excluded = new Set([...excludedIds, ...previousMovementIds.slice(0, 4)])
  const candidates = filterMovementCatalog({ routineType: type, equipmentAvailable, painSensitiveRegions, targetBodyParts })
    .filter((movement) => !excluded.has(movement.id))
    .sort((first, second) => movementScore(second, type) - movementScore(first, type))
  const chosen = []
  const categoryCounts = new Map()

  for (const candidate of candidates) {
    if ((categoryCounts.get(candidate.category) ?? 0) >= 2) continue
    const proposed = orderCoherentRoutine([...chosen, cloneForRoutine(candidate)], type)
    if (estimateRoutineSeconds(proposed) > target * 1.08) continue
    chosen.push(cloneForRoutine(candidate))
    categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1)
    if (estimateRoutineSeconds(chosen) >= target * .94) break
  }

  const balanced = ensureRecoveryHolds(chosen, candidates, type)
  const fitted = fitRoutineDuration(orderCoherentRoutine(balanced, type), target)
  return {
    routineName: formatRoutineName(type, target),
    title: formatRoutineName(type, target),
    goal: formatRoutineGoal(type),
    routineType: type,
    estimatedDurationSeconds: estimateRoutineSeconds(fitted),
    exercises: fitted,
  }
}

// Compatibility wrapper for older callers; all selection still flows through the canonical catalog.
export function buildVettedRoutine({ selections = [], mode = 'full_body', availableMinutes = 10, availableEquipment = [], excludedIds = [], painExclusions = [], targetBodyParts = [] } = {}) {
  const type = normalizeRoutineType(mode)
  const result = createValidatedMobilityRoutine({
    routine: { exercises: selections },
    routineType: type,
    requestedDurationSeconds: availableMinutes * 60,
    equipmentAvailable: availableEquipment,
    painSensitiveRegions: painExclusions,
    targetBodyParts,
    excludedIds,
  }).routine
  return { exercises: result.exercises, estimatedSeconds: result.estimatedDurationSeconds, targetSeconds: availableMinutes * 60, equipment: [...new Set(result.exercises.flatMap((movement) => movement.equipment))] }
}

export function getVettedSubstitute(exercise, excludedIds = [], options = {}) {
  if (!exercise) return null
  const excluded = new Set([exercise.id, ...excludedIds])
  return filterMovementCatalog({ routineType: options.routineType ?? exercise.routineTypes?.[0], equipmentAvailable: options.equipmentAvailable ?? exercise.equipment })
    .find((movement) => !excluded.has(movement.id) && movement.bodyRegions.some((region) => exercise.bodyRegions?.includes(region))) ?? null
}

function fitRoutineDuration(exercises, target) {
  if (!exercises.length) return []
  const fitted = exercises.map(cloneForRoutine)
  let estimate = estimateRoutineSeconds(fitted)
  if (estimate >= target * .9) return fitted
  for (let index = fitted.length - 1; index >= 0 && estimate < target * .9; index -= 1) {
    const movement = fitted[index]
    const sides = movement.unilateral ? 2 : 1
    if (movement.prescriptionType === 'time') {
      const addPerSide = Math.min(90 - movement.prescription.durationSeconds, Math.ceil((target - estimate) / sides))
      if (addPerSide > 0) movement.prescription.durationSeconds += addPerSide
    } else {
      const addReps = Math.min(20 - movement.prescription.reps, Math.ceil((target - estimate) / (sides * movement.defaults.secondsPerRep)))
      if (addReps > 0) movement.prescription.reps += addReps
    }
    movement.dose = movement.prescriptionType === 'time'
      ? { model: 'timer', durationSeconds: movement.prescription.durationSeconds, sets: 1, restSeconds: 0 }
      : { model: 'reps', reps: movement.prescription.reps, sets: 1, restSeconds: 0, tempoSecondsPerRep: movement.defaults.secondsPerRep }
    movement.durationSeconds = movement.prescription.durationSeconds ?? 0
    movement.reps = movement.prescription.reps ?? 0
    estimate = estimateRoutineSeconds(fitted)
  }
  return fitted
}

function orderCoherentRoutine(exercises, type) {
  const positionRank = type === 'warm_up'
    ? { standing: 0, kneeling: 1, quadruped: 2, seated: 3, prone: 4, lying: 4 }
    : { standing: 0, kneeling: 1, quadruped: 2, prone: 3, lying: 3, seated: 4 }
  return [...exercises].sort((first, second) => {
    const phaseDifference = phaseRank(first, type) - phaseRank(second, type)
    return phaseDifference || (positionRank[first.position] ?? 2) - (positionRank[second.position] ?? 2)
  })
}

function phaseRank(movement, type) {
  if (type === 'warm_up') return movement.categories.includes('mobility') ? 0 : movement.categories.includes('activation') ? 1 : movement.categories.includes('warm_up') ? 2 : 3
  return movement.categories.includes('mobility') ? 0 : movement.categories.includes('activation') || movement.categories.includes('balance') ? 1 : movement.categories.includes('flexibility') ? 2 : 3
}

function movementScore(movement, type) {
  let score = 0
  if (type === 'full_body' && movement.bodyRegions.includes('full_body')) score += 5
  if (type === 'lower_body' && isLowerBodyMovement(movement)) score += 5
  if (type === 'upper_body' && isUpperBodyMovement(movement)) score += 5
  if (type === 'flexibility' && movement.categories.includes('flexibility')) score += 6
  if (type === 'warm_up' && movement.categories.includes('warm_up')) score += 6
  if (type === 'light_recovery' && movement.difficulty === 'beginner') score += 4
  if (type === 'session_recovery' && movement.routineTypes.includes('session_recovery')) score += 4
  if (type !== 'warm_up' && movement.prescriptionType === 'time') score += 4
  score += Math.max(0, 3 - phaseRank(movement, type))
  return score
}

function ensureRecoveryHolds(exercises, candidates, type) {
  if (type === 'warm_up' || exercises.length < 2) return exercises
  const result = [...exercises]
  const required = Math.min(2, Math.max(1, Math.floor(result.length / 4)))
  const usedIds = new Set(result.map((movement) => movement.id))
  const holds = candidates.filter((movement) => movement.prescriptionType === 'time' && !usedIds.has(movement.id))

  while (result.filter((movement) => movement.prescriptionType === 'time').length < required && holds.length) {
    const replacementIndex = result.findLastIndex((movement) => movement.prescriptionType !== 'time')
    if (replacementIndex < 0) break
    const hold = holds.shift()
    usedIds.delete(result[replacementIndex].id)
    result[replacementIndex] = cloneForRoutine(hold)
    usedIds.add(hold.id)
  }
  return result
}

function movementMatchesTargets(movement, targets) {
  const haystack = [...movement.bodyRegions, ...movement.targetAreas, ...movement.painSensitiveRegions].flatMap((value) => String(value).toLowerCase().split(/[^a-z]+/))
  return targets.some((target) => haystack.some((value) => value === target || value.includes(target) || target.includes(value)))
}
function isLowerBodyMovement(movement) { return movement.bodyRegions.some((region) => LOWER_REGIONS.has(region)) || movement.targetAreas.some((region) => LOWER_REGIONS.has(region)) }
function isUpperBodyMovement(movement) { return movement.bodyRegions.some((region) => UPPER_REGIONS.has(region)) || movement.targetAreas.some((region) => UPPER_REGIONS.has(region)) }
function cloneForRoutine(movement) { return resolveVettedExerciseSelections([{ movementId: movement.id, prescription: movement.prescription ?? movement.defaults }])[0] ?? getCatalogExercises([movement.id])[0] }

function formatRoutineName(type, targetSeconds) {
  const labels = { session_recovery: 'Session Recovery', full_body: 'Full Body Mobility', lower_body: 'Lower Body Mobility', upper_body: 'Upper Body Mobility', flexibility: 'Flexibility', warm_up: 'Dynamic Warm-Up', light_recovery: 'Light Recovery', custom_mobility: 'Custom Mobility' }
  return `${Math.round(targetSeconds / 60)}-Minute ${labels[type] ?? 'Mobility'}`
}

function formatRoutineGoal(type) {
  const goals = {
    session_recovery: 'Reduce post-session stiffness with gentle movement for the areas used today.',
    full_body: 'Move comfortably through the ankles, hips, trunk, and shoulders.',
    lower_body: 'Improve comfortable ankle, hip, and lower-body range of motion.',
    upper_body: 'Improve comfortable upper-back, shoulder, and arm movement.',
    flexibility: 'Use controlled holds to maintain comfortable range without forcing end positions.',
    warm_up: 'Build from active mobility into coordinated, sport-ready movement without fatigue.',
    light_recovery: 'Use very low-demand movement to reduce stiffness without turning recovery into a workout.',
    custom_mobility: 'Build a focused mobility sequence around the selected body areas.',
  }
  return goals[type] ?? goals.full_body
}

function normalizeHowToPerform(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (text.length < 35) return ''
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(' ').slice(0, 420)
}
