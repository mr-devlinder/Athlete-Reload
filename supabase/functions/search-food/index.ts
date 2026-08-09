import { createClient } from 'npm:@supabase/supabase-js@2.110.9'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Food = Record<string, string | number | boolean | undefined | Array<{ label: string; gramWeight: number }>>
type QueryType = 'generic' | 'branded' | 'mixed'

const preparationWords = new Set(['raw', 'cooked', 'grilled', 'roasted', 'baked', 'boiled', 'fried', 'steamed'])
const commonFoods = new Set(['apple', 'banana', 'beef', 'bread', 'chicken', 'egg', 'fish', 'milk', 'oats', 'pasta', 'potato', 'rice', 'salmon', 'turkey', 'yogurt'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { query, sourceId } = await request.json()
    if (sourceId) {
      const food = await loadUsdaFood(String(sourceId))
      return json({ food })
    }
    const normalizedQuery = normalizeText(query)
    if (normalizedQuery.length < 2) return json({ foods: [], queryType: 'mixed' })

    const verified = await loadVerifiedFoods(normalizedQuery)
    const knownBrands = new Set(verified.map((food) => normalizeText(food.brand)).filter(Boolean))
    const initialType = classifyQuery(normalizedQuery, knownBrands)
    const [usda, off] = await Promise.all([
      searchUsda(normalizedQuery, initialType),
      initialType === 'generic' ? Promise.resolve([]) : searchOpenFoodFacts(normalizedQuery),
    ])
    const queryType = confirmQueryType(initialType, normalizedQuery, [...usda, ...off])
    const secondaryOff = initialType === 'generic' && queryType !== 'generic'
      ? await searchOpenFoodFacts(normalizedQuery)
      : off
    const candidates = [...verified, ...usda, ...secondaryOff]
      .filter(isPlausibleFood)
      .filter((food) => nameMatches(food, normalizedQuery))
    const foods = deduplicate(candidates)
      .sort((first, second) => scoreFood(second, normalizedQuery, queryType) - scoreFood(first, normalizedQuery, queryType))
      .slice(0, 24)

    return json({ foods, queryType })
  } catch (error) {
    console.error(error)
    return json({ error: 'Food search is unavailable right now' }, 502)
  }
})

async function loadVerifiedFoods(query: string): Promise<Food[]> {
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data, error } = await client.from('verified_foods').select('id, source_key, food').limit(150)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row.food,
    catalogId: row.id,
    foodSource: 'Athlete Reload verified',
    isVerified: true,
    sourceId: row.source_key,
    sourceType: 'athlete_reload',
  })).filter((food: Food) => nameMatches(food, query))
}

async function searchUsda(query: string, queryType: QueryType): Promise<Food[]> {
  const apiKey = Deno.env.get('USDA_FOODDATA_API_KEY')
  if (!apiKey) return []
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', '50')
  const dataTypes = queryType === 'branded'
    ? ['Branded', 'Foundation', 'SR Legacy']
    : ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']
  dataTypes.forEach((type) => url.searchParams.append('dataType', type))
  const response = await fetch(url)
  if (!response.ok) return []
  const payload = await response.json()
  return (payload.foods ?? []).map(normalizeUsda).filter((food: Food) => food.name)
}

async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('json', '1')
  url.searchParams.set('search_terms', query)
  url.searchParams.set('page_size', '24')
  url.searchParams.set('fields', 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments')
  const response = await fetch(url)
  if (!response.ok) return []
  const payload = await response.json()
  return (payload.products ?? []).map(normalizeOff).filter((food: Food) => food.name)
}

function classifyQuery(query: string, knownBrands: Set<string>): QueryType {
  if (/^\d{8,14}$/.test(query)) return 'branded'
  if ([...knownBrands].some((brand) => query.includes(brand))) return 'branded'
  const words = query.split(' ')
  const genericSignals = words.some((word) => commonFoods.has(word) || preparationWords.has(word))
  const productSignals = /\b(bar|cereal|cookies?|chips?|protein|flavor|pack|zero|organic)\b/.test(query) && words.length >= 2
  if (genericSignals && !productSignals && words.length <= 5) return 'generic'
  if (productSignals) return 'branded'
  return 'mixed'
}

function confirmQueryType(initial: QueryType, query: string, foods: Food[]): QueryType {
  if (initial !== 'mixed') return initial
  const matchingBrands = foods.filter((food) => food.brand && query.includes(normalizeText(food.brand))).length
  return matchingBrands >= 2 ? 'branded' : 'mixed'
}

function scoreFood(food: Food, query: string, queryType: QueryType) {
  const name = normalizeText(food.name)
  const brand = normalizeText(food.brand)
  const terms = query.split(' ')
  let score = 0
  if (name === query) score += 120
  else if (name.startsWith(query)) score += 90
  else if (terms.every((term) => name.includes(term) || brand.includes(term))) score += 65
  else score += terms.filter((term) => name.includes(term) || brand.includes(term)).length * 12
  if (food.isVerified) score += 80
  if (brand && query.includes(brand)) score += 35
  if (queryType === 'generic' && food.sourceType === 'usda_generic') score += 45
  if (queryType === 'generic' && ['usda_branded', 'open_food_facts'].includes(String(food.sourceType))) score -= 20
  if (queryType === 'branded' && ['usda_branded', 'open_food_facts'].includes(String(food.sourceType))) score += 35
  if (hasCompleteMacros(food)) score += 18
  if (food.standardServingSize && food.servingWeight) score += 12
  if (String(food.originalDescription ?? '').length > 105) score -= 15
  return score
}

function deduplicate(foods: Food[]) {
  const best = new Map<string, Food>()
  for (const food of foods) {
    const key = duplicateKey(food)
    const existing = best.get(key)
    if (!existing || Number(food.isVerified) > Number(existing.isVerified) || completeness(food) > completeness(existing)) best.set(key, food)
  }
  return [...best.values()]
}

function duplicateKey(food: Food) {
  const preparation = [...preparationWords].find((word) => normalizeText(food.name).includes(word)) ?? ''
  return [normalizeText(food.name).replace(/\b(raw|cooked|grilled|roasted|baked|boiled|fried|steamed)\b/g, '').trim(), normalizeText(food.brand), preparation].join('|')
}

function normalizeUsda(food: any): Food {
  const nutrients = new Map((food.foodNutrients ?? []).map((item: any) => [normalizeText(item.nutrientName), { value: Number(item.value ?? 0), unit: normalizeText(item.unitName) }]))
  const find = (...names: string[]) => { for (const name of names) { const nutrient: any = nutrients.get(name); if (nutrient) return nutrient.value } return 0 }
  const energy: any = nutrients.get('energy')
  const energyKcal = energy?.unit.includes('kj') ? Number(energy.value / 4.184) : Number(energy?.value ?? 0)
  const sourceServing = food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : ''
  const servingSize = food.householdServingFullText || sourceServing || '100 g'
  const servingGrams = sourceServing ? getServingGrams(sourceServing) : 100
  const factor = servingGrams ? servingGrams / 100 : 1
  const scaled = (value: number) => Math.round(value * factor * 10) / 10
  const originalDescription = String(food.description ?? 'Unnamed food')
  return {
    name: cleanUsdaName(originalDescription), originalDescription, brand: food.brandOwner ?? food.brandName ?? '', barcode: food.gtinUpc ?? '', foodSource: 'USDA FoodData Central',
    sourceId: String(food.fdcId ?? ''), sourceType: food.dataType === 'Branded' ? 'usda_branded' : 'usda_generic',
    servingSize, standardServingSize: servingSize, servingWeight: servingGrams || 100, servingWeightUnit: 'g', nutrientBasis: 'serving', calories: Math.round(energyKcal * factor),
    protein: scaled(find('protein')), carbohydrates: scaled(find('carbohydrate, by difference')), fats: scaled(find('total lipid (fat)')), fiber: scaled(find('fiber, total dietary')), sugar: scaled(find('sugars, total including nlea')), sodium: scaled(find('sodium, na')),
  }
}

async function loadUsdaFood(sourceId: string): Promise<Food | null> {
  const apiKey = Deno.env.get('USDA_FOODDATA_API_KEY')
  if (!apiKey || !/^\d+$/.test(sourceId)) return null
  const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${sourceId}`)
  url.searchParams.set('api_key', apiKey)
  const response = await fetch(url)
  if (!response.ok) return null
  const record = await response.json()
  const base = normalizeUsda(record)
  const portions = (record.foodPortions ?? [])
    .map((portion: any) => ({
      gramWeight: Number(portion.gramWeight),
      label: String(portion.portionDescription || portion.modifier || '').trim(),
    }))
    .filter((portion: any) => portion.label && Number.isFinite(portion.gramWeight) && portion.gramWeight > 0)
  const brandedLabel = String(record.householdServingFullText ?? '').trim()
  const brandedWeight = record.servingSize ? getServingGrams(`${record.servingSize} ${record.servingSizeUnit ?? 'g'}`) : 0
  if (brandedLabel && brandedWeight) portions.unshift({ label: brandedLabel, gramWeight: brandedWeight })
  const uniquePortions = [...new Map(portions.map((portion: any) => [`${normalizeText(portion.label)}|${portion.gramWeight}`, portion])).values()]
  const canonical: any = uniquePortions[0]
  if (!canonical) return { ...base, servingOptions: [] }
  const baseWeight = Number(base.servingWeight) || 100
  const scale = canonical.gramWeight / baseWeight
  const scaleValue = (value: unknown) => Math.round(Number(value ?? 0) * scale * 10) / 10
  return {
    ...base,
    servingSize: canonical.label,
    standardServingSize: canonical.label,
    servingWeight: canonical.gramWeight,
    servingOptions: uniquePortions,
    calories: Math.round(scaleValue(base.calories)),
    protein: scaleValue(base.protein),
    carbohydrates: scaleValue(base.carbohydrates),
    fats: scaleValue(base.fats),
    fiber: scaleValue(base.fiber),
    sugar: scaleValue(base.sugar),
    sodium: scaleValue(base.sodium),
  }
}

function normalizeOff(product: any): Food {
  const n = product.nutriments ?? {}
  const servingGrams = Number(product.serving_quantity) || 100
  const factor = servingGrams / 100
  const nutrient = (key: string) => Math.round(Number(n[`${key}_100g`] ?? 0) * factor * 10) / 10
  const standardServingSize = product.serving_size ?? '100 g'
  return {
    name: product.product_name ?? product.product_name_en ?? '', brand: product.brands ?? '', barcode: product.code ?? '', foodSource: 'Open Food Facts',
    sourceId: String(product.code ?? ''), sourceType: 'open_food_facts', servingSize: standardServingSize, standardServingSize,
    servingWeight: servingGrams, servingWeightUnit: /\bml\b/i.test(standardServingSize) ? 'mL' : 'g', nutrientBasis: 'serving', servingOptions: [], calories: Math.round(Number(n['energy-kcal_100g'] ?? 0) * factor),
    protein: nutrient('proteins'), carbohydrates: nutrient('carbohydrates'), fats: nutrient('fat'), fiber: nutrient('fiber'), sugar: nutrient('sugars'), sodium: nutrient('sodium') * 1000,
  }
}

function cleanUsdaName(value: string) {
  return value.toLowerCase().split(',').map((part) => part.trim()).filter(Boolean).slice(0, 4).join(', ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getServingGrams(serving: string) {
  const explicit = String(serving).match(/(\d+(?:\.\d+)?)\s*g\b/i)
  if (explicit) return Number(explicit[1])
  const ounces = String(serving).match(/(\d+(?:\.\d+)?)\s*oz\b/i)
  if (ounces) return Number(ounces[1]) * 28.3495
  return 0
}

function nameMatches(food: Food, query: string) {
  const target = `${normalizeText(food.name)} ${normalizeText(food.brand)}`
  return query.split(' ').every((term) => target.includes(term))
}

function isPlausibleFood(food: Food) {
  const values = [food.calories, food.protein, food.carbohydrates, food.fats].map(Number)
  return values.every(Number.isFinite) && values[0] >= 0 && values[0] <= 1500 && values.slice(1).every((value) => value >= 0 && value <= 100)
}

function hasCompleteMacros(food: Food) {
  return [food.calories, food.protein, food.carbohydrates, food.fats].every((value) => Number.isFinite(Number(value)))
}

function completeness(food: Food) {
  return ['calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar', 'sodium', 'standardServingSize', 'servingWeight'].filter((key) => food[key] != null && food[key] !== '').length
}

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
