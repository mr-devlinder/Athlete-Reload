import { estimateExerciseSeconds, getCatalogExercises, RECOVERY_EXERCISES, RECOVERY_ROUTINE_IDS, resolveVettedExerciseSelections } from './exerciseCatalog'

const PHASE_ORDER = ['mobility', 'activation', 'flexibility', 'finish']

export function buildVettedRoutine({
  selections = [],
  mode = 'session',
  availableMinutes = 15,
  availableEquipment = [],
  excludedIds = [],
  painExclusions = [],
  targetBodyParts = [],
  variationSeed = 0,
} = {}) {
  const excluded = new Set(excludedIds)
  const equipment = new Set(availableEquipment.map(normalizeEquipment))
  const pain = new Set(painExclusions.map((item) => String(item).toLowerCase()))
  const targets = targetBodyParts.map((item) => String(item).toLowerCase())
  const safeAndEquipped = (exercise) => !excluded.has(exercise.id)
    && exercise.equipment.every((item) => isBasicEquipment(item) || equipment.has(normalizeEquipment(item)))
    && !exercise.painExclusions.some((item) => pain.has(String(item).toLowerCase()))
  const eligible = (exercise) => safeAndEquipped(exercise)
    && (!targets.length || [...exercise.targetBodyParts, exercise.category].some((item) => targets.some((target) => String(item).toLowerCase().includes(target) || target.includes(String(item).toLowerCase()))))

  const selected = resolveVettedExerciseSelections(selections).filter(safeAndEquipped)
  const fallbackIds = RECOVERY_ROUTINE_IDS[mode] ?? RECOVERY_ROUTINE_IDS.general
  const fallback = rotate(getCatalogExercises(fallbackIds).filter(eligible), variationSeed)
  const candidates = uniqueById(fallback).sort((first, second) => phaseIndex(first, mode) - phaseIndex(second, mode))
  const targetSeconds = Math.max(5, Math.min(30, Number(availableMinutes) || 15)) * 60
  const canonicalSteps = selected.length ? fitAiSequenceToBudget(selected, targetSeconds) : selectCoherentSteps(candidates, targetSeconds, mode)
  const exercises = canonicalSteps.flatMap(expandLaterality).map((exercise, sequenceIndex) => ({ ...exercise, instanceId: `${exercise.id}-${sequenceIndex + 1}` }))
  const estimatedSeconds = exercises.reduce((sum, exercise) => sum + estimateExerciseSeconds(exercise), 0)

  return {
    exercises,
    estimatedSeconds,
    targetSeconds,
    equipment: [...new Set(canonicalSteps.flatMap((item) => item.equipment))],
    phases: [...new Set(canonicalSteps.map((item) => getPhase(item, mode)))],
  }
}

function fitAiSequenceToBudget(sequence, targetSeconds) {
  const steps = []
  let usedSeconds = 0
  for (const exercise of sequence) {
    const seconds = expandedSeconds(exercise)
    if (steps.length && usedSeconds + seconds > targetSeconds) continue
    if (!steps.length && seconds > targetSeconds) return [exercise]
    steps.push(exercise)
    usedSeconds += seconds
  }
  return steps.length ? steps : sequence.slice(0, 1)
}

function selectCoherentSteps(candidates, targetSeconds, mode) {
  const steps = []
  const categoryCounts = new Map()
  const phaseMinimums = getPhaseMinimums(mode)
  let usedSeconds = 0

  for (const phase of phaseMinimums) {
    const option = candidates.find((item) => !steps.some((step) => step.id === item.id) && getPhase(item, mode) === phase && fitsCategory(item, categoryCounts))
    if (!option) continue
    const seconds = expandedSeconds(option)
    if (usedSeconds + seconds <= targetSeconds) {
      steps.push(option)
      usedSeconds += seconds
      categoryCounts.set(option.category, (categoryCounts.get(option.category) ?? 0) + 1)
    }
  }

  for (const option of candidates) {
    if (steps.some((item) => item.id === option.id) || !fitsCategory(option, categoryCounts)) continue
    const seconds = expandedSeconds(option)
    if (usedSeconds + seconds > targetSeconds) continue
    steps.push(option)
    usedSeconds += seconds
    categoryCounts.set(option.category, (categoryCounts.get(option.category) ?? 0) + 1)
    if (targetSeconds - usedSeconds < 35) break
  }

  return steps.length ? steps : candidates.slice(0, 1)
}

function expandLaterality(exercise) {
  if (exercise.laterality !== 'each-side' || /left|right/i.test(exercise.side ?? '')) return [exercise]
  return ['Left side', 'Right side'].map((side) => ({ ...exercise, side, laterality: side.startsWith('Left') ? 'left' : 'right' }))
}

function expandedSeconds(exercise) {
  if (exercise.laterality !== 'each-side') return estimateExerciseSeconds(exercise)
  return 2 * estimateExerciseSeconds({ ...exercise, laterality: 'left' })
}

function getPhase(exercise, mode) {
  if (exercise.movementType === 'breathing') return mode === 'pre-event' ? 'finish' : 'downshift'
  if (exercise.movementType === 'active-recovery') return 'active-recovery'
  if (exercise.movementType === 'flexibility' || exercise.movementType === 'self-massage') return 'flexibility'
  if (['activation', 'control', 'isometric'].includes(exercise.movementType)) return 'activation'
  return 'mobility'
}

function getPhaseMinimums(mode) {
  if (mode === 'pre-event') return ['mobility', 'activation']
  if (mode === 'flexibility') return ['flexibility']
  if (mode === 'quick') return ['mobility', 'activation']
  if (mode === 'recovery-day') return ['mobility', 'activation', 'flexibility']
  return ['mobility', 'activation', 'flexibility']
}

function phaseIndex(exercise, mode) { return PHASE_ORDER.indexOf(getPhase(exercise, mode)) }
function fitsCategory(exercise, counts) { return (counts.get(exercise.category) ?? 0) < 2 }
function uniqueById(items) { return items.filter((item, index) => items.findIndex((candidate) => candidate.id === item.id) === index) }
function rotate(items, seed) { const offset = items.length ? Math.abs(Number(seed) || 0) % items.length : 0; return [...items.slice(offset), ...items.slice(0, offset)] }
function normalizeEquipment(value) { return String(value).toLowerCase().replace(/exercise /g, '').trim() }
function isBasicEquipment(value) { return ['wall', 'doorway', 'stable support', 'chair or bench'].includes(normalizeEquipment(value)) }

export function getVettedSubstitute(exercise, excludedIds = []) {
  const excluded = new Set(excludedIds)
  const explicit = (exercise?.substitutions ?? []).map((id) => RECOVERY_EXERCISES[id]).find((item) => item && !excluded.has(item.id))
  if (explicit) return explicit
  return Object.values(RECOVERY_EXERCISES).find((item) => item.id !== exercise?.id && item.category === exercise?.category && !excluded.has(item.id)) ?? null
}
