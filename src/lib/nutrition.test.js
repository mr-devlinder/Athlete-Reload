import { describe, expect, it } from 'vitest'
import { formatNutritionProgress, getNutritionProgressParts } from './nutrition'

describe('nutrition progress formatting', () => {
  it('shows numeric current and target values without labels or units', () => {
    expect(formatNutritionProgress(1240.4, 2300.2)).toBe('1240 / 2300')
  })

  it('shows a dash when a target is unavailable', () => {
    expect(formatNutritionProgress(84, null)).toBe('84 / —')
  })

  it('shows only the current value when targets are hidden', () => {
    expect(formatNutritionProgress(84, 120, false)).toBe('84')
  })

  it('returns separately renderable current and target values', () => {
    expect(getNutritionProgressParts(1240.4, 2300.2)).toEqual({ current: '1240', target: '2300' })
    expect(getNutritionProgressParts(84, null)).toEqual({ current: '84', target: '\u2014' })
    expect(getNutritionProgressParts(84, 120, false)).toEqual({ current: '84', target: null })
  })
})
