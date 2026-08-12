export const RECOMMENDATION_SCHEMA_VERSION = 3
export const RECOMMENDATION_ENGINE_VERSION = 'deterministic-3.0.0'

export const recommendationStatuses = ['ready', 'adjust', 'limit', 'stop_and_seek_help']

export function getRecommendationStatus({ label, redFlag = false, score = 0 } = {}) {
  if (redFlag || label === 'Stop and Check In') return 'stop_and_seek_help'
  if (score < 45) return 'limit'
  if (score < 80) return 'adjust'
  return 'ready'
}

export function getRecommendationConfidence({ answeredInputs = 0, baselineSampleSize = 0, expectedInputs = 8 } = {}) {
  const inputCoverage = Math.max(0, Math.min(1, answeredInputs / expectedInputs))
  const baselineCoverage = Math.max(0, Math.min(1, baselineSampleSize / 14))
  return Math.round((0.72 * inputCoverage + 0.28 * baselineCoverage) * 100) / 100
}

export function createStructuredRecommendation(recommendation = {}, context = {}) {
  const status = recommendation.status ?? getRecommendationStatus(recommendation)
  const reasons = (recommendation.reasons ?? []).map((reason, index) => (
    typeof reason === 'string'
      ? { id: `reason-${index + 1}`, label: reason, source: 'current_state' }
      : reason
  ))
  const actions = (recommendation.actions ?? recommendation.focus ?? []).map((action, index) => (
    typeof action === 'string'
      ? { id: `action-${index + 1}`, instruction: action, timing: 'today' }
      : action
  ))
  const warnings = (recommendation.warnings ?? recommendation.avoid ?? []).map((warning, index) => (
    typeof warning === 'string'
      ? { id: `warning-${index + 1}`, message: warning }
      : warning
  ))

  return {
    ...recommendation,
    schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    status,
    confidence: recommendation.confidence ?? getRecommendationConfidence(context),
    primaryAction: recommendation.primaryAction ?? {
      instruction: recommendation.action ?? recommendation.summary ?? 'Use the plan that best matches how you feel today.',
      timing: 'now',
    },
    reasons,
    actions,
    warnings,
    adjustments: recommendation.adjustments ?? [],
  }
}

export function mergeAiExplanation(deterministic, ai = {}) {
  if (!deterministic) return deterministic
  return {
    ...deterministic,
    summary: typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary.trim() : deterministic.summary,
    explanation: typeof ai.explanation === 'string' ? ai.explanation.trim() : '',
    // Safety, status, score, confidence, actions, and warnings always remain deterministic.
    status: deterministic.status,
    score: deterministic.score,
    confidence: deterministic.confidence,
    primaryAction: deterministic.primaryAction,
    actions: deterministic.actions,
    warnings: deterministic.warnings,
    adjustments: deterministic.adjustments,
  }
}

export function createQuickDeterministicRecommendation(transcript = '') {
  const text = String(transcript).toLowerCase()
  const stopPattern = /(?:chest pain|trouble breathing|cannot breathe|passed out|fainted|confusion|head injury|concussion|numb|tingling|cannot bear weight|can't bear weight|severe pain|deformity)/
  const limitPattern = /(?:sharp pain|worsening pain|limping|unstable|dizzy|vomit|swelling|movement changed)/
  const stop = stopPattern.test(text)
  const limit = !stop && limitPattern.test(text)
  const score = stop ? 20 : limit ? 45 : 70
  const label = stop ? 'Stop and Check In' : limit ? 'Limit and reassess' : 'More detail needed'
  const tone = stop ? 'danger' : limit ? 'warning' : 'caution'
  const action = stop
    ? 'Stop training and tell an adult, coach, athletic trainer, or qualified healthcare professional now.'
    : limit
      ? 'Avoid the movement that is worsening symptoms and complete the detailed check-in before deciding how to participate.'
      : 'Complete the detailed check-in before the event so the recommendation can use current sleep, fatigue, soreness, illness, and pain information.'

  return createStructuredRecommendation({
    action,
    label,
    tone,
    score,
    status: stop ? 'stop_and_seek_help' : limit ? 'limit' : 'adjust',
    summary: 'This quick entry has limited structured information, so it cannot support a full readiness decision.',
    focus: stop ? ['Tell a qualified adult now', 'Do not resume until the concern is checked'] : ['Complete the detailed check-in', 'Use only information you can report confidently'],
    avoid: stop ? ['Continuing the event', 'Testing the concerning symptom'] : limit ? ['Movements that reproduce or worsen symptoms'] : [],
    reasons: [{ id: 'quick-input', label: 'Quick check-in has incomplete structured data', source: 'current_state' }],
  }, { answeredInputs: 1, expectedInputs: 8 })
}
