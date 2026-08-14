const preparationWords = new Set(['raw', 'cooked', 'grilled', 'roasted', 'baked', 'boiled', 'fried', 'steamed'])
const commonFoods = new Set(['apple', 'banana', 'beef', 'bread', 'chicken', 'egg', 'fish', 'milk', 'oats', 'pasta', 'potato', 'rice', 'salmon', 'turkey', 'yogurt'])

export function normalizeFoodQuery(value) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function classifyFoodQuery(value, knownBrands = []) {
  const query = normalizeFoodQuery(value)
  if (/^\d{8,14}$/.test(query)) return 'branded'
  if (knownBrands.map(normalizeFoodQuery).filter(Boolean).some((brand) => query.includes(brand))) return 'branded'
  const words = query.split(' ').filter(Boolean)
  const generic = words.some((word) => commonFoods.has(word) || preparationWords.has(word))
  const product = /\b(bar|cereal|cookies?|chips?|protein|flavor|pack|zero|organic)\b/.test(query) && words.length >= 2
  if (generic && !product && words.length <= 5) return 'generic'
  if (product) return 'branded'
  return 'mixed'
}

export function scoreFoodResult(food, value) {
  const query = normalizeFoodQuery(value)
  const name = normalizeFoodQuery(food.name)
  const brand = normalizeFoodQuery(food.brand)
  const terms = query.split(' ').filter(Boolean)
  let score = 0
  if (name === query) score += 120
  else if (name.startsWith(query)) score += 90
  else if (terms.every((term) => name.includes(term) || brand.includes(term))) score += 65
  if (food.isVerified) score += 80
  if (brand && query.includes(brand)) score += 35
  if ([food.calories, food.protein, food.carbohydrates, food.fats].every((item) => Number.isFinite(Number(item)))) score += 18
  if (food.standardServingSize && food.servingWeight) score += 12
  return score
}

export function deduplicateFoods(foods) {
  const best = new Map()
  for (const food of foods) {
    const normalizedName = normalizeFoodQuery(food.name)
    const preparation = [...preparationWords].find((word) => normalizedName.includes(word)) ?? ''
    const key = `${normalizedName.replace(/\b(raw|cooked|grilled|roasted|baked|boiled|fried|steamed)\b/g, '').trim()}|${normalizeFoodQuery(food.brand)}|${preparation}`
    const existing = best.get(key)
    if (!existing || Number(food.isVerified) > Number(existing.isVerified)) best.set(key, food)
  }
  return [...best.values()]
}
