import { describe, expect, it } from 'vitest'
import { getCanonicalServing, getSourceServingFactor, getSourceServingOptions } from './foodServing'

describe('source food servings', () => {
  it('does not repeat an explicit 100 g serving weight', () => {
    expect(getCanonicalServing({ standardServingSize: '100 g', servingWeight: 100 }).displayLabel).toBe('100 g')
  })

  it('uses only source-provided alternate portions', () => {
    const food = { servingSize: '1 slice', servingWeight: 28, servingOptions: [{ label: '2 slices', gramWeight: 56 }] }
    expect(getSourceServingOptions(food)).toEqual([{ label: '1 slice', gramWeight: 28 }, { label: '2 slices', gramWeight: 56 }])
    expect(getSourceServingFactor(food, '2 slices')).toBe(2)
  })

  it('does not infer portions from a food name', () => {
    expect(getSourceServingOptions({ name: 'Chicken breast', servingSize: '100 g', servingWeight: 100 })).toEqual([{ label: '100 g', gramWeight: 100 }])
  })
})
