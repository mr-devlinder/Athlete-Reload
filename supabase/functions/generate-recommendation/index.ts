const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOrigins = new Set([
  'http://localhost:4173',
  'http://localhost:5173',
  'https://mr-devlinder.github.io',
  ...configuredOrigins,
])

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('Origin')
  if (origin && !allowedOrigins.has(origin)) return null
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Origin': origin ?? 'https://mr-devlinder.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

type Recommendation = {
  schemaVersion: number
  action: string
  avoid: string[]
  breakdown: Array<{ label: string; value: number }>
  during: string[]
  focus: string[]
  intensity: string
  label: string
  nextEventWarning: string
  preparation: string[]
  reassess: string[]
  recovery: string[]
  reasons: string[]
  score: number
  summary: string
  tone: 'danger' | 'warning' | 'caution' | 'ready'
  recoverySteps?: Array<{ title: string; why: string; when: string; id?: string }>
  timeline?: Array<{ title: string; items: string[] }>
  routine?: { title: string; summary: string; durationMinutes: number; painAware: boolean; exercises: any[] }
  reportSections?: Array<{ id: string; title: string; summary: string; items: string[]; action?: string; actionLabel?: string }>
  contextFactors?: string[]
  contextSnapshot?: Record<string, unknown>
  targets?: Record<string, unknown>
}

const recommendationModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']

Deno.serve(async (request) => {
  let stage = 'request_validation'
  const corsHeaders = getCorsHeaders(request)
  if (!corsHeaders) return new Response('Origin not allowed', { status: 403 })
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!geminiApiKey) {
    return jsonResponse({ error: 'Missing GEMINI_API_KEY secret' }, 503, corsHeaders)
  }

  try {
    stage = 'authenticate_request'
    if (!(await hasValidSession(request))) {
      return jsonResponse({ error: 'Authentication required' }, 401, corsHeaders)
    }
    stage = 'parse_request'
    const body = await request.json()
    if (!(await consumeRateLimit(request))) {
      return jsonResponse({ error: 'Too many AI requests. Please wait a minute and try again.' }, 429, corsHeaders)
    }
    if (body?.requestType === 'voice_transcribe') {
      const transcript = await transcribeAudio(geminiApiKey, body)
      return jsonResponse({ transcript }, 200, corsHeaders)
    }
    if (body?.requestType === 'voice_extract') {
      const extractionResponse = await generateGeminiJson(geminiApiKey, buildVoiceExtractionPrompt(body))
      return jsonResponse({ extraction: extractionResponse }, 200, corsHeaders)
    }
    stage = 'gemini_request'
    const { response, model } = await requestGemini(geminiApiKey, [{ text: buildPrompt(body) }], true)
    if (!response.ok) {
      const detail = await response.text()
      return jsonResponse({ error: 'Gemini request failed', detail }, 502, corsHeaders)
    }

    stage = 'parse_gemini_response'
    const data = await response.json()
    const text = extractGeminiText(data)
    stage = 'normalize_recommendation'
    const recommendation = applyDeterministicGuard(
      normalizeRecommendation(parseJsonResponse(text), body),
      body?.deterministicRecommendation,
    )

    return jsonResponse({ recommendation, provider: 'gemini', source: 'gemini', model }, 200, corsHeaders)
  } catch (error) {
    const correlationId = crypto.randomUUID()
    console.error(JSON.stringify({
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stage,
    }))
    const stageStatus = {
      parse_request: 520,
      authenticate_request: 401,
      build_prompt: 524,
      gemini_request: 521,
      parse_gemini_response: 522,
      normalize_recommendation: 523,
    }[stage] ?? 500
    return jsonResponse({
      error: 'Unable to generate recommendation',
      correlationId,
    }, stageStatus, corsHeaders)
  }
})

async function hasValidSession(request: Request) {
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = request.headers.get('Authorization') ?? ''
  if (!projectUrl || !anonKey || !authorization.startsWith('Bearer ')) return false
  const response = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  return response.ok
}

function applyDeterministicGuard(aiRecommendation: Recommendation, deterministic: any) {
  if (!deterministic || typeof deterministic !== 'object') return aiRecommendation
  const safetyLocked = Boolean(deterministic.redFlag)
    || ['limit', 'stop_and_seek_help'].includes(String(deterministic.status ?? ''))
    || deterministic.label === 'Stop and Check In'
  const deterministicScore = Math.round(Number(deterministic.score) || 0)
  const aiScore = Number(aiRecommendation.score)
  const score = safetyLocked || !Number.isFinite(aiScore)
    ? deterministicScore
    : Math.max(0, Math.min(100, Math.round(Math.max(deterministicScore - 12, Math.min(deterministicScore + 12, aiScore)))))
  const deterministicAvoid = Array.isArray(deterministic.avoid) ? deterministic.avoid : []
  const aiAvoid = Array.isArray(aiRecommendation.avoid) ? aiRecommendation.avoid : []
  const avoid = [...new Set([...aiAvoid, ...deterministicAvoid])].slice(0, 6)

  return {
    ...aiRecommendation,
    schemaVersion: Number(deterministic.schemaVersion) || aiRecommendation.schemaVersion,
    action: safetyLocked ? String(deterministic.primaryAction?.instruction ?? deterministic.action ?? aiRecommendation.action) : aiRecommendation.action,
    avoid,
    breakdown: safetyLocked && Array.isArray(deterministic.breakdown) ? deterministic.breakdown : aiRecommendation.breakdown,
    focus: safetyLocked && Array.isArray(deterministic.focus) ? deterministic.focus : aiRecommendation.focus,
    intensity: safetyLocked ? String(deterministic.intensity ?? aiRecommendation.intensity) : aiRecommendation.intensity,
    label: safetyLocked ? String(deterministic.label ?? aiRecommendation.label) : aiRecommendation.label,
    reasons: safetyLocked && Array.isArray(deterministic.contextFactors) ? deterministic.contextFactors : aiRecommendation.reasons,
    score,
    tone: safetyLocked ? deterministic.tone ?? aiRecommendation.tone : aiRecommendation.tone,
    reportSections: safetyLocked && Array.isArray(deterministic.reportSections) ? deterministic.reportSections : aiRecommendation.reportSections,
    contextFactors: safetyLocked && Array.isArray(deterministic.contextFactors) ? deterministic.contextFactors : aiRecommendation.contextFactors,
  }
}

async function generateGeminiJson(apiKey: string, input: string) {
  const { response } = await requestGemini(apiKey, [{ text: input }], true)
  if (!response.ok) throw new Error('Gemini request failed')
  return parseJsonResponse(extractGeminiText(await response.json()))
}

async function transcribeAudio(apiKey: string, payload: any) {
  const audioBase64 = String(payload?.audioBase64 ?? '')
  const mimeType = String(payload?.mimeType ?? 'audio/webm')
  if (!audioBase64 || audioBase64.length > 20_000_000 || !mimeType.startsWith('audio/')) {
    throw new Error('Invalid or oversized audio recording')
  }

  const { response } = await requestGemini(apiKey, [
    { text: 'Transcribe this athlete voice note faithfully. Return only the spoken words, with no commentary.' },
    { inline_data: { data: audioBase64, mime_type: mimeType } },
  ], false)
  if (!response.ok) throw new Error('Audio transcription failed')
  return extractGeminiText(await response.json()).trim()
}

async function requestGemini(apiKey: string, parts: any[], jsonOutput: boolean) {
  let response: Response | null = null
  for (const model of recommendationModels) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        ...(jsonOutput ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    })
    if (response.ok || ![429, 503].includes(response.status)) return { response, model }
  }
  return { response: response!, model: recommendationModels[recommendationModels.length - 1] }
}

function extractGeminiText(data: any) {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text ?? '')
    .join('')
    .trim()
  if (text) return text
  throw new Error('Gemini response did not include text output')
}

async function consumeRateLimit(request: Request) {
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = request.headers.get('Authorization') ?? ''
  if (!projectUrl || !anonKey || !authorization) return false

  const response = await fetch(`${projectUrl}/rest/v1/rpc/consume_ai_request`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: 3, p_window_seconds: 60 }),
  })
  if (!response.ok) throw new Error('Unable to verify AI request limit')
  return response.json()
}

function buildVoiceExtractionPrompt(payload: any) {
  const isCheckout = payload.logType === 'checkout'
  return `
You extract only explicit athlete-reported details into JSON. Never invent details. Return ONLY valid JSON.

This is a ${isCheckout ? 'post-event checkout' : 'pre-event check-in'} voice note.
Transcript: ${JSON.stringify(payload.transcript ?? '')}

For each uncertain or unmentioned field, use null. Keep the original transcript in notes.
${isCheckout ? `
JSON shape:
{
  "actualMinutes": number|null,
  "difficulty": number|null,
  "participation": "Full"|"Modified"|"Partial"|"Did not participate"|null,
  "postFatigue": number|null,
  "postSoreness": number|null,
  "performanceRating": "Worse"|"Slightly worse"|"Normal"|"Better"|"Much better"|null,
  "mentalFocus": number|null,
  "motivation": number|null,
  "movementChanged": boolean|null,
  "newPain": boolean|null,
  "notes": string
}` : `
JSON shape:
{
  "energy": number|null,
  "fatigue": number|null,
  "soreness": number|null,
  "legHeaviness": number|null,
  "sleep": number|null,
  "sleepQuality": number|null,
  "stress": 0|1|2|3|4|5|null,
  "illnessSymptoms": 0|1|2|3|4|5|null,
  "expectedDifficulty": number|null,
  "notes": string
}`}
`
}

const readinessCalibrationGuidance = `
Readiness explanation calibration (the deterministic engine has already chosen the score):
- Higher is better. Energy and sleep quality use 0 worst to 5 best. Soreness, fatigue, leg heaviness, illness symptoms, and stress use 0 none/low to 5 severe/high. Never treat 5/5 soreness or fatigue as favorable.
- Treat 0-100 as a continuous scale, not a set of buckets. First form a holistic readiness judgment, then place it precisely within the appropriate region according to the number, severity, duration, event relevance, and confidence of favorable and adverse signals. Do not calculate from a fixed deduction table.
- Use the full range and do not default to 85, 88, 92, or another familiar number. Adjacent scores should represent small real differences; larger evidence changes should move the score farther.
- Evaluate five dimensions before choosing the score: current physical state, sleep and mental state, active pain/illness and movement function, fit for this event's demands, and supported recent workload/preparation context. Current direct evidence carries the most weight.
- 100 is the rare ceiling: every relevant current input is unequivocally optimal, sleep and recovery are exceptional, there is no pain/illness or functional concern, preparation evidence is fully supportive when available, recent context adds no concern, and there is no meaningful contradictory or uncertain key signal. Do not award 100 merely because the sliders look generally good.
- 97-99 means an exceptionally clean check-in that is almost indistinguishable from ideal, with at most negligible uncertainty and no actionable limitation.
- 94-96 means excellent readiness with one minor but real consideration that does not require a meaningful participation change.
- 90-93 means very strong readiness with a small current limitation or supported preparation concern worth mentioning.
- 80-89 means strong readiness with one or two minor limitations that deserve a small adjustment but do not materially change participation.
- 65-79 means mixed readiness: at least one meaningful concern such as elevated fatigue, soreness, heaviness, stress, poor sleep, illness, preparation uncertainty, or current pain should change warm-up, load, monitoring, or participation.
- 45-64 means clearly reduced readiness with multiple adverse signals or one substantial concern requiring a controlled or modified plan.
- 20-44 means very limited readiness with serious current concerns, major functional effects, or multiple strongly adverse signals.
- 1-19 is exceptionally poor readiness with severe or compounding red flags and little evidence that normal participation is appropriate.
- 0 is the rare floor: reserve it for the most extreme, unequivocal combination of severe current red flags and inability to participate normally. A single bad input must never produce 0.
- Zero reported pain is favorable but cannot cancel severe fatigue, soreness, illness, poor sleep, or other adverse inputs. Event difficulty alone does not lower readiness.
- Personal baselines may soften or strengthen an interpretation, but never reverse the direction of a scale or erase an extreme current value.
- Missing optional food or hydration logs are neutral and must not be deducted. Missing a key readiness answer may reduce confidence, but should affect the score only when that uncertainty materially prevents a reliable event-readiness judgment.
- Before returning JSON, verify that score, label, tone, summary, concerns, and event plan tell the same story. Do not describe preparation as excellent when the score inputs contain meaningful adverse signals.
`

const checkoutCalibrationGuidance = `
Post-event recovery explanation calibration (the deterministic engine has already chosen the score):
- Higher is better and means the athlete handled the completed event well with a more favorable immediate recovery outlook. It is not a workload score and not a medical clearance score.
- Post-event fatigue and soreness use 0 none/low to 5 severe/high. Difficulty uses 0 easy to 10 maximal. Never treat high fatigue, high soreness, worsening/new pain, changed movement, cramping, concerning symptoms, or stopping early as favorable.
- Treat 0-100 as continuous. Place the score precisely according to participation, workload response, fatigue/soreness severity, pain and movement changes, symptoms, performance response, and recovery window; do not use a fixed deduction table or default number.
- 90-100 requires a completed event with a normal or better body response, low fatigue/soreness, no concerning symptoms, and no meaningful recovery complication.
- 80-89 indicates a generally good response with ordinary manageable fatigue or one minor recovery need.
- 65-79 indicates a demanding response or multiple moderate recovery needs that should change the immediate plan.
- 45-64 indicates substantial fatigue/soreness, incomplete participation, worsened symptoms, changed movement, or another significant recovery concern.
- 0-44 is reserved for severe symptoms, major functional change, or a response needing prompt adult or professional follow-up.
- Reserve 100 for a rare unequivocally ideal post-event response and 0 for a rare extreme response with severe compounding concerns. Ordinary good or bad sessions should not reach either endpoint.
- Verify that score, recovery label, tone, summary, and priorities are internally consistent.
`

function buildPrompt(payload: unknown) {
  if ((payload as any)?.requestType === 'post_checkout') {
    return buildCompactPostCheckoutPrompt(payload)
  }

  if ((payload as any)?.requestType === 'recovery_plan') {
    return buildRecoveryPlanPrompt(payload)
  }

  if ((payload as any)?.requestType === 'mobility_routine') {
    return buildMobilityRoutinePrompt(payload)
  }

  if ((payload as any)?.requestType === 'quick_checkin') {
    return buildQuickCheckInPrompt(payload)
  }

  return `
You are Athlete Reload's training readiness assistant for student athletes.
Never use, repeat, or address the athlete by their name or display name. Write directly using "you" and "your" only.
${unitPreferenceDirective(payload)}

The supplied deterministicRecommendation is a safety baseline, not the final recommendation. You own the personalized readiness score, event-specific label, action plan, focus items, and report sections. Use the full athlete and event context so materially different check-ins produce materially different plans. The server will keep your score within a safe range of the deterministic baseline and will preserve any hard stop or limit.
Deterministic safety baseline:
${JSON.stringify((payload as any)?.deterministicRecommendation ?? null)}

Return ONLY valid JSON. No markdown. No extra commentary.

Use the athlete's current check-in, selected event, athlete profile, current nutrition/preparation context, recentEvents, previousCheckout, previousRecoveryCompletion, generatedAt, and future schedule to create a recommendation for this specific event. Recent events establish workload and response patterns, but current information remains most important. This is not a medical diagnosis. Be practical: do not default to "no training" for very low pain unless symptoms are red flags.

Current pain rule: checkIn.painMap and checkIn.pain are the sole source of truth for active pain and restrictions. History may identify patterns but must never turn resolved pain into a current restriction.

Calibration principles:
- Infer readiness holistically from the current check-in, this event's demands, preparation status, personal baseline, recent workload/recovery, profile, and schedule. The bands below are interpretation anchors, not a fixed deduction table.
${readinessCalibrationGuidance}
- A readiness score describes how prepared this athlete appears for this event at this time. Event difficulty alone is not poor readiness, and one minor concern must not dominate otherwise strong information.
- Weight evidence by relevance and confidence. Current symptoms outweigh history; a well-established personal baseline is more informative than a generic assumption. Confidence and readiness are different: missing optional logs reduce evidence, not readiness, and must not cap an otherwise exceptional score.
- Keep the score, label, summary, concerns, and recommendations internally consistent. In breakdown, include only the 2-6 factors that materially moved the AI's assessment; favorable values are positive, adverse values are negative, and neutral or unknown values are omitted.
- Escalate only genuine red flags such as severe or rapidly worsening pain, pain at rest, inability to bear weight, obvious swelling/deformity, neurological symptoms, chest/breathing symptoms, fainting/confusion, head-injury symptoms, or suspected bone stress injury.
- Avoid/focus should be practical instructions for this event, not generic wellness filler.
- Give an event plan, not a binary clearance verdict. Explain what the athlete can do, what to change, how to warm up, when to reassess, and what to do afterward.
- Make each list item a complete, specific instruction of about 8-20 words.
- Keep the visible report concise: each section summary should be one short sentence and each section should contain at most three non-repeated items.
- Legacy preparation/during/recovery arrays are storage compatibility only. Put the visible, non-duplicated report content in reportSections.
- Do not use numeric pain cutoffs or phrases such as "exceeds 3/10" in the recommendation. Describe meaningful changes plainly, such as sharp pain, worsening symptoms, altered movement, or inability to perform the motion normally.
- Use the event type, sport, association, duration, intensity, surface, environment, and every selected pain area together. Tailor each modification to the athlete's sport and the actual event demands: upper-body symptoms may affect overhead work, throwing, catching, lifting, bracing, or contact; lower-body symptoms may affect sprinting, jumping, cutting, kicking, landing, or lifting; trunk symptoms may affect rotation, bracing, and contact. Head or neck symptoms require the red-flag rules.
- Use sportContext workload only when values are present. Translate exposure, distance, yardage, throwing, jumping, or contact details into practical preparation and monitoring; never use them to diagnose or predict injury risk.
- Treat an Other activity as sport-neutral. Use its activity name, duration, planned load, surface/environment, and any prior checkout effort without applying the athlete's primary-sport position or sport-specific workload assumptions.
- When scheduleContext includes a Rest Day, describe it only as planned rest/recovery context. A scheduled Rest Day is not proof that the athlete is recovered and must never override current wellness, pain, or red-flag information.
- When event.tournament is present, account for the tournament date range and its scheduled games. A short turnaround to the next match should favor practical recovery, symptom monitoring, and avoiding unnecessary extra work; do not treat a tournament game like an isolated event.
- Consider expected duration, surface, indoor/outdoor environment, location/weather when present, expected difficulty, leg heaviness, numeric illness symptoms (0 none, 5 unwell), sleep quality (5 best, 0 worst), numeric stress (0 low, 5 high), and every selected pain area's type, trigger, trend, and affected movement. If previousCheckout is present, use only its session difficulty, duration, completion, physical response, pain change, performance/focus data, saved recoveryPlan action statuses or feedback, and previousRecoveryCompletion as the prior-session context.
- Use eventPreparationContext as the only fuel and hydration assessment for this check-in. When loggedNutrition is present, use its Breakfast, Lunch, Dinner, and Snacks breakdown plus totals in relation to event timing. When loggedHydrationMl is present, use it with the time-adjusted hydration status. These are broad event-preparation signals, not full-day target completion scores.
- When loggedNutrition or loggedHydrationMl is null, that category is unlogged. Do not score it positively or negatively, do not call zero intake, do not mention a deficit, and do not let missing logs lower or cap readiness. Give only a neutral normal-baseline suggestion if useful.
- For early-morning events or events shortly after waking, explicitly state that full-day food and hydration progress is not expected. Missing logs mean insufficient data, not under-fueled or underhydrated.
- Respect eventPreparationContext timing. When an event begins soon, suggest only gradual sipping and, if useful, a small familiar snack if tolerated; never recommend rapidly drinking a large amount or eating a large meal to catch up.
- Use event duration, planned load, recent fuel/hydration evidence, prior-evening evidence when available, and earlierCompletedEvents to tailor practical event preparation. Do not require exact meal counts, perfect nutrient timing, or exact foods.
- If eventPreparationContext is not applicable for a Rest Day or Recovery Day, do not generate event-fueling analysis.
- Use the athlete profile's sport, position, training style, dominant side, and optional body context to tailor activity choices. Do not use optional height, weight, or gender data to judge body size, health, or worth; use it only as limited context alongside the sport, event, symptoms, and the athlete's own history.
- When baseline is present and its confidence is Building or Established, use it as one balanced context signal. Explain meaningful differences from the athlete's usual pattern without treating one unusual value as proof of injury or using baseline data to overrule red-flag symptoms.
- Base the recommendation on the selected event type and planned intensity. A high-intensity game, gym session, recovery day, and team practice should not get the same advice.
- Use the athlete profile's sport, position, training style, and dominant side when they are provided. The same pain can affect participation differently by sport and event: shoulder symptoms matter more for volleyball serving or hitting than for a lower-body gym session, while a knee issue matters more for jumping, cutting, and running.
- Do not assume an athlete must stop all activity because one body area hurts. Explain which movements or demands of this specific event are affected and what can remain controlled if there are no red flags.
- Use the exact injuryType, painType, and hurtsWhen values in the athlete data. Treat concussion concern, suspected bone stress, numbness, tingling, shooting pain, instability, breathing pain, head/neck symptoms, worsening swelling, and meaningful pain at rest as higher-risk patterns. Low-level tightness, dull ache, overuse soreness, bruises, blisters, cuts/scrapes, or cramps should usually get specific modifications instead of automatic no-training advice.
- This response powers a compact event-decision modal. Lead with a decisive, event-specific label and one immediately usable primary action. The first three reasons must be the strongest plain-language signals from this check-in, event demand, and athlete context; do not use generic filler.
- Prioritize at most three visible planning areas after the decision: current pain/safety when present, warm-up or load control, and the most relevant of hydration, fuel, fatigue, or performance. Keep deeper context in the remaining report sections for the full saved plan.
- Evaluate every supplied current check-in field before deciding: energy, fatigue, soreness, stress, sleep duration, sleep quality, leg heaviness when asked, illness impact, pain map and pain detail fields, plus event preparation, baseline, recent load, and schedule context. A default healthy value is still evidence, but it must not erase a meaningful adverse signal elsewhere.

JSON shape:
{
  "score": number from 0 to 100,
  "label": an event-specific phrase such as "Full Participation", "Modified Participation", "Full Session", "Controlled Session", "Recovery Session", or "Stop and Check In",
  "tone": "ready" | "caution" | "warning" | "danger",
  "intensity": short training intensity phrase,
  "summary": one short sentence explaining the decision,
  "action": one specific concise instruction telling the athlete what to do immediately before or during this event,
  "avoid": array of 0 to 4 specific things to avoid,
  "focus": array of 2 to 4 specific things to focus on,
  "preparation": array of 3 to 5 ordered warm-up or preparation instructions,
  "during": array of 3 to 5 instructions for the event's drills, reps, pace, contact, or intensity,
  "recovery": array of 2 to 4 specific after-event actions,
  "contextFactors": array of 2-8 short labels naming only the supplied factors that materially shaped this plan,
  "reportSections": array in this order: readiness-status, warm-up-focus, hydration-target, fueling-target, during-event-fueling only when relevant, performance-focus, pain-guidance only with current pain, fatigue-load only when relevant, environment-guidance only with reliable environment data, event-preparation, pre-event-timeline. Each item is {"id":"exact-id","title":"display title","summary":"specific 1-2 sentence interpretation","items":["0-4 non-duplicated actionable details"]}. Use athleteContext.targets as authoritative ranges; never invent or alter numeric targets. The timeline uses only relevant steps labeled 2-3 hours before, 30-60 minutes before, warm-up, or during event. Recommendations must change materially with sport, position, event type, duration, intensity, current symptoms, environment, and turnaround.
  "reasons": array of 1 to 5 concrete reasons,
  "breakdown": array of score factors like [{"label":"Sleep","value":-8}]
}

Athlete data:
${JSON.stringify(payload, null, 2)}
`
}

function buildCompactPostCheckoutPrompt(payload: unknown) {
  return `
You are Athlete Reload's post-event recovery assistant for a student athlete.
Never use, repeat, or address the athlete by their name or display name. Write directly using "you" and "your" only.
${unitPreferenceDirective(payload)}
The supplied deterministicRecommendation is authoritative. Copy its score, status, label, tone, reasons, actions, warnings, and safety limits exactly. Your role is limited to concise explanation and organization.
Authoritative deterministic recommendation:
${JSON.stringify((payload as any)?.deterministicRecommendation ?? null)}
The event has already ended. Create a practical recovery plan from only the supplied checkout data.
Do not give participation clearance for the completed event. Do not diagnose injuries.
Escalate new or worsening pain, changed movement, breathing trouble, dizziness, confusion, or severe symptoms to an adult, coach, athletic trainer, or medical professional.
${checkoutCalibrationGuidance}
Keep the response concise and easy to scan. Use one short sentence per summary and no more than three non-repeated items in any section.
Use nutritionContext mealBreakdown and hydrationMl only when hasFoodLogs or hasHydrationLogs is true. If a category is unlogged, omit it from the score and assessment rather than treating it as zero intake or a recovery failure.

Return ONLY valid JSON with this exact shape:
{
  "score": number from 0 to 100,
  "label": "a concise event-specific label derived from participation, completion, workload and body response; avoid judgmental language",
  "tone": "ready" | "caution" | "warning" | "danger",
  "intensity": "short recovery category",
  "summary": "one sentence",
  "action": "one concise recovery priority",
  "avoid": ["0 to 4 specific items"],
  "focus": ["2 to 5 specific items"],
  "preparation": ["1 to 2 immediate post-event actions"],
  "during": ["1 to 2 actions for the next two hours"],
  "recovery": ["3 to 5 ordered actions for tonight"],
  "reportSections": [
    {"id":"session-summary","title":"Session Summary","summary":"actual duration, effort, participation and expected-versus-actual comparison","items":[]},
    {"id":"recovery-status","title":"Recovery Status","summary":"Normal recovery, Higher recovery need, or Take extra care, followed by the main reason","items":[]},
    {"id":"hydration-recovery","title":"Hydration","summary":"use athleteContext.targets.recovery.rehydrationMl exactly when present; otherwise give a baseline without false precision","items":[]},
    {"id":"nutrition-recovery","title":"Nutrition","summary":"use athleteContext.targets.recovery carbohydrate/protein ranges exactly and choose snack or meal","items":[]},
    {"id":"cooldown","title":"Cooldown","summary":"short event-specific movement only when participation occurred","items":[]},
    {"id":"new-pain-soreness","title":"New Pain or Soreness","summary":"only current checkout symptoms and immediate action","items":[]},
    {"id":"next-few-hours","title":"Next Few Hours","summary":"short lead-in","items":["exactly 2-3 highest-value actions"]}
  ],
  "nextEventWarning": "short warning or empty string",
  "reasons": ["1 to 5 reasons tied to the checkout"],
  "breakdown": [{"label":"factor","value":0}]
}

Checkout context:
${formatPostCheckoutData(payload as any)}
`
}

function buildQuickCheckInPrompt(payload: any) {
  return `
You are Athlete Reload's quick check-in assistant for a student athlete.
Never use, repeat, or address the athlete by their name or display name. Write directly using "you" and "your" only.
${unitPreferenceDirective(payload)}
Use only the athlete's edited words below. Do not invent missing measurements or pretend the athlete answered the detailed check-in fields.
Create a practical event recommendation from the information that is actually present. Clearly state what is unknown and keep the plan conservative when important details are missing.
This is not medical advice or clearance. Direct the athlete to a parent, coach, athletic trainer, or qualified healthcare professional for red flags.
${readinessCalibrationGuidance}
Keep the visible recommendation concise: one short sentence per summary and no more than three non-repeated items per section.

Return ONLY valid JSON in the same recommendation shape used by the app, including action, label, summary, score, tone, preparation, during, recovery, reasons, avoid, focus, reassess, intensity, nextEventWarning, breakdown, contextFactors, and reportSections. reportSections may use only readiness-status, warm-up-focus, hydration-target, fueling-target, during-event-fueling when relevant, performance-focus, pain-guidance only when current pain was explicitly reported, fatigue-load, environment-guidance only with supplied data, event-preparation, and pre-event-timeline. Omit any section that cannot be supported by the athlete's words and supplied event context.

Quick check-in text:
${String(payload?.quickTranscript ?? '').trim()}
`
}


function formatPostCheckoutData(payload: any) {
  return [
    ['athleteProfile', payload?.athleteProfile],
    ['athleteContext', payload?.athleteContext],
    ['checkout', payload?.checkout],
    ['completedEvent', payload?.completedEvent],
    ['dailyWellness', payload?.dailyWellness],
    ['nutritionContext', payload?.nutritionContext],
    ['generatedAt', payload?.generatedAt],
    ['nextScheduledEvent', payload?.nextScheduledEvent],
    ['preCheckIn', payload?.preCheckIn],
    ['previousCheckout', payload?.previousCheckout],
    ['recentEvents', payload?.recentEvents],
    ['scheduleContext', payload?.scheduleContext],
    ['sportContext', payload?.sportContext],
  ].map(([label, value]) => `${label}: ${safeJson(value)}`).join('\n')
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return 'null'
  }
}

function unitPreferenceDirective(payload: any) {
  const unitSystem = payload?.athleteProfile?.unitSystem ?? payload?.athleteContext?.athlete?.unitSystem ?? 'imperial'
  return unitSystem === 'metric'
    ? 'Unit preference: Metric. Express hydration volumes in liters (L), converting supplied mL targets without changing the physical amount. Use metric units for every other measurement.'
    : 'Unit preference: Imperial. Express hydration volumes in fluid ounces (fl oz), converting supplied mL targets without changing the physical amount. Use imperial units for every other measurement.'
}

function buildRecoveryPlanPrompt(payload: unknown) {
  return `
You are Athlete Reload's post-event recovery-planning assistant for a student athlete.
Never use or repeat the athlete's name. Write directly using "you" and "your".
${unitPreferenceDirective(payload)}
Return ONLY valid JSON. No markdown or commentary.

A Recovery Plan is post-event guidance about fueling, hydration, sleep, the near-term timeline, the next event, and symptom monitoring. It is NOT a mobility routine. Do not output exercises, movement IDs, a routine field, stretches, sets, reps, or timers. You may say comfortable mobility could be useful, but the application owns that separate experience.

Use only supplied facts. Never estimate exact sweat or fluid loss. Current pain comes only from currentRecoveryContext; historical pain does not create a current restriction. Do not diagnose. For sharp, worsening, unstable, numb, tingling, swollen, movement-changing, or weight-bearing symptoms, provide clear stop-and-tell-an-adult or qualified-professional guidance. A scheduled Rest Day is context, not proof that recovery occurred. Keep sections concise and non-duplicative.

Return this shape:
{
  "label":"Immediate recovery" | "Extra recovery" | "Monitor symptoms" | "Tell an adult / trainer",
  "tone":"ready" | "caution" | "warning" | "danger",
  "summary":"one short sentence",
  "action":"one short priority paragraph",
  "contextFactors":["2-8 supplied factors"],
  "reportSections":[
    {"id":"recovery-status","title":"Recovery Status","summary":"demand and primary drivers","items":[]},
    {"id":"recovery-priorities","title":"Recovery Priorities","summary":"ranked priorities","items":["priority 1","priority 2"]},
    {"id":"active-recovery-rest","title":"Active Recovery or Rest","summary":"what fits now and why","items":[]},
    {"id":"nutrition-guidance","title":"Nutrition Guidance","summary":"practical refueling goal","items":[]},
    {"id":"hydration-guidance","title":"Hydration Guidance","summary":"practical fluid context","items":[]},
    {"id":"sleep-rest-guidance","title":"Sleep and Rest Guidance","summary":"specific rest priority","items":[]},
    {"id":"pain-guidance","title":"Pain-Specific Guidance","summary":"only with current pain","items":[]},
    {"id":"recovery-timeline","title":"Recovery Timeline","summary":"today through the next checkpoint","items":[]},
    {"id":"next-event-impact","title":"Tomorrow or Next Event","summary":"only with a future event","items":[]}
  ],
  "nextEventWarning":"","recovery":[],"preparation":[],"during":[],"reasons":[],"score":0,"breakdown":[]
}

Athlete and event data:
${JSON.stringify(payload, null, 2)}
`
}

function buildMobilityRoutinePrompt(payload: unknown) {
  const routineType = stringOrFallback((payload as any)?.planType, 'session_recovery')
  const routineDirective = getRecoveryPlanTypeDirective(routineType, (payload as any)?.targetedAreas)
  const recoveryCatalog = Array.isArray((payload as any)?.recoveryCatalog) ? (payload as any).recoveryCatalog : []

  return `
You are Athlete Reload's mobility-routine assistant for a student athlete.
Never use or repeat the athlete's name. Write directly using "you" and "your".
Return ONLY valid JSON. No markdown or commentary.

Create one physical Mobility Routine. Do not create a Recovery Plan and do not output fueling, hydration, sleep, recovery priorities, readiness scores, report sections, or a recovery timeline.

Routine contract:
- Requested type: ${routineType}. ${routineDirective}
- Treat timeAvailable as the exact target budget. The application counts unilateral work on both sides, repetition tempo, and transitions, then validates the result within 10 percent.
- Select only stable IDs from the supplied eligible catalog. Every supplied movement already passed equipment, routine-type, target-area, and current-pain filtering.
- Never invent IDs, names, instructions, equipment, contraindications, or substitutions. Do not repeat an ID.
- Prefer a coherent sequence with few unnecessary position changes.
- A warm-up must favor active mobility and activation, not a sequence dominated by long static holds.
- Light recovery must stay gentle and must not include plyometrics or demanding conditioning.
- Lower-body and upper-body routines must keep at least two thirds of their movements in the requested region.
- Current pain comes only from currentRecoveryContext. Do not diagnose or select a filtered-out movement.
- Use recentRoutineSequences and recentRoutineExerciseNames to vary the opening and order when equally useful choices exist.
- Prescriptions must stay within each catalog item's defaults and model. The application performs final safety and duration validation and may use a deterministic fallback.
- For every movement, write howToPerform as one or two concrete sentences that a beginner can follow without knowing the exercise name. State the starting position, exactly what moves, what stays still, and how the repetition or hold ends. Never use generic wording such as "set up and perform the movement."

Return exactly this shape:
{
  "routine": {
    "routineName": "short type-specific name",
    "goal": "one sentence",
    "routineType": "${routineType}",
    "estimatedDurationSeconds": 600,
    "exercises": [
      {
        "movementId": "one supplied catalog id",
        "prescription": {"type":"reps","reps":8,"sets":1,"restSeconds":0},
        "howToPerform": "One or two concrete beginner-friendly technique sentences.",
        "rationale": "one short reason"
      }
    ]
  }
}

Eligible movement catalog:
${JSON.stringify(recoveryCatalog)}

Request context:
${JSON.stringify(payload, null, 2)}
`
}
function getRecoveryPlanTypeDirective(routineType: string, targetedAreas: unknown) {
  const targets = stringArray(targetedAreas).join(', ') || 'the selected areas'
  const directives: Record<string, string> = {
    session_recovery: 'Build a gentle sequence around the latest completed session and current body response without adding meaningful fatigue.',
    full_body: 'Balance useful ankle, hip, trunk, upper-back, and shoulder movement.',
    lower_body: 'Keep the sequence primarily in the ankles, calves, knees, hips, hamstrings, quadriceps, glutes, and groin.',
    upper_body: 'Keep the sequence primarily in the wrists, shoulders, scapular region, upper back, thoracic spine, and neck.',
    flexibility: 'Use mostly controlled, comfortable flexibility work. Do not force end range.',
    warm_up: 'Progress from active range into low-fatigue activation. Avoid long passive holds.',
    light_recovery: 'Use only easy circulation, gentle mobility, and low-demand activation. Exclude plyometrics and conditioning.',
    custom_mobility: `Focus on ${targets}, include directly related joints, and omit unrelated filler.`,
  }
  return directives[routineType] ?? directives.session_recovery
}
function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
}

function parseJsonResponse(value: string) {
  const cleaned = stripJsonFence(value)

  try {
    return JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('AI response did not contain a complete JSON object')
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
  }
}

function normalizeRecommendation(value: any, payload?: any): Recommendation {
  value = redactAthleteName(value, payload?.athleteProfile)
  const calibration = getSafetyCalibration(payload)
  const score = clampNumber(value.score, 0, 100)
  const calibratedScore = score
  const action = stringOrFallback(value.action, 'Use a conservative modified session and reassess after warm-up.')
  const prepare = stringArray(value.preparation).slice(0, 5)
  const during = stringArray(value.during).slice(0, 5)
  const recovery = stringArray(value.recovery).slice(0, 5)
  const sectionFallbacks = getSectionFallbacks(payload)
  const tone = calibration.tone ?? (calibratedScore >= 80
    ? 'ready'
    : calibratedScore >= 65
      ? 'caution'
      : calibratedScore >= 45
        ? 'warning'
        : 'danger')

  return {
    schemaVersion: 2,
    contextFactors: stringArray(value.contextFactors).slice(0, 8),
    contextSnapshot: payload?.athleteContext ?? {},
    targets: payload?.athleteContext?.targets ?? {},
    goal: stringOrFallback(value?.goal, getRoutineGoal(payload?.planType)),
    planType: stringOrFallback(value?.planType, String(payload?.planType ?? 'session')),
    action,
    avoid: stringArray(value.avoid).slice(0, 4),
    breakdown: normalizeBreakdown(value.breakdown),
    during: ensurePlanItems(during, sectionFallbacks.during),
    focus: stringArray(value.focus).slice(0, 5),
    intensity: calibration.intensity ?? stringOrFallback(value.intensity, 'Modified load'),
    label: formatEventLabel(stringOrFallback(value.label, 'Event plan'), payload),
    nextEventWarning: stringOrFallback(value.nextEventWarning, ''),
    preparation: ensurePlanItems(prepare, sectionFallbacks.preparation),
    reassess: stringArray(value.reassess).slice(0, 3),
    recovery: ensurePlanItems(recovery, sectionFallbacks.recovery),
    recoverySteps: normalizeRecoverySteps(value.recoverySteps, recovery),
    reasons: stringArray(value.reasons).slice(0, 5),
    score: calibratedScore,
    summary: stringOrFallback(value.summary, 'Recommendation generated from this event check-in.'),
    timeline: normalizeRecoveryTimeline(value.timeline, prepare, during, recovery),
    tone,
    routine: payload?.requestType === 'recovery_plan' ? undefined : normalizeRoutine(value.routine, payload),
    reportSections: normalizeReportSections(value.reportSections, payload),
  }
}

function redactAthleteName(value: any, profile: any): any {
  const names = [profile?.displayName, profile?.fullName, profile?.firstName, profile?.preferredName]
    .filter((name) => typeof name === 'string' && name.trim().length > 1)
    .map((name) => name.trim())
    .sort((first, second) => second.length - first.length)
  if (names.length === 0) return value
  if (Array.isArray(value)) return value.map((item) => redactAthleteName(item, profile))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactAthleteName(item, profile)]))
  }
  if (typeof value !== 'string') return value
  return names.reduce((text, name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.replace(new RegExp(`\\b${escaped}\\b,?\\s*`, 'gi'), '')
  }, value).replace(/\s+([,.!?;:])/g, '$1').trim()
}

function getSafetyCalibration(payload: any) {
  if (payload?.requestType !== 'check_in') return {}
  const checkIn = payload?.checkIn ?? {}
  const painDetails = [
    { injuryType: checkIn.injuryType, painType: checkIn.painType, hurtsWhen: checkIn.hurtsWhen },
    ...Object.values(checkIn.painDetails ?? {}),
  ] as Array<any>
  const highestPain = Math.max(0, Number(checkIn.pain) || 0, ...Object.values(checkIn.painMap ?? {}).map((value) => Number(value) || 0))
  const hasRedFlag = highestPain >= 8 || Number(checkIn.illnessSymptoms ?? 0) >= 4 || painDetails.some((detail) => {
    const text = `${detail?.injuryType ?? ''} ${detail?.painType ?? ''} ${detail?.hurtsWhen ?? ''}`.toLowerCase()
    return /concussion|bone stress|numb|tingling|instability|breathing|faint|confusion|unable to bear weight|at rest/.test(text)
  })
  return hasRedFlag ? { tone: 'danger' } : {}
}

function normalizeReportSections(value: unknown, payload: any) {
  if (!Array.isArray(value)) return []
  if (payload?.requestType === 'recovery_plan' && ['flexibility', 'targeted', 'full-body', 'quick', 'pre-event'].includes(payload?.planType)) return []
  const hasCurrentPain = payload?.requestType === 'recovery_plan'
    ? Object.values(payload?.currentRecoveryContext?.painMap ?? {}).some((severity) => Number(severity) > 0)
    : payload?.requestType === 'post_checkout'
      ? Object.values(payload?.checkout?.painMap ?? {}).some((severity) => Number(severity) > 0) || Boolean(payload?.checkout?.newPain)
      : Object.values(payload?.checkIn?.painMap ?? {}).some((severity) => Number(severity) > 0) || Number(payload?.checkIn?.pain) > 0
  const hasNextEvent = Boolean(payload?.nextScheduledEvent) || Boolean(payload?.scheduleContext?.nextEvent)
  const seen = new Set<string>()
  const usedContent = new Set<string>()
  const suppliedSectionIds = new Set(value.map((section: any) => String(section?.id ?? '').toLowerCase()))
  const allowedIds = new Set(payload?.requestType === 'post_checkout'
    ? ['session-summary', 'recovery-status', 'hydration-recovery', 'nutrition-recovery', 'cooldown', 'new-pain-soreness', 'next-few-hours']
    : payload?.requestType === 'recovery_plan'
      ? ['recovery-status', 'recovery-priorities', 'active-recovery-rest', 'nutrition-guidance', 'hydration-guidance', 'sleep-rest-guidance', 'pain-guidance', 'recovery-timeline', 'next-event-impact']
      : ['readiness-status', 'warm-up-focus', 'hydration-target', 'fueling-target', 'during-event-fueling', 'performance-focus', 'pain-guidance', 'fatigue-load', 'environment-guidance', 'event-preparation', 'pre-event-timeline'])
  const uniqueText = (text: unknown) => {
    const value = String(text ?? '').trim()
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || usedContent.has(key)) return ''
    usedContent.add(key)
    return value
  }
  return value.flatMap((section: any) => {
    const id = String(section?.id ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    if (!id || !allowedIds.has(id) || seen.has(id)) return []
    if (id.includes('pain') && !hasCurrentPain) return []
    if (id === 'main-concerns' && !stringOrFallback(section?.summary, '') && stringArray(section?.items).length === 0) return []
    if (id === 'main-concerns' && /^(no |none|nothing|no meaningful|no major)/i.test(String(section?.summary ?? '').trim())) return []
    if (id === 'next-event-impact' && !hasNextEvent) return []
    seen.add(id)
    const summary = uniqueText(section?.summary)
    const items = stringArray(section?.items).filter((item) => {
      if (id !== 'recovery-priorities') return true
      const text = item.toLowerCase()
      if (suppliedSectionIds.has('nutrition-guidance') && /protein|carb|meal|snack|nutrition|food/.test(text)) return false
      if (suppliedSectionIds.has('hydration-guidance') && /fluid|water|hydrat|electrolyte/.test(text)) return false
      if (suppliedSectionIds.has('sleep-rest-guidance') && /sleep|bed|nap|rest/.test(text)) return false
      if (suppliedSectionIds.has('pain-guidance') && /pain|sore|symptom|swelling/.test(text)) return false
      return true
    }).map(uniqueText).filter(Boolean).slice(0, 3)
    if (!summary && items.length === 0) return []
    return [{
      id,
      title: getReportSectionTitle(id, payload?.requestType),
      summary,
      items,
      action: id === 'warm-up-focus' ? 'warmup' : undefined,
      actionLabel: id === 'warm-up-focus' ? stringOrFallback(section?.actionLabel, 'Open warm-up focus') : undefined,
    }]
  }).slice(0, 8)
}

function getReportSectionTitle(id: string, requestType?: string) {
  if (id === 'pain-guidance') return requestType === 'recovery_plan' ? 'Pain Specific Guidance' : 'Pain and Soreness Guidance'
  const titles: Record<string, string> = {
    'readiness-status': 'Readiness', 'warm-up-focus': 'Warm-up Focus', 'hydration-target': 'Hydration Target',
    'fueling-target': 'Fueling Target', 'during-event-fueling': 'During-event Fueling', 'performance-focus': 'Performance Focus',
    'fatigue-load': 'Fatigue and Load', 'environment-guidance': 'Environment Guidance', 'event-preparation': 'Event-specific Preparation',
    'pre-event-timeline': 'Quick Timeline', 'session-summary': 'Session Summary', 'recovery-status': 'Recovery Status',
    'hydration-recovery': 'Hydration', 'nutrition-recovery': 'Nutrition', 'cooldown': 'Cooldown',
    'new-pain-soreness': 'New Pain or Soreness', 'next-few-hours': 'Next Few Hours', 'next-event-impact': 'Next Event Impact',
    'recovery-priorities': 'Recovery Priorities', 'active-recovery-rest': 'Active Recovery or Rest', 'recovery-timeline': 'Recovery Timeline',
    'nutrition-guidance': 'Nutrition Guidance', 'hydration-guidance': 'Hydration Guidance', 'sleep-rest-guidance': 'Sleep and Rest Guidance',
  }
  return titles[id] ?? id.replace(/-/g, ' ')
}

function getRoutineGoal(planType: unknown) {
  const goals: Record<string, string> = {
    'full-body': 'Balanced whole-body recovery',
    targeted: 'Focused recovery for selected body areas',
    session: 'Recover from the latest completed session',
    quick: 'Complete the highest-value recovery work quickly',
    competition: 'Support recovery between competitive efforts',
    'recovery-day': 'Use an off day for low-intensity recovery',
    'pre-event': 'Prepare comfortable movement before the next event',
    flexibility: 'Develop comfortable flexibility in major muscle groups',
  }
  return goals[String(planType ?? '')] ?? goals.session
}

function normalizeRecoverySteps(value: any, fallback: string[]) {
  const steps = Array.isArray(value)
    ? value
      .filter((step) => step && typeof step === 'object')
      .slice(0, 6)
      .map((step, index) => ({
        id: 'recovery-step-' + index,
        title: stringOrFallback(step.title, 'Recovery action'),
        why: stringOrFallback(step.why, 'This supports recovery after the completed session.'),
        when: stringOrFallback(step.when, index === 0 ? 'Right now' : 'Tonight'),
      }))
    : []

  if (steps.length > 0) return steps

  return fallback.slice(0, 6).map((title, index) => ({
    id: 'recovery-step-' + index,
    title,
    why: 'This supports recovery after the completed session.',
    when: index === 0 ? 'Right now' : 'Tonight',
  }))
}

function normalizeRecoveryTimeline(value: any, preparation: string[], during: string[], recovery: string[]) {
  const seen = new Set<string>()
  const uniqueItems = (items: unknown) => stringArray(items).filter((item) => {
    const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)

  if (Array.isArray(value) && value.length > 0) {
    return value.slice(0, 4).map((phase, index) => ({
      title: stringOrFallback(phase?.title, ['Right now', 'Within two hours', 'Tonight', 'Tomorrow morning'][index]),
      items: uniqueItems(phase?.items),
    })).filter((phase) => phase.items.length > 0)
  }

  return [
    { title: 'Right now', items: uniqueItems(preparation).slice(0, 4) },
    { title: 'Within two hours', items: uniqueItems(during).slice(0, 4) },
    { title: 'Tonight', items: uniqueItems(recovery) },
    { title: 'Tomorrow morning', items: uniqueItems(['Recheck soreness and pain before the next readiness check.']) },
  ]
}

function normalizeRoutine(value: any, payload?: any) {
  const suppliedCatalog = Array.isArray(payload?.recoveryCatalog) ? payload.recoveryCatalog : []
  const catalogById = new Map(suppliedCatalog.map((item: any) => [String(item?.id ?? ''), item]))
  const approvedRecoveryExerciseIds = new Set(catalogById.keys())
  const generatedExercises = Array.isArray(value?.exercises)
    ? value.exercises
      .filter((exercise: any) => approvedRecoveryExerciseIds.has(String(exercise?.movementId ?? exercise?.id ?? '')))
      .slice(0, 30)
      .map((exercise: any) => normalizeRoutineSelection(exercise, catalogById.get(String(exercise?.movementId ?? exercise?.id ?? ''))))
    : []

  const hasCurrentPain = Object.values(payload?.currentRecoveryContext?.painMap ?? {}).some((severity) => Number(severity) > 0)
  return {
    durationMinutes: getRequestedRoutineMinutes(payload?.timeAvailable) ?? Math.max(5, Math.min(30, Math.round(Number(value?.durationMinutes) || 10))),
    estimatedDurationSeconds: clampNumber(Number(value?.estimatedDurationSeconds) || ((getRequestedRoutineMinutes(payload?.timeAvailable) ?? 10) * 60), 240, 1_980),
    exercises: generatedExercises,
    goal: stringOrFallback(value?.goal, getRoutineGoal(payload?.planType)),
    painAware: hasCurrentPain && Boolean(value?.painAware),
    summary: stringOrFallback(value?.summary, 'Use comfortable movement as an optional way to relax and maintain mobility.'),
    routineName: stringOrFallback(value?.routineName ?? value?.title, getRoutineTitle(payload?.planType)),
    routineType: stringOrFallback(value?.routineType, String(payload?.planType ?? 'full_body')),
    title: stringOrFallback(value?.routineName ?? value?.title, getRoutineTitle(payload?.planType)),
  }
}

function normalizeRoutineSelection(exercise: any, catalogItem: any) {
  const source = exercise?.prescription ?? exercise?.dose ?? exercise
  const type = catalogItem?.prescriptionType === 'time' ? 'time' : 'reps'
  const defaults = catalogItem?.defaults ?? {}
  const prescription = type === 'time'
    ? { type, durationSeconds: clampNumber(source?.durationSeconds ?? defaults.durationSeconds, 15, 90), sets: clampNumber(source?.sets ?? defaults.sets, 1, 3), restSeconds: clampNumber(source?.restSeconds ?? defaults.restSeconds, 0, 60) }
    : { type, reps: clampNumber(source?.reps ?? defaults.reps, 3, 20), sets: clampNumber(source?.sets ?? defaults.sets, 1, 3), restSeconds: clampNumber(source?.restSeconds ?? defaults.restSeconds, 0, 60) }
  const requestedSide = String(exercise?.side ?? '').toLowerCase()
  const side = catalogItem?.laterality === 'each-side' && /^(left|right)/.test(requestedSide) ? requestedSide : ''
  return { movementId: String(exercise?.movementId ?? exercise?.id), prescription, howToPerform: stringOrFallback(exercise?.howToPerform ?? exercise?.instructions, ''), rationale: stringOrFallback(exercise?.rationale, ''), ...(side ? { side } : {}) }
}


function getRoutineTitle(planType: unknown) {
  const titles: Record<string, string> = {
    flexibility: 'Full-body flexibility',
    mobility: 'Full-body mobility',
    quick: 'Quick recovery reset',
    competition: 'Competition recovery',
    'recovery-day': 'Recovery day routine',
    'pre-event': 'Pre-event mobility',
    session: 'Session recovery',
  }
  return titles[String(planType ?? '')] ?? 'Post-session recovery'
}

function getRequestedRoutineMinutes(value: unknown) {
  const minutes = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 30 ? minutes : null
}

function formatEventLabel(label: string, payload: any) {
  const event = payload?.schedule?.find((item: any) => item?.id === payload?.checkIn?.eventId)
    ?? payload?.event
    ?? {}
  const eventText = `${event.type ?? ''} ${event.title ?? ''}`.toLowerCase()

  if (/game|match|tournament|competition/.test(eventText)) {
    return label
      .replace(/full training/i, 'Full Participation')
      .replace(/controlled training/i, 'Controlled Participation')
      .replace(/modified training/i, 'Modified Participation')
  }

  if (/gym|workout|weight|lifting|conditioning/.test(eventText)) {
    return label
      .replace(/full training/i, 'Full Session')
      .replace(/controlled training/i, 'Controlled Session')
      .replace(/modified training/i, 'Modified Session')
  }

  if (/recovery|mobility|rest/.test(eventText)) {
    return label
      .replace(/full training/i, 'Recovery Session')
      .replace(/controlled training/i, 'Recovery Session')
      .replace(/modified training/i, 'Recovery Session')
  }

  if (/practice|training|team/.test(eventText)) {
    return label
      .replace(/full training/i, 'Full Participation')
      .replace(/controlled training/i, 'Controlled Participation')
      .replace(/modified training/i, 'Modified Participation')
  }

  return label
}



function ensurePlanItems(items: string[], fallback: string[]) {
  return items.length > 0 ? items : fallback
}

function getSectionFallbacks(payload: any) {
  if (payload?.requestType === 'post_checkout') {
    return {
      preparation: ['Start with an easy cooldown and fluids after you finish the session.'],
      during: ['Notice whether pain, dizziness, cramping, or unusual fatigue changes over the next few hours.'],
      recovery: ['Have a normal recovery meal, use comfortable mobility, and protect a full night of sleep.'],
    }
  }

  const event = payload?.event ?? {}
  const eventName = String(event.type ?? event.title ?? 'event').toLowerCase()

  return {
    preparation: [`Use a gradual warm-up that prepares you for the demands of this ${eventName}.`],
    during: ['Follow the event plan and use controlled alternatives for any movement that brings on symptoms.'],
    recovery: ['After the event, cool down, rehydrate, and note any meaningful symptom changes.'],
  }
}

function normalizeBreakdown(value: any) {
  if (!Array.isArray(value)) return [{ label: 'AI assessment', value: 0 }]

  return value
    .map((item) => ({
      label: stringOrFallback(item?.label, 'Factor'),
      value: Number.isFinite(Number(item?.value)) ? Number(item.value) : 0,
    }))
    .slice(0, 8)
}

function stringArray(value: any) {
  if (!Array.isArray(value)) return []

  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
}

function stringOrFallback(value: any, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function clampNumber(value: any, min: number, max: number) {
  const number = Number(value)

  if (!Number.isFinite(number)) return 60

  return Math.max(min, Math.min(max, Math.round(number)))
}

function jsonResponse(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
