type Food = Record<string, any>

export function normalizeBarcode(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 12) return `0${digits}`
  return [8, 13, 14].includes(digits.length) ? digits : ''
}

export function getRequestedBarcode(body: Food = {}) {
  return normalizeBarcode(body.barcode) || normalizeBarcode(body.query)
}

export function resolveOpenNutritionBarcodeFood(foods: Food[], value: unknown): Food | null {
  const barcode = normalizeBarcode(value)
  if (!barcode || !Array.isArray(foods) || foods.length === 0) return null

  const exact = foods.find((food) => normalizeBarcode(food?.ean_13) === barcode)
  const food = exact ?? (foods.length === 1 ? foods[0] : null)
  return food ? { ...food, ean_13: barcode } : null
}
