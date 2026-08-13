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
  const safetyLocked = deterministic.redFlag
    || ['limit', 'stop_and_seek_help'].includes(deterministic.status)
    || deterministic.label === 'Stop and Check In'
  const deterministicScore = Math.round(Number(deterministic.score) || 0)
  const proposedScore = Number(ai.score)
  const score = safetyLocked || !Number.isFinite(proposedScore)
    ? deterministicScore
    : Math.max(0, Math.min(100, Math.round(Math.max(deterministicScore - 12, Math.min(deterministicScore + 12, proposedScore)))))
  const aiPlan = !safetyLocked && Array.isArray(ai.reportSections) && ai.reportSections.length > 0
  const aiFocus = !safetyLocked && Array.isArray(ai.focus) ? ai.focus.filter(Boolean) : []
  const aiAvoid = !safetyLocked && Array.isArray(ai.avoid) ? ai.avoid.filter(Boolean) : []
  const warnings = [...(deterministic.warnings ?? [])]
  for (const warning of aiAvoid) {
    const message = typeof warning === 'string' ? warning : warning?.message
    if (message && !warnings.some((item) => (typeof item === 'string' ? item : item?.message) === message)) {
      warnings.push({ id: `ai-warning-${warnings.length + 1}`, message })
    }
  }

  return createStructuredRecommendation({
    ...deterministic,
    ...(safetyLocked ? {} : {
      action: typeof ai.action === 'string' && ai.action.trim() ? ai.action.trim() : deterministic.action,
      avoid: aiAvoid.length ? aiAvoid : deterministic.avoid,
      breakdown: Array.isArray(ai.breakdown) && ai.breakdown.length ? ai.breakdown : deterministic.breakdown,
      contextFactors: Array.isArray(ai.contextFactors) && ai.contextFactors.length ? ai.contextFactors : deterministic.contextFactors,
      focus: aiFocus.length ? aiFocus : deterministic.focus,
      intensity: typeof ai.intensity === 'string' && ai.intensity.trim() ? ai.intensity.trim() : deterministic.intensity,
      label: typeof ai.label === 'string' && ai.label.trim() ? ai.label.trim() : deterministic.label,
      reasons: Array.isArray(ai.reasons) && ai.reasons.length ? ai.reasons : deterministic.reasons,
      reportSections: aiPlan ? mergeReportSections(deterministic.reportSections, ai.reportSections) : deterministic.reportSections,
      tone: ['danger', 'warning', 'caution', 'ready'].includes(ai.tone) ? ai.tone : deterministic.tone,
    }),
    summary: typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary.trim() : deterministic.summary,
    explanation: typeof ai.explanation === 'string' ? ai.explanation.trim() : '',
    engineVersion: ai._source ? `${deterministic.engineVersion}+${ai._source}` : deterministic.engineVersion,
    score,
    status: safetyLocked ? deterministic.status : getRecommendationStatus({ label: ai.label, score }),
    confidence: deterministic.confidence,
    primaryAction: safetyLocked
      ? deterministic.primaryAction
      : { instruction: typeof ai.action === 'string' && ai.action.trim() ? ai.action.trim() : deterministic.primaryAction?.instruction, timing: 'now' },
    actions: safetyLocked || !aiFocus.length ? deterministic.actions : aiFocus,
    warnings,
    adjustments: deterministic.adjustments,
  })
}

function mergeReportSections(deterministicSections = [], aiSections = []) {
  const merged = new Map(deterministicSections.filter((section) => section?.id).map((section) => [section.id, section]))
  aiSections.filter((section) => section?.id).forEach((section) => {
    const locked = ['pain-guidance', 'pre-event-timeline', 'new-pain-soreness'].includes(section.id)
    if (!locked || !merged.has(section.id)) merged.set(section.id, section)
  })
  return [...merged.values()]
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
