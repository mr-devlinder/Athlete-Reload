import { describe, expect, it } from 'vitest'
import { getCanonicalServing, getSourceServingFactor, getSourceServingOptions, scaleFoodForServing } from './foodServing'

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

  const foods = [
    ['egg', 50, 100, { calories: 72, protein: 6.3, sodium: 71 }],
    ['banana', 118, 236, { calories: 105, carbohydrates: 27, potassium: 422 }],
    ['chicken', 100, 150, { calories: 165, protein: 31, iron: 1 }],
    ['rice', 158, 237, { calories: 205, carbohydrates: 45, fiber: 0.6 }],
    ['cereal', 30, 45, { calories: 110, sugar: 9, vitaminD: 2 }],
    ['milk', 244, 122, { calories: 122, protein: 8, calcium: 300 }],
    ['protein bar', 60, 90, { calories: 220, protein: 20, saturatedFat: 4 }],
    ['sports drink', 591, 295.5, { calories: 140, carbohydrates: 36, sodium: 270 }],
    ['soy sauce', 15, 30, { calories: 9, protein: 1.3, sodium: 879 }],
    ['peanut butter', 32, 16, { calories: 190, fats: 16, vitaminE: 3 }],
    ['branded snack', 28, 56, { calories: 150, fats: 8, cholesterol: 5 }],
  ]

  it.each(foods)('scales %s nutrients from source-provided gram weights', (_name, sourceWeight, alternateWeight, nutrients) => {
    const food = {
      ...nutrients,
      servingSize: '1 serving',
      standardServingSize: '1 serving',
      servingWeight: sourceWeight,
      servingOptions: [{ label: 'alternate', gramWeight: alternateWeight }],
    }
    const scaled = scaleFoodForServing(food, 'alternate', 1)
    const factor = alternateWeight / sourceWeight
    for (const [key, value] of Object.entries(nutrients)) {
      const expected = key === 'calories' ? Math.round(value * factor) : Math.round(value * factor * 10) / 10
      expect(scaled[key]).toBe(expected)
    }
  })

  it('does not double-scale an already logged alternate serving', () => {
    const source = {
      calories: 100,
      protein: 10,
      sodium: 125,
      servingSize: '1 scoop',
      standardServingSize: '1 scoop',
      servingWeight: 30,
      servingOptions: [{ label: '2 scoops', gramWeight: 60 }],
    }
    const logged = scaleFoodForServing(source, '2 scoops', 2)
    const edited = scaleFoodForServing(logged, '2 scoops', 2, { label: '2 scoops', servings: 2 })
    expect(edited).toMatchObject({ calories: 400, protein: 40, sodium: 500 })
  })
})
