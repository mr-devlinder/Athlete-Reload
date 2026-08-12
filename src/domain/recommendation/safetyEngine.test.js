import { describe, expect, it } from 'vitest'
import { evaluateRecommendationSafety } from './safetyEngine'

describe('evaluateRecommendationSafety', () => {
  it('does not depend on an AI response', () => {
    expect(evaluateRecommendationSafety({ pain: 8, aiStatus: 'ready' }).status).toBe('stop_and_seek_help')
  })

  it('limits moderate-high pain without diagnosing it', () => {
    const result = evaluateRecommendationSafety({ pain: 5 })
    expect(result.status).toBe('limit')
    expect(result.findings[0].message.toLowerCase()).not.toContain('diagnos')
  })
})
