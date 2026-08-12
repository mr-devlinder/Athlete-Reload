import { describe, expect, it } from 'vitest'
import { formatNutritionProgress, getHydrationGuidance, getNutritionProgressParts, getNutritionTargets } from './nutrition'

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

  it('uses optional physiology sex rather than identity or a legacy proxy', () => {
    const shared = { age: 20, heightCm: 175, weightKg: 70, trainingStyle: 'Mostly individual', genderIdentity: 'Female' }
    expect(getNutritionTargets({ ...shared, biologicalSex: 'male' }).calories)
      .toBe(getNutritionTargets({ ...shared, biologicalSex: 'female' }).calories)
    expect(getNutritionTargets({ ...shared, physiologySex: 'male' }).calories)
      .toBeGreaterThan(getNutritionTargets({ ...shared, physiologySex: 'female' }).calories)
  })

  it('returns hydration as an honest range', () => {
    const guidance = getHydrationGuidance({ weightKg: 70 }, [{ date: '2026-08-11', plannedMinutes: 90 }], '2026-08-11')
    expect(guidance.minimumMl).toBeLessThan(guidance.midpointMl)
    expect(guidance.maximumMl).toBeGreaterThan(guidance.midpointMl)
  })
})
