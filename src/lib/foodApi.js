import { supabase } from './supabaseClient'
import { friendlyFeatureError, recordOperationalEvent } from './operationalEvents'
import { classifyFoodQuery, deduplicateFoods, scoreFoodResult } from './foodSearchRules'

export async function findFoodByBarcode(barcode) {
  const value = String(barcode ?? '').replace(/\D/g, '')
  if (!value) return null
  if (!supabase) throw new Error('Sign in to look up a barcode with OpenNutrition.')
  const { data, error } = await supabase.functions.invoke('search-food', { body: { barcode: value } })
  if (error) {
    await recordOperationalEvent('nutrition', 'BARCODE_LOOKUP_FAILED')
    throw new Error('OpenNutrition barcode lookup is unavailable right now.')
  }
  return data?.food ? normalizeFoodRecord(data.food) : null
}

export async function searchFoods(query) {
  const search = query.trim()
  if (search.length < 2) return []
  if (!supabase) throw new Error('Sign in to search OpenNutrition, or add the food manually.')
  try {
    const { data, error } = await supabase.functions.invoke('search-food', { body: { query: search } })
    if (error) throw error
    return rankFoods((data?.foods ?? []).map(normalizeFoodRecord), search.toLowerCase())
  } catch {
    await recordOperationalEvent('nutrition', 'FOOD_SEARCH_FAILED')
    throw new Error(friendlyFeatureError('nutrition'))
  }
}

export async function loadFoodDetails(food) {
  if (!supabase || food?.sourceType !== 'opennutrition' || !food?.sourceId) return food
  const { data, error } = await supabase.functions.invoke('search-food', { body: { sourceId: food.sourceId } })
  return error || !data?.food ? food : normalizeFoodRecord({ ...food, ...data.food })
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
  return error ? false : Boolean(data?.isCurator)
}

export async function verifyFood(food) {
  const { data, error } = await supabase.functions.invoke('manage-food', { body: { action: 'verify', food: stripFoodState(food) } })
  if (error) throw error
  return data.food
}

export async function recordFoodUsage(food) {
  if (!supabase || !food?.sourceId) return
  const sourceKey = getFoodSourceKey(food)
  const { error: personalError } = await supabase.rpc('record_user_food_usage', {
    p_source_key: sourceKey,
    p_food_json: stripFoodState(food),
  })
  if (personalError) await recordOperationalEvent('nutrition', 'PERSONAL_FOOD_USAGE_FAILED', 'warning')
  if (food.sourceType !== 'opennutrition') return
  const { error } = await supabase.functions.invoke('manage-food', { body: { action: 'record_usage', food: stripFoodState(food) } })
  if (error) await recordOperationalEvent('nutrition', 'FOOD_USAGE_RECORD_FAILED', 'warning')
}

export async function validateCuratorFood(food) {
  const { data, error } = await supabase.functions.invoke('manage-food', { body: { action: 'validate', food: stripFoodState(food) } })
  if (error && !data) throw new Error('This food could not be validated right now.')
  return data
}

function getFoodSourceKey(food) {
  return String(food.sourceId || food.barcode || `${food.name}|${food.brand}|${food.standardServingSize ?? food.servingSize}`).toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeFoodRecord(food = {}) {
  const standardServingSize = food.standardServingSize ?? food.servingSize ?? '100 g'
  const explicitWeight = String(standardServingSize).match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i)
  return {
    ...food,
    foodSource: food.foodSource ?? (food.sourceType === 'opennutrition' ? 'OpenNutrition' : 'Athlete Reload'),
    servingSize: food.servingSize ?? standardServingSize,
    standardServingSize,
    servingWeight: food.servingWeight ?? (explicitWeight ? Number(explicitWeight[1]) : undefined),
    servingWeightUnit: food.servingWeightUnit ?? (explicitWeight?.[2]?.toLowerCase() === 'ml' ? 'mL' : 'g'),
    servingOptions: Array.isArray(food.servingOptions) ? food.servingOptions.filter((option) => option?.label && Number(option?.gramWeight) > 0) : [],
  }
}

function stripFoodState(food) {
  const value = { ...food }
  for (const field of ['isSaved', 'savedFoodId', 'isVerified', 'isRecent', 'meal', 'id', 'loggedAt', 'date', 'completed']) delete value[field]
  return value
}

function rankFoods(foods, query) {
  const queryType = classifyFoodQuery(query, foods.map((food) => food.brand).filter(Boolean))
  return deduplicateFoods(foods.filter((food) => matchesQuery(food, query) && plausible(food)))
    .sort((first, second) => personalScore(second) - personalScore(first) || scoreFoodResult(second, query, queryType) - scoreFoodResult(first, query, queryType))
    .slice(0, 12)
}

function personalScore(food) {
  return Number(Boolean(food.isVerified)) * 100 + Number(Boolean(food.isSaved)) * 55 + Number(Boolean(food.isRecent)) * (15 + Math.min(30, Number(food.usageCount ?? 0) * 3))
}

function matchesQuery(food, query) {
  const target = `${food.name ?? ''} ${food.brand ?? ''} ${(food.alternateNames ?? []).join(' ')}`.toLowerCase()
  return (query.match(/[a-z0-9]+/g) ?? []).every((term) => target.includes(term))
}

function plausible(food) {
  const values = [food.calories, food.protein, food.carbohydrates, food.fats].map(Number)
  return values.every(Number.isFinite) && values[0] >= 0 && values[0] <= 1500 && values.slice(1).every((value) => value >= 0 && value <= 100) && values.slice(1).reduce((sum, value) => sum + value, 0) <= 115
}
