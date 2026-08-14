import { describe, expect, it } from 'vitest'
import { attachFoodBarcode, normalizeFoodBarcode } from './foodBarcode'

describe('normalizeFoodBarcode', () => {
  it('accepts common GTIN lengths and converts UPC-A to EAN-13', () => {
    expect(normalizeFoodBarcode('96385074')).toBe('96385074')
    expect(normalizeFoodBarcode('4006381333931')).toBe('4006381333931')
    expect(normalizeFoodBarcode('737628064502')).toBe('0737628064502')
    expect(normalizeFoodBarcode('12345678901231')).toBe('12345678901231')
  })

  it('rejects unsupported lengths and text searches containing digits', () => {
    expect(normalizeFoodBarcode('123456789')).toBe('')
    expect(normalizeFoodBarcode('protein bar 737628064502')).toBe('')
  })
})

describe('attachFoodBarcode', () => {
  it('links a decoded barcode to the exact OpenNutrition result selected by the user', () => {
    const food = { name: 'Fine Ground Sea Salt Almond Flour Crackers', sourceType: 'opennutrition' }
    expect(attachFoodBarcode(food, '856069005131')).toEqual({
      ...food,
      barcode: '0856069005131',
    })
  })
})
