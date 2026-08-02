import { createClient } from 'npm:@supabase/supabase-js@2.110.9'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Food = Record<string, string | number>

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { query } = await request.json()
    const search = String(query ?? '').trim()
    if (search.length < 2) return json({ foods: [] })

    const foods = await Promise.all([
      loadVerifiedFoods(search),
      searchUsda(search),
      searchOpenFoodFacts(search),
    ])
    const candidates = rank([...foods[0], ...foods[1], ...foods[2]], search).filter(isPlausibleFood).slice(0, 30)
    const ranked = await rerankWithGemini(search, candidates)
    return json({ foods: ranked.slice(0, 24) })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Food search failed' }, 502)
  }
})

async function loadVerifiedFoods(query: string): Promise<Food[]> {
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data } = await client.from('verified_foods').select('food').limit(100)
  return (data ?? []).map((row: any) => ({ ...row.food, foodSource: 'Athlete Reload verified', isVerified: 1 })).filter((food: Food) => nameMatches(food, query))
}

async function rerankWithGemini(query: string, candidates: Food[]): Promise<Food[]> {
  if (candidates.length < 2) return candidates
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return candidates
  const compact = candidates.map((food, index) => ({ id: index, name: food.name, brand: food.brand, servingSize: food.servingSize, source: food.foodSource, verified: Boolean(food.isVerified) }))
  const prompt = `You rank food search candidates. Query: ${JSON.stringify(query)}\nReturn ONLY a JSON array of candidate id numbers, best match first. Use every id exactly once. Prefer exact food identity and normal edible forms. Prefer Athlete Reload verified and USDA generic foods when relevance is comparable. Do not favor keyword-stuffed, implausible, or unrelated branded products. Candidates: ${JSON.stringify(compact)}`
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) })
    if (!response.ok) return candidates
    const payload = await response.json()
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('') ?? ''
    const order = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
    if (!Array.isArray(order)) return candidates
    const used = new Set<number>()
    const ranked = order.map(Number).filter((id: number) => Number.isInteger(id) && id >= 0 && id < candidates.length && !used.has(id) && used.add(id)).map((id: number) => candidates[id])
    return [...ranked, ...candidates.filter((_, id) => !used.has(id))]
  } catch { return candidates }
}

async function searchUsda(query: string): Promise<Food[]> {
  const apiKey = Deno.env.get('USDA_FOODDATA_API_KEY')
  if (!apiKey) return []
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', '50')
  url.searchParams.append('dataType', 'Foundation')
  url.searchParams.append('dataType', 'SR Legacy')
  url.searchParams.append('dataType', 'Branded')
  const response = await fetch(url)
  if (!response.ok) return []
  const payload = await response.json()
  return (payload.foods ?? []).map(normalizeUsda).filter((food: Food) => food.name)
}

async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('json', '1')
  url.searchParams.set('search_terms', query)
  url.searchParams.set('page_size', '20')
  url.searchParams.set('fields', 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments')
  const response = await fetch(url)
  if (!response.ok) return []
  const payload = await response.json()
  return (payload.products ?? []).map(normalizeOff).filter((food: Food) => food.name)
}

function normalizeUsda(food: any): Food {
  const nutrients = new Map((food.foodNutrients ?? []).map((item: any) => [String(item.nutrientName).toLowerCase(), { value: Number(item.value ?? 0), unit: String(item.unitName ?? '').toLowerCase() }]))
  const find = (...names: string[]) => { for (const name of names) { const nutrient = nutrients.get(name); if (nutrient) return nutrient.value } return 0 }
  const energy = nutrients.get('energy')
  const energyKcal = energy?.unit.includes('kj') ? Number(energy.value / 4.184) : Number(energy?.value ?? 0)
  const servingSize = food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : '100 g'
  const servingGrams = getServingGrams(food.description, servingSize)
  const factor = servingGrams ? servingGrams / 100 : 1
  const scaled = (value: number) => Math.round(value * factor * 10) / 10
  return {
    name: food.description ?? 'Unnamed food', brand: food.brandOwner ?? food.brandName ?? '', barcode: food.gtinUpc ?? '', foodSource: 'USDA FoodData Central',
    servingSize, calories: Math.round(energyKcal * factor), protein: scaled(find('protein')), carbohydrates: scaled(find('carbohydrate, by difference')), fats: scaled(find('total lipid (fat)')), fiber: scaled(find('fiber, total dietary')), sugar: scaled(find('sugars, total including nlea')), saturatedFat: scaled(find('fatty acids, total saturated')), polyunsaturatedFat: scaled(find('fatty acids, total polyunsaturated')), monounsaturatedFat: scaled(find('fatty acids, total monounsaturated')), transFat: scaled(find('fatty acids, total trans')), cholesterol: scaled(find('cholesterol')), sodium: scaled(find('sodium, na')), potassium: scaled(find('potassium, k')), calcium: scaled(find('calcium, ca')), iron: scaled(find('iron, fe')), vitaminA: scaled(find('vitamin a, rae')), vitaminC: scaled(find('vitamin c, total ascorbic acid')), vitaminD: scaled(find('vitamin d (d2 + d3)')), vitaminE: scaled(find('vitamin e (alpha-tocopherol)')), vitaminK: scaled(find('vitamin k (phylloquinone)')),
  }
}

function getServingGrams(name: string, serving: string) {
  const explicit = String(serving).match(/(\d+(?:\.\d+)?)\s*g\b/i)
  if (explicit) return Number(explicit[1])
  const text = `${name} ${serving}`.toLowerCase()
  const count = Number(String(serving).match(/^(\d+(?:\.\d+)?)/)?.[1] || 1)
  if (text.includes('egg')) return count * 50
  if (text.includes('cup')) return count * 240
  if (text.includes('tbsp')) return count * 15
  if (text.includes('oz')) return count * 28.35
  return 0
}

function normalizeOff(product: any): Food {
  const n = product.nutriments ?? {}
  const servingGrams = Number(product.serving_quantity) || 100
  const factor = servingGrams / 100
  const scaled = (value: unknown) => Math.round(Number(value ?? 0) * factor * 10) / 10
  return { name: product.product_name ?? product.product_name_en ?? '', brand: product.brands ?? '', barcode: product.code ?? '', foodSource: 'Open Food Facts', servingSize: product.serving_size ?? '100 g', calories: Math.round(Number(n['energy-kcal_100g'] ?? 0) * factor), protein: scaled(n.proteins_100g), carbohydrates: scaled(n.carbohydrates_100g), fats: scaled(n.fat_100g), fiber: scaled(n.fiber_100g), sugar: scaled(n.sugars_100g), saturatedFat: scaled(n['saturated-fat_100g']), polyunsaturatedFat: scaled(n['polyunsaturated-fat_100g']), monounsaturatedFat: scaled(n['monounsaturated-fat_100g']), transFat: scaled(n['trans-fat_100g']), cholesterol: scaled(n.cholesterol_100g), sodium: scaled(n.sodium_100g), potassium: scaled(n.potassium_100g), calcium: scaled(n.calcium_100g), iron: scaled(n.iron_100g), vitaminA: scaled(n['vitamin-a_100g']), vitaminC: scaled(n['vitamin-c_100g']), vitaminD: scaled(n['vitamin-d_100g']), vitaminE: scaled(n['vitamin-e_100g']), vitaminK: scaled(n['vitamin-k_100g']) }
}

function rank(foods: Food[], query: string) {
  const seen = new Set<string>()
  return foods.filter((food) => { const key = `${food.name}|${food.brand}`.toLowerCase(); if (!nameMatches(food, query) || seen.has(key)) return false; seen.add(key); return true }).sort((a, b) => score(b, query) - score(a, query))
}

function score(food: Food, query: string) {
  const name = String(food.name).toLowerCase()
  const sourceBoost = food.foodSource === 'Athlete Reload verified' ? 80 : food.foodSource === 'USDA FoodData Central' ? 45 : 0
  if (name === query.toLowerCase()) return 100 + sourceBoost
  if (name.startsWith(`${query.toLowerCase()},`) || name.startsWith(`${query.toLowerCase()} `)) return 90 + sourceBoost
  if (name.includes(query.toLowerCase())) return 65 + sourceBoost
  return sourceBoost
}

function nameMatches(food: Food, query: string) {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const name = String(food.name).toLowerCase()
  return terms.every((term) => name.includes(term))
}

function isPlausibleFood(food: Food) {
  const calories = Number(food.calories ?? 0)
  const protein = Number(food.protein ?? 0)
  const carbohydrates = Number(food.carbohydrates ?? 0)
  const fats = Number(food.fats ?? 0)
  return Number.isFinite(calories) && Number.isFinite(protein) && Number.isFinite(carbohydrates) && Number.isFinite(fats)
    && calories >= 0 && calories <= 1_500
    && protein >= 0 && protein <= 100 && carbohydrates >= 0 && carbohydrates <= 100 && fats >= 0 && fats <= 100
    && protein + carbohydrates + fats <= 115
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
