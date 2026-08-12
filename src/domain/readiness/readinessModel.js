import { evaluateRecommendationSafety } from '../recommendation/safetyEngine'
import { getReadinessDeductions, READINESS_MODEL_VERSION, statusFromReadiness } from './readinessRules'

const requiredInputs = ['energy', 'fatigue', 'soreness', 'sleep', 'sleepQuality', 'stress', 'illnessSymptoms', 'pain']

export function calculateReadiness({
  currentState = {},
  recentLoad = {},
  eventDemand = {},
  safetyModifiers = {},
  personalBaseline = {},
} = {}) {
  const safety = evaluateRecommendationSafety({ ...currentState, ...safetyModifiers })
  const deductions = getReadinessDeductions(currentState, recentLoad)
  const score = Math.max(0, Math.min(100, Math.round(100 - deductions.reduce((sum, item) => sum + item.deduction, 0))))
  const answered = requiredInputs.filter((key) => currentState[key] !== undefined && currentState[key] !== null && currentState[key] !== '')
  const missing = requiredInputs.filter((key) => !answered.includes(key))
  const sampleSize = Number(personalBaseline.sampleSize) || 0
  const dataQuality = {
    level: missing.length > 3 ? 'low' : missing.length || sampleSize < 7 ? 'medium' : 'high',
    reasons: [
      ...(missing.length ? [`Missing: ${missing.join(', ')}`] : []),
      ...(sampleSize < 7 ? ['Limited personal baseline'] : []),
    ],
    sampleSize: sampleSize || null,
    freshnessMinutes: Number.isFinite(Number(currentState.freshnessMinutes)) ? Number(currentState.freshnessMinutes) : null,
  }

  const highestPain = Math.max(0, Number(currentState.pain) || 0, ...Object.values(currentState.painMap ?? {}).map(Number))
  const status = statusFromReadiness({ score, safetyStatus: safety.status })

  return {
    currentState,
    recentLoad,
    eventDemand,
    safetyModifiers,
    personalBaseline,
    dataQuality,
    deductions,
    score,
    status: status === 'ready' && highestPain > 0 ? 'adjust' : status,
    safety,
    version: READINESS_MODEL_VERSION,
  }
}
