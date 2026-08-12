export const RECOVERY_ENGINE_VERSION = 'recovery-2.0.0'

function text(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function textList(value, fallback) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  return text(value, fallback)
}

export function normalizeRecoveryExercise(exercise = {}) {
  const name = text(exercise.name, 'Gentle mobility')
  const type = text(exercise.type, 'Mobility')
  const isTimed = exercise.doseModel === 'timer' || exercise.dose?.model === 'timer' || Number(exercise.durationSeconds) > 0
  const setup = textList(exercise.setup, `Choose a stable position where you can perform ${name.toLowerCase()} without losing balance.`)
  const movement = text(exercise.movement, text(exercise.instruction, 'Move slowly through a comfortable range while keeping the rest of your body controlled.'))
  const completionCue = text(exercise.completionCue, isTimed ? 'Ease out under control when the timer ends.' : 'Return to the starting position under control to complete one repetition.')
  const side = text(exercise.side, 'Both sides')
  const purpose = text(exercise.purpose ?? exercise.why, 'Support comfortable movement for the selected recovery goal.')
  const stopConditions = textList(exercise.stopConditions ?? exercise.avoid, 'Stop for sharp or worsening pain, numbness, instability, dizziness, or changed movement.')

  return {
    ...exercise,
    name,
    type,
    side,
    setup,
    movement,
    completionCue,
    purpose,
    why: purpose,
    stopConditions,
    avoid: stopConditions,
    equipment: Array.isArray(exercise.equipment) ? (exercise.equipment.join(', ') || 'None') : text(exercise.equipment, 'None'),
    feel: text(exercise.feel, isTimed ? 'Mild, comfortable tension in the named area.' : 'Smooth, controlled movement without pinching.'),
    doseModel: isTimed ? 'timer' : 'reps',
    durationSeconds: isTimed ? Math.max(15, Math.min(90, Number(exercise.durationSeconds ?? exercise.dose?.durationSeconds) || 30)) : 0,
    reps: isTimed ? 0 : Math.max(1, Math.min(20, Number(exercise.reps ?? exercise.dose?.reps) || 6)),
    restSeconds: Math.max(0, Math.min(120, Number(exercise.restSeconds) || 0)),
    sets: Math.max(1, Math.min(4, Number(exercise.sets) || 1)),
    instruction: `${setup} ${movement} ${completionCue}`,
    engineVersion: RECOVERY_ENGINE_VERSION,
  }
}

function exerciseFamily(value = '') {
  return String(value).replace(/\s*[-–]\s*(left|right)$/i, '').trim().toLowerCase()
}

export function varyRoutineAgainstHistory(exercises = [], recentSequences = [], seed = '') {
  if (exercises.length < 3) return exercises
  const priorOpenings = new Set(recentSequences.filter(Array.isArray).map((sequence) => sequence.slice(0, 2).map(exerciseFamily).join('|')))
  const currentOpening = exercises.slice(0, 2).map((exercise) => exerciseFamily(exercise.name)).join('|')
  if (!priorOpenings.has(currentOpening)) return exercises
  const numericSeed = String(seed).split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const candidates = Array.from({ length: exercises.length - 1 }, (_, index) => index + 1)
  const offset = candidates.find((candidate) => {
    const pair = [exercises[candidate], exercises[(candidate + 1) % exercises.length]].map((exercise) => exerciseFamily(exercise.name)).join('|')
    return !priorOpenings.has(pair)
  }) ?? (1 + numericSeed % (exercises.length - 1))
  return [...exercises.slice(offset), ...exercises.slice(0, offset)]
}

export function selectRecoveryPlanType({ checkout, nextEventHours, completedRecoveryHours, painActive = false } = {}) {
  if (painActive || checkout?.newPain || checkout?.movementChanged || ['Slightly worse', 'Much worse'].includes(checkout?.painChange)) return 'soreness-management'
  if (Number(nextEventHours) <= 18) return 'next-event-preparation'
  if (Number(completedRecoveryHours) <= 4) return 'later-day'
  if (Number(checkout?.difficulty) >= 8 || Number(checkout?.postFatigue) >= 4) return 'immediate'
  return 'mobility'
}
