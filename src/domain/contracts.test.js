import { describe, expect, it } from 'vitest'
import { createQuickDeterministicRecommendation, mergeAiExplanation } from './contracts'

describe('recommendation contracts', () => {
  it('keeps deterministic safety fields when AI contradicts them', () => {
    const deterministic = createQuickDeterministicRecommendation('I passed out and feel confused')
    const merged = mergeAiExplanation(deterministic, {
      score: 100,
      status: 'ready',
      summary: 'A clearer explanation.',
      warnings: [],
      actions: [],
    })
    expect(merged.status).toBe('stop_and_seek_help')
    expect(merged.score).toBe(20)
    expect(merged.warnings).toEqual(deterministic.warnings)
    expect(merged.summary).toBe('A clearer explanation.')
  })

  it('treats an unstructured quick entry as incomplete rather than ready', () => {
    const recommendation = createQuickDeterministicRecommendation('I feel okay today')
    expect(recommendation.status).toBe('adjust')
    expect(recommendation.confidence).toBeLessThan(0.2)
  })
})
