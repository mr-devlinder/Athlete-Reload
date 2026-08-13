import { createClient } from 'npm:@supabase/supabase-js@2.110.9'
import { VERIFIED_FOOD_CURATOR_IDS } from './curatorIds.ts'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const externalSources = new Set(['opennutrition'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return json({ error: 'Please sign in again' }, 401)

  const body = await request.json()
  const isCurator = VERIFIED_FOOD_CURATOR_IDS.has(user.id)
  if (body?.action === 'status') return json({ isCurator })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  if (body?.action === 'record_usage') {
    const food = body?.food ?? {}
    const sourceType = String(food.sourceType ?? '')
    const sourceId = String(food.sourceId ?? '')
    if (!externalSources.has(sourceType) || !sourceId) return json({ recorded: false })
    const { error } = await admin.rpc('record_external_food_usage', {
      p_brand: String(food.brand ?? ''),
      p_display_name: String(food.name ?? '').trim(),
      p_source_id: sourceId,
      p_source_type: sourceType,
    })
    if (error) return json({ error: 'Unable to record food selection' }, 500)
    return json({ recorded: true })
  }

  if (!isCurator) return json({ error: 'This action is not available' }, 403)
  if (body?.action === 'list_usage') {
    const { data, error } = await admin.from('external_food_usage').select('*').order('selection_count', { ascending: false }).limit(100)
    if (error) return json({ error: 'Unable to load catalog usage' }, 500)
    return json({ foods: data ?? [] })
  }

  const validation = await validateFood(admin, body?.food)
  if (body?.action === 'validate') return json(validation, validation.valid ? 200 : 400)
  if (body?.action !== 'verify') return json({ error: 'Unknown action' }, 400)
  if (!validation.valid) return json(validation, 400)

  const food = validation.food!
  const record = {
    display_name: String(food.name),
    duplicate_fingerprint: validation.fingerprint,
    food,
    source_id: String(food.sourceId ?? '') || null,
    source_key: sourceKey(food),
    source_type: String(food.sourceType ?? 'manual'),
    verified_by: user.id,
  }
  const { error } = await admin.from('verified_foods').upsert(record, { onConflict: 'source_key' })
  if (error) return json({ error: 'Unable to save the verified food' }, 500)
  return json({ food: { ...food, foodSource: 'Athlete Reload verified', isVerified: true } })
})

async function validateFood(admin: any, rawFood: Record<string, unknown> = {}) {
  const food = sanitizeFood(rawFood)
  const errors: string[] = []
  if (!food.name) errors.push('A food name is required.')
  if (!Number(food.calories) && !Number(food.protein) && !Number(food.carbohydrates) && !Number(food.fats)) errors.push('Enter nutrition information before saving.')
  if (!food.standardServingSize) errors.push('A serving size is required.')
  const fingerprint = duplicateFingerprint(food)
  const { data } = await admin.from('verified_foods').select('id, display_name, food').eq('duplicate_fingerprint', fingerprint).limit(1)
  return { duplicate: data?.[0] ?? null, errors, fingerprint, food, valid: errors.length === 0 && !data?.length }
}

function sanitizeFood(food: Record<string, unknown> = {}) {
  const numeric = ['calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'transFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK']
  const standardServingSize = String(food.standardServingSize ?? food.servingSize ?? '1 serving').trim().slice(0, 80)
  const sourceType = externalSources.has(String(food.sourceType)) ? String(food.sourceType) : 'manual'
  const result: Record<string, unknown> = {
    barcode: String(food.barcode ?? '').replace(/\D/g, '').slice(0, 14), brand: String(food.brand ?? '').trim().slice(0, 180),
    foodSource: String(food.foodSource ?? 'Curator entry').slice(0, 80), name: String(food.name ?? '').trim().slice(0, 180),
    originalDescription: String(food.originalDescription ?? '').trim().slice(0, 300), servingSize: standardServingSize,
    standardServingSize, servingWeight: Math.max(0, Number(food.servingWeight ?? 0) || 0),
    servingWeightUnit: food.servingWeightUnit === 'mL' ? 'mL' : 'g', sourceId: String(food.sourceId ?? '').slice(0, 180), sourceType,
  }
  for (const key of numeric) result[key] = Math.max(0, Number(food[key] ?? 0) || 0)
  return result
}

function duplicateFingerprint(food: Record<string, unknown>) {
  return `${normalize(food.name)}|${normalize(food.brand)}|${normalize(food.standardServingSize)}`
}
function sourceKey(food: Record<string, unknown>) {
  const sourceId = String(food.sourceId ?? '')
  return String(sourceId ? `${food.sourceType}:${sourceId}` : food.barcode || duplicateFingerprint(food)).toLowerCase().replace(/\s+/g, ' ').trim()
}
function normalize(value: unknown) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
