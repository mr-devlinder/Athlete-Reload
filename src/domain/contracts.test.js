import { describe, expect, it } from 'vitest'
import { createQuickDeterministicRecommendation, createStructuredRecommendation, mergeAiExplanation } from './contracts'

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

  it('uses AI scoring and event-specific sections when safety is not locked', () => {
    const deterministic = createStructuredRecommendation({
      score: 76.6,
      label: 'Controlled Training',
      tone: 'caution',
      action: 'Use the standard plan.',
      focus: ['Generic warm-up'],
      reportSections: [{ id: 'warm-up-focus', title: 'Warm-up', summary: 'Generic.', items: [] }],
    })
    const merged = mergeAiExplanation(deterministic, {
      _source: 'gemini',
      score: 85.4,
      label: 'Full Practice With a Short Ramp',
      tone: 'ready',
      action: 'Build through volleyball footwork before full-speed transition reps.',
      focus: ['Use two controlled approach-jump sets before normal team reps.'],
      reportSections: [{ id: 'warm-up-focus', title: 'Volleyball ramp', summary: 'Prepare for repeated jumps.', items: ['Start with controlled approach jumps.'] }],
    })
    expect(merged.score).toBe(85)
    expect(merged.label).toBe('Full Practice With a Short Ramp')
    expect(merged.reportSections[0].title).toBe('Volleyball ramp')
    expect(merged.primaryAction.instruction).toContain('volleyball')
  })

  it('bounds AI score changes around the deterministic readiness baseline', () => {
    const deterministic = createStructuredRecommendation({ score: 76.6, label: 'Controlled Training', tone: 'caution' })
    expect(mergeAiExplanation(deterministic, { score: 100 }).score).toBe(89)
    expect(mergeAiExplanation(deterministic, { score: 10 }).score).toBe(65)
  })
})
