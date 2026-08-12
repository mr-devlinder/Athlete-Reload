import { calculateReadiness } from '../readiness/readinessModel'
import { explainReadiness } from '../readiness/readinessExplanation'
import { buildDecisionPacket } from './buildDecisionPacket'

export function createPreEventDecision(context = {}) {
  const readiness = calculateReadiness(context)
  const explanation = explainReadiness(readiness)
  return buildDecisionPacket({
    kind: 'pre_event',
    status: readiness.status,
    score: readiness.score,
    dataQuality: readiness.dataQuality,
    summary: explanation.summary,
    primaryAction: { title: 'What to do now', instruction: explanation.summary },
    reasons: explanation.reasons.map((label, index) => ({ id: `reason-${index + 1}`, label, source: 'current_state' })),
    warnings: readiness.safety.findings.map((finding) => ({ id: finding.id, message: finding.message })),
    deterministicVersion: readiness.version,
  })
}
