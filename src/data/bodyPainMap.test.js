import { describe, expect, it } from 'vitest'
import { getPainReportsFromMap, getPainReportsWithResolutions, normalizePainMapScale } from './bodyPainMap'

describe('pain report normalization', () => {
  it('converts legacy percentage pain values to the canonical ten-point scale', () => {
    expect(normalizePainMapScale({ 'left-knee': 70 }, 7)['left-knee']).toBe(7)
  })

  it('creates a zero-severity resolution when prior pain disappears', () => {
    const reports = getPainReportsWithResolutions({}, { date: '2026-08-08', sourceId: 'new' }, [
      { bodyPart: 'Knee', side: 'left', severity: 60 },
    ])
    expect(reports).toContainEqual(expect.objectContaining({ bodyPart: 'Knee', severity: 0, side: 'left' }))
  })

  it('preserves structured onset, trend, movement effect, and event context', () => {
    const [report] = getPainReportsFromMap({ 'left-knee': 4 }, {
      date: '2026-08-08',
      relatedEventId: 'event-1',
      painDetails: {
        'left-knee': {
          onset: 'In the past few days',
          painTrend: 'Worsening',
          movementEffect: 'Limits how I move',
          hurtsWhen: 'Cutting',
        },
      },
    })
    expect(report).toMatchObject({
      onset: 'recent',
      trend: 'worsening',
      movementEffect: 'limits',
      relatedEventId: 'event-1',
      triggerMovement: 'Cutting',
    })
  })
})
