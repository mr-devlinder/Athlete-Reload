const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Recommendation = {
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
}

const requestWindows = new Map<string, number[]>()

Deno.serve(async (request) => {
  let stage = 'request_validation'
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!geminiApiKey) {
    return jsonResponse({ error: 'Missing GEMINI_API_KEY secret' }, 503)
  }

  try {
    stage = 'parse_request'
    const body = await request.json()
    const requester = getRequesterKey(request)
    const now = Date.now()
    const recent = (requestWindows.get(requester) ?? []).filter((time) => now - time < 60_000)
    if (recent.length >= 3) return jsonResponse({ error: 'Too many AI requests. Please wait a minute and try again.' }, 429)
    requestWindows.set(requester, [...recent, now])
    if (body?.requestType === 'voice_extract') {
      const extractionResponse = await generateGeminiJson(geminiApiKey, buildVoiceExtractionPrompt(body))
      return jsonResponse({ extraction: extractionResponse })
    }
    stage = 'gemini_request'
    const { response: geminiResponse, model } = await requestGemini(geminiApiKey, buildPrompt(body))
    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text()
      return jsonResponse({ error: 'Gemini request failed', detail }, 502)
    }

    stage = 'parse_gemini_response'
    const data = await geminiResponse.json()
    const text = extractOutputText(data)
    stage = 'normalize_recommendation'
    const recommendation = normalizeRecommendation(parseJsonResponse(text), body)

    return jsonResponse({ recommendation, source: 'gemini', model })
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      stage,
    }))
    const stageStatus = {
      parse_request: 520,
      build_prompt: 524,
      gemini_request: 521,
      parse_gemini_response: 522,
      normalize_recommendation: 523,
    }[stage] ?? 500
    return jsonResponse({
      error: 'Unable to generate recommendation',
      detail: error instanceof Error ? error.message : String(error),
      stage,
    }, stageStatus)
  }
})

async function generateGeminiJson(apiKey: string, input: string) {
  const { response } = await requestGemini(apiKey, input)
  if (!response.ok) throw new Error('Gemini request failed')
  return parseJsonResponse(extractOutputText(await response.json()))
}

async function requestGemini(apiKey: string, input: string) {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
  let response: Response | null = null
  for (const model of models) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: input }] }] }),
    })
    if (response.ok || ![429, 503].includes(response.status)) return { response, model }
  }
  return { response: response!, model: models[models.length - 1] }
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

function buildPrompt(payload: unknown) {
  if ((payload as any)?.requestType === 'post_checkout') {
    return buildCompactPostCheckoutPrompt(payload)
  }

  if ((payload as any)?.requestType === 'recovery_plan') {
    return buildRecoveryPlanPrompt(payload)
  }

  if ((payload as any)?.requestType === 'quick_checkin') {
    return buildQuickCheckInPrompt(payload)
  }

  return `
You are Athlete Reload's training readiness assistant for student athletes.
Never use, repeat, or address the athlete by their name or display name. Write directly using "you" and "your" only.

Return ONLY valid JSON. No markdown. No extra commentary.

Use the athlete's current check-in, selected event, athlete profile, current nutrition/preparation context, recentEvents, previousCheckout, previousRecoveryCompletion, generatedAt, and future schedule to create a recommendation for this specific event. Recent events establish workload and response patterns, but current information remains most important. This is not a medical diagnosis. Be practical: do not default to "no training" for very low pain unless symptoms are red flags.

Current pain rule: checkIn.painMap and checkIn.pain are the sole source of truth for active pain and restrictions. History may identify patterns but must never turn resolved pain into a current restriction.

Calibration principles:
- Infer readiness holistically from the current check-in, the demands of this specific event, preparation status, personal baseline, recent workload/recovery, profile, and schedule. Do not calculate the score from a fixed deduction table and do not anchor ordinary combinations to preset score ranges.
- A readiness score describes how prepared this athlete appears for this event at this time. Event difficulty alone is not poor readiness, and one minor concern must not dominate otherwise strong information.
- Weight evidence by relevance and confidence. Current symptoms outweigh history; a well-established personal baseline is more informative than a generic assumption; missing nutrition logs mean unknown rather than deficient.
- Keep the score, label, summary, concerns, and recommendations internally consistent. Explain only the few factors that materially changed the outlook.
- Escalate only genuine red flags such as severe or rapidly worsening pain, pain at rest, inability to bear weight, obvious swelling/deformity, neurological symptoms, chest/breathing symptoms, fainting/confusion, head-injury symptoms, or suspected bone stress injury.
- Avoid/focus should be practical instructions for this event, not generic wellness filler.
- Give an event plan, not a binary clearance verdict. Explain what the athlete can do, what to change, how to warm up, when to reassess, and what to do afterward.
- Make each list item a complete, specific instruction of about 8-20 words.
- Legacy preparation/during/recovery arrays are storage compatibility only. Put the visible, non-duplicated report content in reportSections.
- Do not use numeric pain cutoffs or phrases such as "exceeds 3/10" in the recommendation. Describe meaningful changes plainly, such as sharp pain, worsening symptoms, altered movement, or inability to perform the motion normally.
- Use the event type, sport, association, duration, intensity, surface, environment, and every selected pain area together. Tailor each modification to the athlete's sport and the actual event demands: upper-body symptoms may affect overhead work, throwing, catching, lifting, bracing, or contact; lower-body symptoms may affect sprinting, jumping, cutting, kicking, landing, or lifting; trunk symptoms may affect rotation, bracing, and contact. Head or neck symptoms require the red-flag rules.
- Use sportContext workload only when values are present. Translate exposure, distance, yardage, throwing, jumping, or contact details into practical preparation and monitoring; never use them to diagnose or predict injury risk.
- Treat an Other activity as sport-neutral. Use its activity name, duration, planned load, surface/environment, and any prior checkout effort without applying the athlete's primary-sport position or sport-specific workload assumptions.
- When scheduleContext includes a Rest Day, describe it only as planned rest/recovery context. A scheduled Rest Day is not proof that the athlete is recovered and must never override current wellness, pain, or red-flag information.
- When event.tournament is present, account for the tournament date range and its scheduled games. A short turnaround to the next match should favor practical recovery, symptom monitoring, and avoiding unnecessary extra work; do not treat a tournament game like an isolated event.
- Consider expected duration, surface, indoor/outdoor environment, location/weather when present, expected difficulty, leg heaviness, numeric illness symptoms (0 none, 5 unwell), sleep quality (5 best, 0 worst), numeric stress (0 low, 5 high), and every selected pain area's type, trigger, trend, and affected movement. If previousCheckout is present, use only its session difficulty, duration, completion, physical response, pain change, performance/focus data, saved recoveryPlan action statuses or feedback, and previousRecoveryCompletion as the prior-session context.
- Use eventPreparationContext as the only fuel and hydration assessment for this check-in. Its statuses are broad, time-adjusted event-preparation signals, not full-day target completion scores. Do not reconstruct or imply a full-day comparison.
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

JSON shape:
{
  "score": number from 0 to 100,
  "label": an event-specific phrase such as "Full Participation", "Modified Participation", "Full Session", "Controlled Session", "Recovery Session", or "Stop and Check In",
  "tone": "ready" | "caution" | "warning" | "danger",
  "intensity": short training intensity phrase,
  "summary": one short sentence explaining the decision,
  "action": one specific paragraph telling the athlete what to do today,
  "avoid": array of 0 to 4 specific things to avoid,
  "focus": array of 2 to 4 specific things to focus on,
  "preparation": array of 3 to 5 ordered warm-up or preparation instructions,
  "during": array of 3 to 5 instructions for the event's drills, reps, pace, contact, or intensity,
  "recovery": array of 2 to 4 specific after-event actions,
  "reportSections": array in this order: main-concerns only when a meaningful issue changes preparation, event-demand, personalized-warm-up, fuel-hydration, pain-guidance only with current pain, motivational-quote. Each item is {"id":"exact-id","title":"display title","summary":"specific 1-2 sentence interpretation","items":["0-4 non-duplicated actionable details"]}. Event demand must follow the actual selected activity rather than the athlete's primary sport. Fuel-hydration must use event timing and logged intake; when intake is unlogged, give a normal proportional baseline without claiming a deficit. Motivational quote must be short, original, and matched to the readiness outlook.
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
The event has already ended. Create a practical recovery plan from only the supplied checkout data.
Do not give participation clearance for the completed event. Do not diagnose injuries.
Escalate new or worsening pain, changed movement, breathing trouble, dizziness, confusion, or severe symptoms to an adult, coach, athletic trainer, or medical professional.

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
    {"id":"event-summary","title":"Event Summary","summary":"one sentence including actual duration, intensity, participation, completion and meaningful plan difference","items":[]},
    {"id":"planned-vs-actual","title":"Planned vs. Actual","summary":"one sentence comparison","items":[]},
    {"id":"workload-summary","title":"Workload Summary","summary":"plain-language meaning of minutes multiplied by effort","items":[]},
    {"id":"body-response","title":"Body Response","summary":"expected versus unusual response; omit only when no response data exists","items":[]},
    {"id":"session-quality","title":"Performance or Session Quality","summary":"neutral interpretation, never judgment","items":[]},
    {"id":"recovery-demand","title":"Recovery Demand","summary":"how much recovery is likely needed and why","items":[]},
    {"id":"immediate-priorities","title":"Immediate Priorities","summary":"short lead-in","items":["2-4 highest value actions"]},
    {"id":"next-event-impact","title":"Next Event Impact","summary":"include only when a future event is supplied; do not automatically recommend skipping","items":[]}
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
Use only the athlete's edited words below. Do not invent missing measurements or pretend the athlete answered the detailed check-in fields.
Create a practical event recommendation from the information that is actually present. Clearly state what is unknown and keep the plan conservative when important details are missing.
This is not medical advice or clearance. Direct the athlete to a parent, coach, athletic trainer, or qualified healthcare professional for red flags.

Return ONLY valid JSON in the same recommendation shape used by the app, including action, label, summary, score, tone, preparation, during, recovery, reasons, avoid, focus, reassess, intensity, nextEventWarning, breakdown, and reportSections. reportSections may use only main-concerns when meaningful, event-demand, personalized-warm-up, fuel-hydration, pain-guidance only when current pain was explicitly reported, and motivational-quote. Omit any section that cannot be supported by the athlete's words and supplied event context.

Quick check-in text:
${String(payload?.quickTranscript ?? '').trim()}
`
}


function formatPostCheckoutData(payload: any) {
  return [
    ['athleteProfile', payload?.athleteProfile],
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

function buildRecoveryPlanPrompt(payload: unknown) {
  const planType = stringOrFallback((payload as any)?.planType, 'last-checkout')
  const planTypeDirective = getRecoveryPlanTypeDirective(planType, (payload as any)?.targetedAreas)

  return `
You are Athlete Reload's recovery planning assistant for student athletes.
Never use, repeat, or address the athlete by their name or display name. Write directly using "you" and "your" only.

Return ONLY valid JSON. No markdown. No extra commentary.

Build an actionable recovery plan from the athlete's latest completed checkout, its pre-event check-in, the completed event, athlete profile, selected planType, targetedAreas, equipment choice, available time, current local time in generatedAt, currentRecoveryContext, historical recentPainReports, recoveryCompletions, and the next scheduled event. This is not medical advice or injury diagnosis.

Important behavior:
- PRIMARY ROUTINE CONTRACT (${planType}): ${planTypeDirective}
- currentRecoveryContext is the sole source of truth for current pain and restrictions. A missing body part or severity 0 is not active pain and must not cause protection language, altered exercises, painAware=true, or a restriction. recentPainReports are history only and must never override currentRecoveryContext.
- The PRIMARY ROUTINE CONTRACT controls the routine goal, exercise selection and order, recovery steps, timeline, action, summary, and insights. Athlete context may personalize this contract or remove unsafe movements, but must not replace it with a generic recovery plan.
- When planType is last-checkout or competition, connect the plan to the supplied completed event. For every other plan type, do not imply that a completed event caused the request and do not invent why the athlete selected it. Build the requested routine outcome, then personalize it with athleteProfile, weeklyWorkloadContext, recentEvents, recoveryCompletions, currentRecoveryContext, nutritionContext, and future schedule.
- Do not decide whether the athlete is cleared for the next event.
- Honor planType as the plan's primary goal: last-checkout responds directly to the completed session; full-body balances major regions; flexibility emphasizes comfortable range over intensity; targeted prioritizes targetedAreas while still including adjacent joints; quick is a focused 5-10 minute plan; competition prioritizes turnaround and avoids unnecessary fatigue; recovery-day provides a practical day plan; mobility uses only comfortable mobility work.
- Use generatedAt and nextScheduledEvent to make timing labels truthful. Morning plans should address the current morning and later day; evening plans should prioritize what remains before sleep. Never say "tonight" when it is already morning unless referring to the coming night.
- Compare the next event time with generatedAt. A short turnaround should prioritize the few highest-value actions; a longer window can spread actions across meals, hydration, sleep, and mobility. Use next-event type and planned workload, not just its title.
- Use recoveryCompletions to avoid stacking another demanding routine immediately after one was completed. A recent completion should favor follow-through actions such as food, fluids, and sleep or a shorter gentle routine.
- Use recentPainReports by latest body area state. A zero-severity follow-up means that area is no longer currently painful, though previous history can still justify sensible monitoring.
- Use actual minutes, session difficulty, participation, session content, surface, sport, position, current soreness, pain before versus after, new symptoms, changed movement, and the next event's timing together.
- Generate 2-4 ranked Recovery Priorities inside reportSections. Each must be specific to the selected plan, current context, and recovery window.
- Use dailyWellness, nutritionContext, selected goals, and dietary preferences to make food and hydration steps practical. Use what is already logged that day; do not prescribe exact medical nutrition quantities or claim a meal repairs an injury.
- Include normal recovery habits such as fluids, a normal meal or snack, sleep, a cooldown, and comfortable mobility when appropriate. Do not prescribe exact medical or nutrition quantities.
- If participation was Did not participate, do not recommend recovery for training that did not happen. Focus on symptom monitoring, comfortable whole-body recovery, and evaluation guidance when needed.
- A painful area must not automatically receive a deeper stretch. Sharp or worsening pain, limping, loss of movement, instability, swelling, numbness, concerning symptoms, or changed movement should remove that area from stretching and recommend telling a parent, coach, athletic trainer, or qualified healthcare professional.
- Do not imply stretching prevents soreness or injury or that temporary looseness proves healing. Present it as optional comfortable mobility or relaxation.
- Treat the supplied timeAvailable as an exact routine time budget, not merely a maximum. Set routine.durationMinutes to exactly that selected whole-minute duration. The sum of the individual timed exercise steps must land within about one minute of that duration, with enough distinct exercises for the selected plan type. Adjust the content to effort, duration, participation, and the next event. The equipment array describes what is available, but the routine does not need to use every item. Always include a no-equipment option.
- Never require equipment that is absent from the supplied equipment array. Selected equipment enables an option; it does not obligate its use. Every exercise must include "equipment":"None" or the exact name of one selected item.
- Build a real routine with enough distinct, useful steps to fill exactly 5, 10, 15, 20, 25, or 30 selected minutes. Let the athlete context and routine flow determine exercise count: added time may add exercises, extend appropriate holds, or add controlled repetitions. Short plans should be concise and longer plans should contain enough variety, but never pad the plan with filler or multi-minute static holds.
- Every genuinely unilateral movement must be returned as two consecutive exercise objects: one with side "Left" and one with side "Right". Give each object the full duration or repetition dose and side-specific setup, movement, and completion instructions. Never put "switch sides" inside an exercise because each object receives its own timer. Keep bilateral, simultaneous, full-body, and central-body movements as one object with side "Both sides". In every step, put laterality in either side or area without duplicating it: use side "Left" with area "Hip", or side "Both sides" with area "Hips"; never side "Left" with area "Left Hip".
- Unless planType is targeted, flexibility, quick, or mobility, build a full-body recovery routine that includes the major regions relevant after activity. For specialized plan types, stay focused on the selected outcome while keeping adjacent joints and basic whole-body balance where useful. Keep painful or concerning areas protected rather than forcing direct stretching.
- Do not include standalone walking, breathing, or generic ankle rolls as routine exercises. They are not acceptable filler. Only include a short cooldown movement when it is specific to the completed sport or a symptom/safety concern, and it must never replace the stretching and mobility work.
- Use sportContext workload when present to select sport-relevant recovery priorities, but never diagnose or predict injury risk from workload. All symptom and red-flag safety rules override workload-based guidance.
- For an Other activity, scale recovery from generic duration, session-RPE, participation, load, and surface/environment. A nearby planned Rest Day is context only and is not evidence that recovery has occurred.
- Prefer useful movement variety: dynamic range work, joint-specific mobility, controlled rotations, tissue-friendly flexibility, and side-specific stretches. Every routine should feel like something an athlete can actually follow exercise by exercise.
- Prefer conventional, widely recognized exercise and stretch names with clear form cues. Do not treat any example list or familiar pair as a template, and do not routinely begin with the same two movements. Use niche movements sparingly and only when the athlete context makes them more useful than a familiar option.
- Match most exercises to the active body areas and sport demands. For a mild, stable shoulder symptom without red flags, favor comfortable shoulder range, scapular control, thoracic rotation or extension, chest and lat flexibility, and optional gentle neck mobility when it feels relevant. Do not default to lower-body or ankle exercises for a shoulder-focused report.
- For lower-body symptoms, use the specific involved region and related joints. For example, a stable calf issue can use calf and ankle mobility; a hamstring issue can use gentle hip and hamstring movement; a knee issue can use comfortable hip, quad, and ankle mobility. Do not stretch directly into sharp, worsening, unstable, numb, swollen, or movement-changing symptoms.
- Every exercise, including the final exercise, must fully populate setup, movement, completionCue, sideCue, feel, and avoid. Write for someone who has never performed the movement: name joint positions, movement direction, what remains still, the exact end of a repetition or hold, how to change sides, expected muscle sensation, common form errors, and symptoms that mean stop. Never become shorter or less specific later in the routine.
- Static stretches and sustained positions must use durationSeconds and omit reps. Controlled mobility repetitions must use reps and omit durationSeconds. Use side "Left" or "Right" for unilateral exercise objects and "Both sides" only when both sides move together.
- Use sport and position. A volleyball shoulder routine, soccer lower-body routine, baseball pitcher routine, and lower-body gym routine should differ when the supplied data supports it.
- If the next event is soon, shorten the routine and prioritize prompt food, fluids, sleep, and symptom monitoring. If the next day is a rest day, a slightly longer comfortable mobility routine may fit.
- Do not use a readiness score in this response. A stored score may be 0.
- Do not generate the legacy recoverySteps or timeline fields. The visible recovery output is reportSections plus the personalized routine.
- For flexibility, mobility, targeted, full-body, or quick routine requests, return reportSections as an empty array. These users requested a routine, not a full recovery report. Keep the routine personalized from profile, current body state, targeted areas, time, and available equipment.
- For last-checkout, competition, or recovery-day plans, Recovery Priorities must contain only the highest-value session-specific actions not covered by the dedicated nutrition, hydration, sleep/rest, or pain sections. Never repeat those dedicated goals in Recovery Priorities.
- Nutrition Guidance must state a real recovery goal in plain language. Use current logged nutrition, time of day, athlete goals, and the completed session when supplied. Explain whether carbohydrates, protein, or an ordinary balanced meal/snack deserves priority and why; do not merely print macro numbers.
- Hydration Guidance must never estimate exact sweat or fluid loss. Distinguish between returning to normal steady hydration after a light session and deliberately replacing fluids after longer, hotter, or harder work, using symptoms and logged hydration when available.
- Sleep and Rest Guidance must fit generatedAt and the next event. Do not say only "get sleep"; explain the useful rest priority for the remaining recovery window.
- Include pain-guidance only when currentRecoveryContext shows current pain. Historical pain alone never enables it.
- Personalize every routine sequence. Use variationKey, recentRoutineSequences, and recentRoutineExerciseNames to avoid returning the same opening pair, exercise order, or exact routine repeatedly. Familiar exercises may return when useful, but vary the sequence, emphasis, dosage, and supporting movements so the complete routine responds to this request.
- Prefer recognizable stretches and mobility work. Use niche movements sparingly and only when profile, sport, target area, or current body state makes them more useful than a familiar option.

JSON shape:
{
  "label": "Immediate recovery" | "Extra recovery" | "Monitor symptoms" | "Tell an adult / trainer",
  "tone": "ready" | "caution" | "warning" | "danger",
  "summary": "one short sentence",
  "action": "one short paragraph describing the priority tonight",
  "reportSections": [{"id":"recovery-priorities","title":"Recovery Priorities","summary":"ranked, session-specific priorities without duplicates","items":["priority 1","priority 2"]},{"id":"nutrition-guidance","title":"Nutrition Guidance","summary":"a practical recovery goal based on current nutrition and this session","items":[]},{"id":"hydration-guidance","title":"Hydration Guidance","summary":"practical guidance without claiming exact fluid loss","items":[]},{"id":"sleep-rest-guidance","title":"Sleep and Rest Guidance","summary":"specific guidance for current time and next event","items":[]},{"id":"pain-guidance","title":"Pain-Specific Guidance","summary":"only when pain is current","items":[]}],
  "planType": "${planType}",
  "routine": {"title":"type-specific routine title","goal":"specific goal for ${planType}","summary":"explain how this routine fulfills the selected type","durationMinutes":10,"painAware":true,"exercises":[{"name":"movement name","type":"Mobility","area":"body area","side":"Both sides","equipment":"None","durationSeconds":30,"setup":"exact starting body position and equipment placement","movement":"step-by-step movement direction plus what must remain still","completionCue":"how to know one repetition or hold is complete","sideCue":"how and when to switch sides, or state that both sides move together","why":"short reason this movement fits the selected routine type and athlete context","feel":"specific muscle or area that should work or stretch","avoid":"specific form faults and symptoms that mean stop"}]},
  "nextEventWarning":"short warning only when the recovery window or symptoms need attention",
  "recovery":["fallback recovery actions"],
  "preparation":["right now actions"],
  "during":["within two hours actions"],
  "reasons":["specific reason"],
  "score": 0,
  "breakdown": []
}

Athlete data:
${JSON.stringify(payload, null, 2)}
`
}

function getRecoveryPlanTypeDirective(planType: string, targetedAreas: unknown) {
  const directives: Record<string, string> = {
    'full-body': 'Create a balanced head-to-toe recovery sequence. Distribute work across upper body, trunk, hips, legs, and ankles, then adapt emphasis to the athlete profile, weekly workload, recovery history, current body state, and future events.',
    targeted: `Focus primarily on these selected areas: ${stringArray(targetedAreas).join(', ') || 'none supplied'}. Put their safe movements first, include directly related joints, and omit unrelated filler. Pain safety can remove an area but must not redirect the routine to a different body region.`,
    'last-checkout': 'Build directly from the latest checkout. Exercise order and recovery actions must respond to session type, workload, soreness, pain changes, and the next event.',
    quick: 'Create a condensed routine containing only the highest-value actions for the selected 5-10 minute budget. Start immediately with useful movement and avoid repeated or low-priority steps.',
    competition: 'Create post-match or tournament recovery. Prioritize downshifting after competition, food and fluids, symptom monitoring, sleep, and the next competitive turnaround; use only gentle movement that does not add fatigue.',
    'recovery-day': 'Create a low-intensity off-day plan spread across the current day. Emphasize easy circulation, comfortable movement, nutrition, hydration, and sleep without treating the day like a post-match cooldown.',
    mobility: 'Create a controlled joint-mobility sequence focused on movement quality, active range, rotations, and smooth repetitions. Minimize passive stretching and do not turn it into a generic cooldown.',
    flexibility: 'Create a flexibility-first routine, never label it as mobility. Use mostly recognizable sustained stretches held 20-45 seconds for hamstrings, hip flexors, adductors, calves, glutes, chest, back, and neck where safe. Include progressive mild-to-moderate tension guidance. The title, summary, timing, and at least two-thirds of exercises must explicitly develop flexibility; mobility may appear only as brief preparation.',
  }

  return directives[planType] ?? directives['last-checkout']
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text

  const generatedText = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text ?? '')
    .join('')
  if (generatedText) return generatedText

  const modelStep = data?.steps?.find((step: any) => step?.type === 'model_output')
  const textPart = modelStep?.content?.find((part: any) => part?.type === 'text')

  if (typeof textPart?.text === 'string') return textPart.text

  throw new Error('Gemini response did not include text output')
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
  const tone = calibration.tone ?? (['danger', 'warning', 'caution', 'ready'].includes(value.tone)
    ? value.tone
    : calibratedScore >= 84
      ? 'ready'
      : calibratedScore >= 70
        ? 'caution'
        : calibratedScore >= 55
          ? 'warning'
          : 'danger')

  return {
    goal: stringOrFallback(value?.goal, getRoutineGoal(payload?.planType)),
    planType: stringOrFallback(value?.planType, String(payload?.planType ?? 'last-checkout')),
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
    routine: normalizeRoutine(value.routine, payload),
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
  if (payload?.requestType === 'recovery_plan' && ['flexibility', 'mobility', 'targeted', 'full-body', 'quick'].includes(payload?.planType)) return []
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
    ? ['event-summary', 'planned-vs-actual', 'workload-summary', 'body-response', 'session-quality', 'recovery-demand', 'immediate-priorities', 'next-event-impact']
    : payload?.requestType === 'recovery_plan'
      ? ['recovery-priorities', 'nutrition-guidance', 'hydration-guidance', 'sleep-rest-guidance', 'pain-guidance']
      : ['main-concerns', 'event-demand', 'personalized-warm-up', 'fuel-hydration', 'pain-guidance', 'motivational-quote'])
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
    }).map(uniqueText).filter(Boolean).slice(0, 5)
    if (!summary && items.length === 0) return []
    return [{
      id,
      title: getReportSectionTitle(id, payload?.requestType),
      summary,
      items,
      action: id === 'personalized-warm-up' ? 'warmup' : undefined,
      actionLabel: id === 'personalized-warm-up' ? stringOrFallback(section?.actionLabel, 'Open full warm-up') : undefined,
    }]
  }).slice(0, 8)
}

function getReportSectionTitle(id: string, requestType?: string) {
  if (id === 'pain-guidance') return requestType === 'recovery_plan' ? 'Pain Specific Guidance' : 'Pain and Soreness Guidance'
  const titles: Record<string, string> = {
    'main-concerns': 'Main Concerns', 'event-demand': 'Event Demand', 'personalized-warm-up': 'Personalized Warm Up',
    'fuel-hydration': 'Fuel and Hydration', 'motivational-quote': 'Motivation',
    'event-summary': 'Event Summary', 'planned-vs-actual': 'Planned vs. Actual Comparison', 'workload-summary': 'Workload Summary',
    'body-response': 'Body Response', 'session-quality': 'Performance or Session Quality', 'recovery-demand': 'Recovery Demand',
    'immediate-priorities': 'Immediate Priorities', 'next-event-impact': 'Next Event Impact', 'recovery-priorities': 'Recovery Priorities',
    'nutrition-guidance': 'Nutrition Guidance', 'hydration-guidance': 'Hydration Guidance', 'sleep-rest-guidance': 'Sleep and Rest Guidance',
  }
  return titles[id] ?? id.replace(/-/g, ' ')
}

function getRoutineGoal(planType: unknown) {
  const goals: Record<string, string> = {
    'full-body': 'Balanced whole-body recovery',
    targeted: 'Focused recovery for selected body areas',
    'last-checkout': 'Recover from the latest completed session',
    quick: 'Complete the highest-value recovery work quickly',
    competition: 'Support recovery between competitive efforts',
    'recovery-day': 'Use an off day for low-intensity recovery',
    mobility: 'Improve controlled joint movement quality',
    flexibility: 'Develop comfortable flexibility in major muscle groups',
  }
  return goals[String(planType ?? '')] ?? goals['last-checkout']
}

function normalizeRecoverySteps(value: any, fallback: string[]) {
  const steps = Array.isArray(value)
    ? value
      .filter((step) => step && typeof step === 'object')
      .slice(0, 6)
      .map((step, index) => ({
        id: `recovery-step-${index}`,
        title: stringOrFallback(step.title, 'Recovery action'),
        why: stringOrFallback(step.why, 'This supports recovery after the completed session.'),
        when: stringOrFallback(step.when, index === 0 ? 'Right now' : 'Tonight'),
      }))
    : []

  if (steps.length > 0) return steps

  return fallback.slice(0, 6).map((title, index) => ({
    id: `recovery-step-${index}`,
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
  const availableEquipment = new Set(stringArray(payload?.equipment).map((item) => item.toLowerCase()))
  const generatedExercises = Array.isArray(value?.exercises)
    ? value.exercises.filter((exercise: any) => {
      const required = String(exercise?.equipment ?? 'None').trim().toLowerCase()
      const exerciseText = `${exercise?.name ?? ''} ${exercise?.instruction ?? ''}`.toLowerCase()
      const inferredRequirement = [
        ['exercise mat', /exercise mat/], ['foam roller', /foam roll/], ['stretching strap', /stretching strap|yoga strap/],
        ['yoga blocks', /yoga block/], ['resistance band', /resistance band|long band|banded/], ['mini band', /mini band|loop band/],
        ['massage ball', /massage ball|lacrosse ball/], ['massage stick', /massage stick/], ['towel', /\btowel\b/],
        ['chair or bench', /\bchair\b|\bbench\b/], ['stability ball', /stability ball|swiss ball/],
        ['stationary bike', /stationary bike|cycling/], ['pool', /pool|swim|aquatic/], ['compression equipment', /compression boot|compression sleeve/],
      ].find(([, pattern]) => (pattern as RegExp).test(exerciseText))?.[0]
      if (inferredRequirement && !availableEquipment.has(inferredRequirement as string)) return false
      return !required || required === 'none' || required === 'bodyweight' || availableEquipment.has(required)
    }).slice(0, 32).flatMap((exercise: any) => expandRecoveryExerciseSides(normalizeRecoveryExercise(exercise)))
    : []
  const exercises = avoidRepeatedRoutineOpening(generatedExercises, payload?.recentRoutineSequences, payload?.variationKey)

  const hasCurrentPain = Object.values(payload?.currentRecoveryContext?.painMap ?? {}).some((severity) => Number(severity) > 0)
  return {
    durationMinutes: getRequestedRoutineMinutes(payload?.timeAvailable) ?? Math.max(5, Math.min(30, Math.round(Number(value?.durationMinutes) || 10))),
    exercises,
    goal: stringOrFallback(value?.goal, getRoutineGoal(payload?.planType)),
    painAware: hasCurrentPain && Boolean(value?.painAware),
    summary: stringOrFallback(value?.summary, 'Use comfortable movement as an optional way to relax and maintain mobility.'),
    title: stringOrFallback(value?.title, getRoutineTitle(payload?.planType)),
  }
}

function normalizeRecoveryExercise(exercise: any) {
  const name = stringOrFallback(exercise?.name, 'Gentle mobility')
  const type = stringOrFallback(exercise?.type, 'Mobility')
  const text = `${name} ${type}`.toLowerCase()
  const isHold = /stretch|hold|breath|release|relax|flexibility/.test(text)
  const isUnilateral = /single[- ]?(leg|arm)|split stance|half[- ]kneeling|figure[- ]four|calf stretch|hamstring stretch|hip flexor|open book|side[- ]lying|one[- ]arm|one[- ]leg/.test(text)
  const suppliedSide = stringOrFallback(exercise?.side, isUnilateral ? 'Each side' : 'Both sides')
  const side = isUnilateral && /^both( sides)?$/i.test(suppliedSide) ? 'Each side' : suppliedSide
  const legacyInstruction = stringOrFallback(exercise?.instruction, '')
  const setup = stringOrFallback(exercise?.setup, `Choose a stable position where you can perform ${name.toLowerCase()} without losing balance.`)
  const movement = stringOrFallback(exercise?.movement, legacyInstruction || `Move slowly through the intended range while keeping the rest of your body controlled.`)
  const completionCue = stringOrFallback(exercise?.completionCue, isHold
    ? `Ease out under control when the hold time ends.`
    : `Return to the starting position under control to complete one repetition.`)
  const sideCue = stringOrFallback(exercise?.sideCue, isUnilateral || /each side|left|right/i.test(side)
    ? `Complete the full dose on one side, reset your position, then repeat on the other side.`
    : `Keep both sides moving evenly throughout the exercise.`)
  const clearInstruction = [setup, movement, completionCue, sideCue]
    .map(ensureSentence)
    .join(' ')

  return {
    area: stringOrFallback(exercise?.area, 'Comfortable range'),
    avoid: stringOrFallback(exercise?.avoid, 'Stop for sharp or worsening pain, numbness, instability, or changed movement.'),
    durationSeconds: isHold
      ? clampNumber(Number(exercise?.durationSeconds) || 30, 15, 60)
      : 0,
    feel: stringOrFallback(exercise?.feel, isHold ? 'Mild, comfortable tension in the named area' : 'Smooth motion without pinching or compensation'),
    instruction: clearInstruction,
    equipment: stringOrFallback(exercise?.equipment, 'None'),
    name,
    reps: isHold ? 0 : clampNumber(Number(exercise?.reps) || 8, 4, 15),
    side,
    type,
    why: stringOrFallback(exercise?.why, 'This movement supports the selected routine goal.'),
  }
}

function expandRecoveryExerciseSides(exercise: any) {
  const name = String(exercise?.name ?? '')
  const side = String(exercise?.side ?? '')
  const instruction = String(exercise?.instruction ?? '')
  const alreadySideSpecific = /\b(left|right)( side)?\b/i.test(side) || /\s-\s(left|right)$/i.test(name)
  const explicitlyEachSide = /each side|left and right|right and left|one side at a time/i.test(side)
  const switchesSides = /switch (?:sides|legs|arms)|change (?:sides|legs|arms)|repeat (?:on|with) (?:the )?(?:other|opposite)/i.test(instruction)
  const knownUnilateralMovement = /single[- ]?(?:leg|arm)|half[- ]kneeling|figure[- ]four|open[- ]book|side[- ]lying|one[- ](?:arm|leg)|calf stretch|hamstring stretch|hip[- ]flexor stretch|doorway chest stretch|adductor rock[- ]back/i.test(name)

  if (alreadySideSpecific || (!explicitlyEachSide && !switchesSides && !knownUnilateralMovement)) return [exercise]

  return ['Left', 'Right'].map((currentSide) => ({
    ...exercise,
    name: `${name.replace(/\s*[-–]\s*(left|right)$/i, '').trim()} - ${currentSide}`,
    side: currentSide,
    instruction: makeRecoveryInstructionSideSpecific(instruction, name, currentSide),
  }))
}

function makeRecoveryInstructionSideSpecific(instruction: string, name: string, side: string) {
  const retained = instruction
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/switch (?:sides|legs|arms)|change (?:sides|legs|arms)|repeat (?:on|with) (?:the )?(?:other|opposite)/i.test(sentence))
    .join(' ')
    .trim()
  const loweredName = name.toLowerCase()
  const setup = /calf stretch/.test(loweredName)
    ? `Place your ${side.toLowerCase()} leg behind you as the stretching leg.`
    : /hamstring stretch/.test(loweredName)
      ? `Use your ${side.toLowerCase()} leg as the leg being stretched.`
      : /hip[- ]flexor/.test(loweredName)
        ? `Kneel on your ${side.toLowerCase()} knee to stretch the front of that hip.`
        : /doorway chest/.test(loweredName)
          ? `Place your ${side.toLowerCase()} forearm on the doorway.`
          : `Set up with your ${side.toLowerCase()} side as the working or stretching side.`

  return `${setup} ${retained} This timer is for the ${side.toLowerCase()} side only.`.trim()
}

function ensureSentence(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function avoidRepeatedRoutineOpening(exercises: any[], recentSequences: unknown, variationKey: unknown) {
  if (exercises.length < 4 || !Array.isArray(recentSequences)) return exercises
  const opening = exercises.slice(0, 2).map((exercise) => getExerciseFamilyName(exercise?.name)).join('|')
  const previousOpenings = new Set(recentSequences.map((sequence: any) => Array.isArray(sequence)
    ? sequence.slice(0, 2).map(getExerciseFamilyName).join('|')
    : ''))
  if (!previousOpenings.has(opening)) return exercises

  const seed = String(variationKey ?? '').split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const candidates = Array.from({ length: exercises.length - 2 }, (_, index) => index + 1)
  const offset = candidates.find((index) => {
    const pair = [exercises[index], exercises[(index + 1) % exercises.length]]
      .map((exercise) => getExerciseFamilyName(exercise?.name)).join('|')
    return !previousOpenings.has(pair)
  }) ?? (1 + (seed % (exercises.length - 2)))
  return [...exercises.slice(offset), ...exercises.slice(0, offset)]
}

function getExerciseFamilyName(value: unknown) {
  return String(value ?? '').replace(/\s*-\s*(left|right)$/i, '').trim().toLowerCase()
}

function getRoutineTitle(planType: unknown) {
  const titles: Record<string, string> = {
    flexibility: 'Full-body flexibility',
    mobility: 'Full-body mobility',
    quick: 'Quick recovery reset',
    competition: 'Competition recovery',
    'recovery-day': 'Recovery day routine',
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

function getRequesterKey(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload?.sub) return `user:${payload.sub}`
    } catch {
      // The Supabase gateway validates the token; use the network key only if its payload cannot be decoded.
    }
  }
  return `network:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
