import { describe, expect, it } from 'vitest'
import { getPainReportsWithResolutions, normalizePainMapScale } from './bodyPainMap'

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
})
