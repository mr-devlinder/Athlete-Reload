import { evaluateSafety } from '../safety'

export function evaluateRecommendationSafety(input = {}) {
  const findings = evaluateSafety(input)
  return {
    status: findings.some((item) => item.severity === 'stop')
      ? 'stop_and_seek_help'
      : findings.some((item) => item.severity === 'limit') ? 'limit' : 'ready',
    findings,
    version: 'safety-3.0.0',
  }
}
