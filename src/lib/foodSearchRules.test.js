import { describe, expect, it } from 'vitest'
import { classifyFoodQuery, deduplicateFoods, scoreFoodResult } from './foodSearchRules'

describe('classifyFoodQuery', () => {
  it('classifies generic, branded, and unknown searches without AI', () => {
    expect(classifyFoodQuery('grilled chicken breast')).toBe('generic')
    expect(classifyFoodQuery('Quest Protein Bar')).toBe('branded')
    expect(classifyFoodQuery('morning crunch')).toBe('mixed')
    expect(classifyFoodQuery('Chobani yogurt', ['Chobani'])).toBe('branded')
  })
})

describe('food ranking rules', () => {
  it('prioritizes verified exact matches', () => {
    const verified = { name: 'Banana', isVerified: true, sourceType: 'athlete_reload', calories: 100, protein: 1, carbohydrates: 25, fats: 0, standardServingSize: '1', servingWeight: 100 }
    const external = { ...verified, isVerified: false, sourceType: 'usda_generic' }
    expect(scoreFoodResult(verified, 'banana', 'generic')).toBeGreaterThan(scoreFoodResult(external, 'banana', 'generic'))
  })

  it('keeps preparation differences while removing true duplicates', () => {
    const foods = deduplicateFoods([
      { name: 'Chicken Breast, Raw', brand: '' },
      { name: 'Chicken Breast Raw', brand: '' },
      { name: 'Chicken Breast, Grilled', brand: '' },
    ])
    expect(foods).toHaveLength(2)
  })
})
