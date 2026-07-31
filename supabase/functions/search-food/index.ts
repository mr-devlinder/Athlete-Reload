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
      searchUsda(search),
      searchOpenFoodFacts(search),
    ])

    return json({ foods: rank([...foods[0], ...foods[1]], search).slice(0, 24) })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Food search failed' }, 502)
  }
})

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
  return { name: product.product_name ?? product.product_name_en ?? '', brand: product.brands ?? '', barcode: product.code ?? '', foodSource: 'Open Food Facts', servingSize: product.serving_size ?? '100 g', calories: n['energy-kcal_100g'] ?? 0, protein: n.proteins_100g ?? 0, carbohydrates: n.carbohydrates_100g ?? 0, fats: n.fat_100g ?? 0, fiber: n.fiber_100g ?? 0, sugar: n.sugars_100g ?? 0, saturatedFat: n['saturated-fat_100g'] ?? 0, polyunsaturatedFat: n['polyunsaturated-fat_100g'] ?? 0, monounsaturatedFat: n['monounsaturated-fat_100g'] ?? 0, transFat: n['trans-fat_100g'] ?? 0, cholesterol: n.cholesterol_100g ?? 0, sodium: n.sodium_100g ?? 0, potassium: n.potassium_100g ?? 0, calcium: n.calcium_100g ?? 0, iron: n.iron_100g ?? 0, vitaminA: n['vitamin-a_100g'] ?? 0, vitaminC: n['vitamin-c_100g'] ?? 0, vitaminD: n['vitamin-d_100g'] ?? 0, vitaminE: n['vitamin-e_100g'] ?? 0, vitaminK: n['vitamin-k_100g'] ?? 0 }
}

function rank(foods: Food[], query: string) {
  const seen = new Set<string>()
  return foods.filter((food) => { const key = `${food.name}|${food.brand}`.toLowerCase(); if (!food.name || seen.has(key)) return false; seen.add(key); return true }).sort((a, b) => score(b, query) - score(a, query))
}

function score(food: Food, query: string) {
  const name = String(food.name).toLowerCase()
  if (name === query.toLowerCase()) return 100
  if (name.startsWith(`${query.toLowerCase()},`) || name.startsWith(`${query.toLowerCase()} `)) return 90
  if (name.includes(query.toLowerCase())) return 65
  return 10
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
