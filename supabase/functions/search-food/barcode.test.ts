import { describe, expect, it } from 'vitest'
import { getRequestedBarcode, normalizeBarcode, resolveOpenNutritionBarcodeFood } from './barcode'

describe('OpenNutrition barcode lookup', () => {
  it('converts UPC-A values to the EAN-13 format used by OpenNutrition', () => {
    expect(normalizeBarcode('737628064502')).toBe('0737628064502')
    expect(normalizeBarcode('0 73762 80645 02')).toBe('0737628064502')
  })

  it('accepts common GTIN lengths and detects barcodes sent through the search box', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
    expect(normalizeBarcode('12345678901231')).toBe('12345678901231')
    expect(getRequestedBarcode({ query: '0 73762 80645 02' })).toBe('0737628064502')
  })

  it('accepts the single numeric-search result when OpenNutrition omits ean_13', () => {
    const food = resolveOpenNutritionBarcodeFood([
      { id: 'food_qf1bpkJ0BTwN', name: 'Thai Peanut Noodle Kit', nutrition: { calories: 385 } },
    ], '737628064502')

    expect(food).toMatchObject({ id: 'food_qf1bpkJ0BTwN', ean_13: '0737628064502' })
  })

  it('does not guess when a numeric search returns multiple non-exact foods', () => {
    expect(resolveOpenNutritionBarcodeFood([{ id: 'food_one' }, { id: 'food_two' }], '4006381333931')).toBeNull()
  })
})
