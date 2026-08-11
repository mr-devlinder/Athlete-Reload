const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v2'
import { supabase } from './supabaseClient'
import { friendlyFeatureError, recordOperationalEvent } from './operationalEvents'
import { classifyFoodQuery, deduplicateFoods, scoreFoodResult } from './foodSearchRules'

function normalizeProduct(product = {}) {
  const nutriments = product.nutriments ?? {}
  const servingSize = product.serving_size ?? '1 serving'
  const servingGrams = Number.parseFloat(product.serving_quantity) || 100
  const servingWeightUnit = /\bml\b/i.test(servingSize) ? 'mL' : 'g'
  const nutrient = (key, outputUnit = 'g') => {
    const servingValue = nutriments[`${key}_serving`]
    const per100gValue = nutriments[`${key}_100g`]
    const rawValue = servingValue ?? (per100gValue == null ? undefined : Number(per100gValue) * servingGrams / 100)
    if (rawValue == null || !Number.isFinite(Number(rawValue))) return undefined
    const sourceUnit = String(nutriments[`${key}_unit`] || 'g').toLowerCase()
    let value = Number(rawValue)
    if (sourceUnit === 'kg') value *= 1000
    if (sourceUnit === 'mg') value /= 1000
    if (sourceUnit === 'µg' || sourceUnit === 'ug' || sourceUnit === 'mcg') value /= 1000000
    if (outputUnit === 'mg') value *= 1000
    if (outputUnit === 'mcg') value *= 1000000
    return Math.round(value * 10) / 10
  }
  const calories = nutriments['energy-kcal_serving'] ?? (nutriments['energy-kcal_100g'] == null ? nutriments['energy-kcal'] : Number(nutriments['energy-kcal_100g']) * servingGrams / 100)

  return {
    barcode: product.code ?? '',
    brand: product.brands ?? '',
    calories: calories == null ? undefined : Math.round(Number(calories)),
    carbohydrates: nutrient('carbohydrates'),
    fats: nutrient('fat'),
    fiber: nutrient('fiber'),
    foodSource: 'Open Food Facts',
    sourceType: 'open_food_facts',
    name: product.product_name ?? product.product_name_en ?? 'Unnamed food',
    protein: nutrient('proteins'),
    servingSize,
    standardServingSize: servingSize,
    servingWeight: servingGrams,
    servingWeightUnit,
    sugar: nutrient('sugars'),
    saturatedFat: nutrient('saturated-fat'),
    polyunsaturatedFat: nutrient('polyunsaturated-fat'),
    monounsaturatedFat: nutrient('monounsaturated-fat'),
    transFat: nutrient('trans-fat'),
    cholesterol: nutrient('cholesterol', 'mg'),
    sodium: nutrient('sodium', 'mg'),
    potassium: nutrient('potassium', 'mg'),
    calcium: nutrient('calcium', 'mg'),
    iron: nutrient('iron', 'mg'),
    vitaminA: nutrient('vitamin-a', 'mcg'),
    vitaminC: nutrient('vitamin-c', 'mg'),
    vitaminD: nutrient('vitamin-d', 'mcg'),
    vitaminE: nutrient('vitamin-e', 'mg'),
    vitaminK: nutrient('vitamin-k', 'mcg'),
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
      if (error) throw error
      return rankFoods((data?.foods ?? []).map(normalizeFoodRecord), normalizedQuery)
    } catch {
      await recordOperationalEvent('nutrition', 'FOOD_SEARCH_FAILED')
      throw new Error(friendlyFeatureError('nutrition'))
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

export async function loadFoodDetails(food) {
  if (!supabase || food?.sourceType !== 'usda_generic' || !food?.sourceId) return food
  const { data, error } = await supabase.functions.invoke('search-food', { body: { sourceId: food.sourceId } })
  if (error || !data?.food) return food
  return normalizeFoodRecord({ ...food, ...data.food })
}

export async function loadSavedFoods() {
  if (!supabase) return []
  const { data, error } = await supabase.from('saved_foods').select('id, food').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...normalizeFoodRecord(row.food), savedFoodId: row.id, isSaved: true }))
}

export async function saveFood(food) {
  if (!supabase) return { ...food, isSaved: true }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to save foods.')
  const normalizedFood = normalizeFoodRecord(food)
  const sourceKey = getFoodSourceKey(normalizedFood)
  const { data, error } = await supabase.from('saved_foods').upsert({ user_id: user.id, source_key: sourceKey, food: stripFoodState(normalizedFood) }, { onConflict: 'user_id,source_key' }).select('id, food').single()
  if (error) throw error
  return { ...normalizeFoodRecord(data.food), savedFoodId: data.id, isSaved: true }
}

export function isSameSavedFood(first, second) {
  return getFoodSourceKey(first) === getFoodSourceKey(second)
}

export async function removeSavedFood(id) {
  if (!supabase || !id) return
  const { error } = await supabase.from('saved_foods').delete().eq('id', id)
  if (error) throw error
}

export async function getFoodCuratorStatus() {
  if (!supabase) return false
  const { data, error } = await supabase.functions.invoke('manage-food', { body: { action: 'status' } })
  if (error) return false
  return Boolean(data?.isCurator)
}

export async function verifyFood(food) {
  const { data, error } = await supabase.functions.invoke('manage-food', { body: { action: 'verify', food: stripFoodState(food) } })
  if (error) throw error
  return data.food
}

export async function recordFoodUsage(food) {
  if (!supabase || !food?.sourceId || !['usda_generic', 'usda_branded', 'open_food_facts'].includes(food.sourceType)) return
  const { error } = await supabase.functions.invoke('manage-food', { body: { action: 'record_usage', food: stripFoodState(food) } })
  if (error) await recordOperationalEvent('nutrition', 'FOOD_USAGE_RECORD_FAILED', 'warning')
}

export async function validateCuratorFood(food) {
  const { data, error } = await supabase.functions.invoke('manage-food', { body: { action: 'validate', food: stripFoodState(food) } })
  if (error && !data) throw new Error('This food could not be validated right now.')
  return data
}

function getFoodSourceKey(food) { return String(food.barcode || `${food.name}|${food.brand}|${food.standardServingSize ?? food.servingSize}`).toLowerCase().replace(/\s+/g, ' ').trim() }
function normalizeFoodRecord(food = {}) {
  const standardServingSize = food.standardServingSize ?? food.servingSize ?? '1 serving'
  const explicitWeight = String(standardServingSize).match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i)
  return {
    ...food,
    servingSize: food.servingSize ?? standardServingSize,
    standardServingSize,
    servingWeight: food.servingWeight ?? (explicitWeight ? Number(explicitWeight[1]) : undefined),
    servingWeightUnit: food.servingWeightUnit ?? (explicitWeight?.[2]?.toLowerCase() === 'ml' ? 'mL' : 'g'),
    servingOptions: Array.isArray(food.servingOptions) ? food.servingOptions.filter((option) => option?.label && Number(option?.gramWeight) > 0) : [],
  }
}
function stripFoodState(food) {
  const value = { ...food }
  for (const field of ['isSaved', 'savedFoodId', 'isVerified', 'meal', 'id', 'loggedAt', 'date', 'completed']) delete value[field]
  return value
}

function rankFoods(foods, query) {
  const queryType = classifyFoodQuery(query, foods.map((food) => food.brand).filter(Boolean))
  return deduplicateFoods(foods.filter((food) => nameMatchesQuery(food.name, query) && isPlausibleFood(food)))
    .sort((first, second) => scoreFoodResult(second, query, queryType) - scoreFoodResult(first, query, queryType))
    .slice(0, 12)
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
