import { createClient } from 'npm:@supabase/supabase-js@2.110.9'
import { VERIFIED_FOOD_CURATOR_IDS } from './curatorIds.ts'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const isCurator = VERIFIED_FOOD_CURATOR_IDS.has(user.id)
  const body = await request.json()
  if (body?.action === 'status') return json({ isCurator })
  if (body?.action !== 'verify' || !isCurator) return json({ error: 'Forbidden' }, 403)

  const food = sanitizeFood(body.food)
  if (!food.name) return json({ error: 'A food name is required' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { error } = await admin.from('verified_foods').upsert({ food, source_key: sourceKey(food), verified_by: user.id }, { onConflict: 'source_key' })
  if (error) return json({ error: error.message }, 500)
  return json({ food: { ...food, isVerified: true } })
})

function sanitizeFood(food: Record<string, unknown> = {}) {
  const numeric = ['calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'transFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK']
  const standardServingSize = String(food.standardServingSize ?? food.servingSize ?? '1 serving').slice(0, 80)
  const result: Record<string, unknown> = { barcode: String(food.barcode ?? ''), brand: String(food.brand ?? ''), foodSource: String(food.foodSource ?? ''), name: String(food.name ?? '').trim().slice(0, 180), servingSize: standardServingSize, standardServingSize, servingWeight: Math.max(0, Number(food.servingWeight ?? 0) || 0), servingWeightUnit: food.servingWeightUnit === 'mL' ? 'mL' : 'g' }
  for (const key of numeric) result[key] = Math.max(0, Number(food[key] ?? 0) || 0)
  return result
}

function sourceKey(food: Record<string, unknown>) {
  return String(food.barcode || `${food.name}|${food.brand}|${food.standardServingSize ?? food.servingSize}`).toLowerCase().replace(/\s+/g, ' ').trim()
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
