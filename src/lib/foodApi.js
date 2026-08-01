const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v2'
import { supabase } from './supabaseClient'

function normalizeProduct(product = {}) {
  const nutriments = product.nutriments ?? {}
  const servingSize = product.serving_size ?? '1 serving'
  const servingGrams = Number.parseFloat(product.serving_quantity) || 100
  const factor = servingGrams / 100

  return {
    barcode: product.code ?? '',
    brand: product.brands ?? '',
    calories: Math.round(Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0) * factor),
    carbohydrates: Math.round(Number(nutriments.carbohydrates_100g ?? 0) * factor * 10) / 10,
    fats: Math.round(Number(nutriments.fat_100g ?? 0) * factor * 10) / 10,
    fiber: Math.round(Number(nutriments.fiber_100g ?? 0) * factor * 10) / 10,
    foodSource: 'Open Food Facts',
    name: product.product_name ?? product.product_name_en ?? 'Unnamed food',
    protein: Math.round(Number(nutriments.proteins_100g ?? 0) * factor * 10) / 10,
    servingSize,
    sugar: Math.round(Number(nutriments.sugars_100g ?? 0) * factor * 10) / 10,
    saturatedFat: Math.round(Number(nutriments['saturated-fat_100g'] ?? 0) * factor * 10) / 10,
    polyunsaturatedFat: Math.round(Number(nutriments['polyunsaturated-fat_100g'] ?? 0) * factor * 10) / 10,
    monounsaturatedFat: Math.round(Number(nutriments['monounsaturated-fat_100g'] ?? 0) * factor * 10) / 10,
    transFat: Math.round(Number(nutriments['trans-fat_100g'] ?? 0) * factor * 10) / 10,
    cholesterol: Math.round(Number(nutriments.cholesterol_100g ?? 0) * factor * 10) / 10,
    sodium: Math.round(Number(nutriments.sodium_100g ?? 0) * factor * 10) / 10,
    potassium: Math.round(Number(nutriments.potassium_100g ?? 0) * factor * 10) / 10,
    calcium: Math.round(Number(nutriments.calcium_100g ?? 0) * factor * 10) / 10,
    iron: Math.round(Number(nutriments.iron_100g ?? 0) * factor * 10) / 10,
    vitaminA: Math.round(Number(nutriments['vitamin-a_100g'] ?? 0) * factor * 10) / 10,
    vitaminC: Math.round(Number(nutriments['vitamin-c_100g'] ?? 0) * factor * 10) / 10,
    vitaminD: Math.round(Number(nutriments['vitamin-d_100g'] ?? 0) * factor * 10) / 10,
    vitaminE: Math.round(Number(nutriments['vitamin-e_100g'] ?? 0) * factor * 10) / 10,
    vitaminK: Math.round(Number(nutriments['vitamin-k_100g'] ?? 0) * factor * 10) / 10,
  }
}

export async function findFoodByBarcode(barcode) {
  const normalizedBarcode = barcode.replace(/\D/g, '')
  if (!normalizedBarcode) return null
  const urls = [
    `${OPEN_FOOD_FACTS_BASE}/product/${encodeURIComponent(normalizedBarcode)}.json`,
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(normalizedBarcode)}.json`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const payload = await response.json()
      if (payload.product) return normalizeProduct(payload.product)
    } catch {
      // Try the second public endpoint before surfacing an error.
    }
  }

  throw new Error('Food lookup is unavailable right now. Check the barcode and try again.')
}

export async function searchFoods(query) {
  const search = query.trim()
  if (search.length < 2) return []
  const normalizedQuery = search.toLowerCase()
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('search-food', { body: { query: search } })
      if (!error && data?.foods?.length) return rankFoods(data.foods, normalizedQuery)
    } catch {
      // The public fallbacks below keep search usable while the edge function is unavailable.
    }
  }
  const params = new URLSearchParams({
    fields: 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments',
    json: '1',
    page_size: '12',
    search_terms: search,
  })
  const urls = [
    `${OPEN_FOOD_FACTS_BASE}/search?${params.toString()}`,
    `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const payload = await response.json()
      const foods = (payload.products ?? []).map(normalizeProduct).filter((food) => food.name !== 'Unnamed food')
      if (foods.length) return rankFoods(foods, normalizedQuery)
    } catch {
      // Try the fallback endpoint.
    }
  }

  throw new Error('Food search is unavailable right now. Try a simpler search or add the food manually.')
}

function rankFoods(foods, query) {
  const seen = new Set()
  return foods
    .filter((food) => {
      const key = `${food.name}|${food.brand}`.toLowerCase()
      if (!nameMatchesQuery(food.name, query) || !isPlausibleFood(food) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((first, second) => scoreFood(second, query) - scoreFood(first, query))
    .slice(0, 12)
}

function scoreFood(food, query) {
  const name = food.name.toLowerCase()
  const brand = String(food.brand ?? '').toLowerCase()
  const sourceBoost = food.foodSource === 'USDA FoodData Central' ? 45 : 0
  if (name === query || name.startsWith(`${query},`) || name.startsWith(`${query} `)) return 100 + sourceBoost
  if (name.split(/[, ]/).includes(query)) return 80 + sourceBoost
  if (name.includes(query)) return 60 + sourceBoost
  if (brand.includes(query)) return 30 + sourceBoost
  return sourceBoost
}

function nameMatchesQuery(name, query) {
  const terms = query.match(/[a-z0-9]+/g) ?? []
  const normalizedName = String(name ?? '').toLowerCase()
  return terms.every((term) => normalizedName.includes(term))
}

function isPlausibleFood(food) {
  const calories = Number(food.calories ?? 0)
  const protein = Number(food.protein ?? 0)
  const carbohydrates = Number(food.carbohydrates ?? 0)
  const fats = Number(food.fats ?? 0)
  return Number.isFinite(calories) && Number.isFinite(protein) && Number.isFinite(carbohydrates) && Number.isFinite(fats)
    && calories >= 0 && calories <= 1500
    && protein >= 0 && protein <= 100 && carbohydrates >= 0 && carbohydrates <= 100 && fats >= 0 && fats <= 100
    && protein + carbohydrates + fats <= 115
}
