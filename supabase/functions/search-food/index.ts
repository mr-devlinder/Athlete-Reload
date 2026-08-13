import { createClient } from 'npm:@supabase/supabase-js@2.110.9'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Food = Record<string, any>
type QueryType = 'generic' | 'branded' | 'mixed'

const preparationWords = new Set(['raw', 'cooked', 'grilled', 'roasted', 'baked', 'boiled', 'fried', 'steamed'])
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const userClient = createUserClient(request)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Authentication required' }, 401)

    const body = await request.json()
    const barcode = normalizeBarcode(body.barcode)
    const sourceId = String(body.sourceId ?? '').trim()
    const query = normalizeText(body.query)
    if (!barcode && !sourceId && query.length < 2) return json({ foods: [], queryType: 'mixed', provider: 'OpenNutrition' })

    const [verified, personal] = await Promise.all([
      loadVerifiedFoods(query || barcode || sourceId, userClient),
      loadPersonalFoods(query || barcode || sourceId, userClient),
    ])

    let external: Food[] = []
    if (barcode) {
      const food = await searchOpenNutrition(barcode, 30).then((foods) => foods.find((item) => normalizeBarcode(item.ean_13) === barcode) ?? null)
      if (food) external = [normalizeOpenNutrition(food)]
    } else if (sourceId) {
      const food = await getOpenNutritionFood(sourceId)
      if (food) external = [normalizeOpenNutrition(food)]
    } else {
      const foods = await searchOpenNutrition(body.query.trim(), 40)
      external = (Array.isArray(foods) ? foods : []).map(normalizeOpenNutrition)
    }

    const queryType = classifyQuery(query, [...verified, ...personal, ...external])
    const candidates = [...verified, ...personal, ...external]
      .filter(isPlausibleFood)
      .filter((food) => barcode ? food.barcode === barcode : sourceId ? food.sourceId === sourceId : nameMatches(food, query))
    const foods = deduplicate(candidates)
      .sort((first, second) => scoreFood(second, query, queryType) - scoreFood(first, query, queryType))
      .slice(0, 24)

    if (sourceId) return json({ food: foods[0] ?? external[0] ?? null, provider: 'OpenNutrition' })
    if (barcode) return json({ food: foods[0] ?? null, foods, queryType: 'branded', provider: 'OpenNutrition' })
    return json({ foods, queryType, provider: 'OpenNutrition', attribution: 'OpenNutrition — https://www.opennutrition.app' })
  } catch (error) {
    console.error(error)
    return json({ error: 'Food search is unavailable right now', provider: 'OpenNutrition' }, 502)
  }
})

function createUserClient(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
}

async function loadVerifiedFoods(query: string, client: ReturnType<typeof createClient>): Promise<Food[]> {
  const { data, error } = await client.from('verified_foods').select('id, source_key, source_type, source_id, food').limit(200)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row.food,
    catalogId: row.id,
    foodSource: 'Athlete Reload verified',
    isVerified: true,
    sourceId: row.source_id ?? row.source_key,
    sourceType: 'athlete_reload',
  })).filter((food: Food) => nameMatches(food, query) || normalizeBarcode(food.barcode) === query || food.sourceId === query)
}

async function loadPersonalFoods(query: string, client: ReturnType<typeof createClient>): Promise<Food[]> {
  const [{ data: usage, error: usageError }, { data: saved, error: savedError }] = await Promise.all([
    client.from('user_food_usage').select('source_key, food_json, selection_count, last_selected_at').order('last_selected_at', { ascending: false }).limit(80),
    client.from('saved_foods').select('source_key, food').order('created_at', { ascending: false }).limit(80),
  ])
  if (usageError) throw usageError
  if (savedError) throw savedError
  const recent = (usage ?? []).map((row: any) => ({ ...row.food_json, sourceKey: row.source_key, usageCount: row.selection_count, lastUsedAt: row.last_selected_at, isRecent: true }))
  const favorites = (saved ?? []).map((row: any) => ({ ...row.food, sourceKey: row.source_key, isSaved: true }))
  return [...favorites, ...recent].filter((food) => nameMatches(food, query) || normalizeBarcode(food.barcode) === query || food.sourceId === query)
}

function openNutritionBaseUrl() {
  return (Deno.env.get('OPENNUTRITION_SEARCH_URL')?.trim() || 'https://search.opennutrition.app').replace(/\/$/, '')
}

async function searchOpenNutrition(query: string, limit: number): Promise<Food[]> {
  const url = new URL(`${openNutritionBaseUrl()}/foods`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', '0')
  url.searchParams.set('facets', 'false')
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`OpenNutrition search returned ${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload?.foods) ? payload.foods : []
}

async function getOpenNutritionFood(id: string): Promise<Food | null> {
  if (!/^fd_[A-Za-z0-9]+$/.test(id)) return null
  const response = await fetch(`${openNutritionBaseUrl()}/foods/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`OpenNutrition details returned ${response.status}`)
  return await response.json()
}

export function normalizeOpenNutrition(food: Food = {}): Food {
  const nutrients = food.nutrition_100g ?? food.nutrition ?? {}
  const serving = normalizeServing(food.serving)
  const gramWeight = serving.gramWeight || 100
  const factor = gramWeight / 100
  const scaled = (key: string, aliases: string[] = []) => {
    const raw = [key, ...aliases].map((name) => nutrients[name]).find((value) => Number.isFinite(Number(value)))
    return Math.round(Number(raw ?? 0) * factor * 10) / 10
  }
  const source = Array.isArray(food.source) ? food.source[0] ?? {} : food.source ?? {}
  return {
    name: String(food.name ?? 'Unnamed food').trim(),
    brand: String(food.brand ?? source.brand ?? '').trim(),
    barcode: normalizeBarcode(food.ean_13),
    foodSource: 'OpenNutrition',
    sourceDataset: String(source.dataset ?? source.name ?? source.source ?? 'OpenNutrition public search'),
    sourceId: String(food.id ?? ''),
    sourceType: 'opennutrition',
    servingSize: serving.label,
    standardServingSize: serving.label,
    servingWeight: gramWeight,
    servingWeightUnit: 'g',
    servingOptions: serving.options,
    nutrientBasis: 'serving',
    calories: Math.round(scaled('calories', ['energy_kcal'])),
    protein: scaled('protein'),
    carbohydrates: scaled('carbohydrates'),
    fats: scaled('total_fat', ['fat']),
    fiber: scaled('dietary_fiber', ['fiber']),
    sugar: scaled('total_sugars', ['sugars']),
    saturatedFat: scaled('saturated_fats'),
    monounsaturatedFat: scaled('monounsaturated_fats'),
    polyunsaturatedFat: scaled('polyunsaturated_fats'),
    transFat: scaled('trans_fats'),
    cholesterol: scaled('cholesterol'),
    sodium: scaled('sodium'),
    potassium: scaled('potassium'),
    calcium: scaled('calcium'),
    iron: scaled('iron'),
    vitaminA: scaled('vitamin_a'),
    vitaminC: scaled('vitamin_c'),
    vitaminD: scaled('vitamin_d'),
    vitaminE: scaled('vitamin_e'),
    vitaminK: scaled('vitamin_k'),
    labels: food.labels ?? [],
    alternateNames: food.alternate_names ?? [],
  }
}

function normalizeServing(value: Food | undefined) {
  const metric = value?.metric ?? {}
  const common = value?.common ?? value ?? {}
  const gramWeight = Number(metric.quantity ?? value?.gram_weight ?? value?.gramWeight ?? value?.weight_g ?? value?.amount_g ?? 0)
  const quantity = Number(common.amount ?? common.quantity ?? 1) || 1
  const unit = String(common.unit ?? common.measure ?? 'serving')
  const description = String(common.description ?? common.label ?? `${quantity} ${unit}`).trim()
  const validWeight = Number.isFinite(gramWeight) && gramWeight > 0 ? gramWeight : 100
  const label = description || '100 g'
  const options = [{ label, gramWeight: validWeight }]
  if (validWeight !== 100) options.push({ label: '100 g', gramWeight: 100 })
  return { label, gramWeight: validWeight, options }
}

function classifyQuery(query: string, foods: Food[]): QueryType {
  if (/^\d{13}$/.test(query)) return 'branded'
  if (foods.some((food) => food.brand && query.includes(normalizeText(food.brand)))) return 'branded'
  return query.split(' ').length <= 3 ? 'generic' : 'mixed'
}

function scoreFood(food: Food, query: string, queryType: QueryType) {
  const name = normalizeText(food.name)
  const brand = normalizeText(food.brand)
  const terms = query.split(' ').filter(Boolean)
  let score = name === query ? 120 : name.startsWith(query) ? 90 : terms.every((term) => `${name} ${brand}`.includes(term)) ? 65 : 0
  if (food.isVerified) score += 100
  if (food.isSaved) score += 55
  if (food.isRecent) score += Math.min(45, 15 + Number(food.usageCount ?? 0) * 3)
  if (brand && query.includes(brand)) score += 35
  if (queryType === 'generic' && food.sourceType === 'opennutrition' && !brand) score += 25
  if (hasCompleteMacros(food)) score += 18
  if (food.standardServingSize && Number(food.servingWeight) > 0) score += 12
  return score
}

function deduplicate(foods: Food[]) {
  const best = new Map<string, Food>()
  for (const food of foods) {
    const key = food.barcode || `${normalizeText(food.name).replace(/\b(raw|cooked|grilled|roasted|baked|boiled|fried|steamed)\b/g, '').trim()}|${normalizeText(food.brand)}|${[...preparationWords].find((word) => normalizeText(food.name).includes(word)) ?? ''}`
    const existing = best.get(key)
    if (!existing || scoreFood(food, normalizeText(food.name), 'mixed') > scoreFood(existing, normalizeText(existing.name), 'mixed')) best.set(key, food)
  }
  return [...best.values()]
}

function nameMatches(food: Food, query: string) {
  const target = `${normalizeText(food.name)} ${normalizeText(food.brand)} ${(food.alternateNames ?? []).map(normalizeText).join(' ')}`
  return query.split(' ').filter(Boolean).every((term) => target.includes(term))
}

function isPlausibleFood(food: Food) {
  const values = [food.calories, food.protein, food.carbohydrates, food.fats].map(Number)
  return food.name && values.every(Number.isFinite) && values[0] >= 0 && values[0] <= 1500 && values.slice(1).every((value) => value >= 0 && value <= 100)
}

function hasCompleteMacros(food: Food) {
  return [food.calories, food.protein, food.carbohydrates, food.fats].every((value) => Number.isFinite(Number(value)))
}

function normalizeBarcode(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 13 ? digits : ''
}

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
