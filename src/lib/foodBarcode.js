export function normalizeFoodBarcode(value) {
  const raw = String(value ?? '')
  if (/[a-z]/i.test(raw)) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12) return `0${digits}`
  return [8, 13, 14].includes(digits.length) ? digits : ''
}

export function attachFoodBarcode(food, value) {
  const barcode = normalizeFoodBarcode(value)
  return barcode ? { ...food, barcode } : food
}
