const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value)))

export const READINESS_MODEL_VERSION = 'readiness-3.0.0'

export function getReadinessDeductions(currentState = {}, recentLoad = {}) {
  const pain = Math.max(
    0,
    Number(currentState.pain) || 0,
    ...Object.values(currentState.painMap ?? {}).map((value) => Number(value) || 0),
  )

  return [
    ['energy', Math.max(0, 5 - Number(currentState.energy)) * 5],
    ['sleep', Math.max(0, 8 - Number(currentState.sleep)) * 6],
    ['sleep_quality', Math.max(0, 5 - Number(currentState.sleepQuality ?? 5)) * 4],
    ['fatigue', Math.max(0, Number(currentState.fatigue) - 1) * 5],
    ['soreness', Math.max(0, Number(currentState.soreness) - 1) * 5],
    ['stress', Math.max(0, Number(currentState.stress)) * 2.4],
    ['illness', Math.max(0, Number(currentState.illnessSymptoms)) * 4],
    ['pain', pain * 8],
    ['recent_load', clamp(Number(recentLoad.loadPenalty) || 0, 0, 24)],
    ['same_day_events', Math.max(0, Number(recentLoad.sameDayEventCount) - 1) * 4],
    ['baseline_deviation', clamp(Number(currentState.baselineDeviationPenalty) || 0, 0, 18)],
  ]
    .filter(([, deduction]) => Number.isFinite(deduction) && deduction > 0)
    .map(([id, deduction]) => ({ id, deduction: Math.round(deduction * 10) / 10 }))
}

export function statusFromReadiness({ score, safetyStatus }) {
  if (safetyStatus === 'stop_and_seek_help') return safetyStatus
  if (safetyStatus === 'limit' || score < 45) return 'limit'
  if (score < 80) return 'adjust'
  return 'ready'
}
