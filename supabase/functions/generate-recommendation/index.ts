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
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!geminiApiKey) {
    return jsonResponse({ error: 'Missing GEMINI_API_KEY secret' }, 500)
  }

  try {
    const body = await request.json()
    if (body?.requestType === 'voice_extract') {
      const extractionResponse = await generateGeminiJson(geminiApiKey, buildVoiceExtractionPrompt(body))
      return jsonResponse({ extraction: extractionResponse })
    }
    const model = 'gemini-3.5-flash-lite'
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: buildPrompt(body) }] }] }),
    })

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text()
      return jsonResponse({ error: 'Gemini request failed', detail }, 502)
    }

    const data = await geminiResponse.json()
    const text = extractOutputText(data)
    const recommendation = normalizeRecommendation(JSON.parse(stripJsonFence(text)), body)

    return jsonResponse({ recommendation, source: 'gemini' })
  } catch (error) {
    return jsonResponse({
      error: 'Unable to generate recommendation',
      detail: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})

async function generateGeminiJson(apiKey: string, input: string) {
  const model = 'gemini-3.5-flash-lite'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: input }] }] }),
  })
  if (!response.ok) throw new Error('Gemini request failed')
  return JSON.parse(stripJsonFence(extractOutputText(await response.json())))
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
  "stress": "1 - Low"|"2"|"3"|"4"|"5 - High"|null,
  "illnessSymptoms": "None"|"Mild"|"Significant"|null,
  "expectedDifficulty": number|null,
  "notes": string
}`}
`
}

function buildPrompt(payload: unknown) {
  if ((payload as any)?.requestType === 'post_checkout') {
    return buildPostCheckoutPrompt(payload)
  }

  if ((payload as any)?.requestType === 'recovery_plan') {
    return buildRecoveryPlanPrompt(payload)
  }

  if ((payload as any)?.requestType === 'quick_checkin') {
    return buildQuickCheckInPrompt(payload)
  }

  return `
You are Athlete Reload's training readiness assistant for student athletes.

Return ONLY valid JSON. No markdown. No extra commentary.

Use the athlete's current check-in, the selected scheduled event in event, the athlete profile, and previousCheckout to create a recommendation for this specific event. The event is the main unit, not the calendar day. previousCheckout is the only historical session context: use only that single immediately previous completed event when present, and do not infer or reference older sessions. This is not a medical diagnosis. Be practical: do not default to "no training" for very low pain unless the symptoms are red flags. If there are red flags like head injury symptoms, numbness, severe pain, worsening swelling, instability, or pain at rest, recommend adult/medical/athletic trainer help.

Calibration rules:
- If energy is 5/5, soreness is 1/5, fatigue is 1/5, leg heaviness is 1/5, sleep is 9-10 hours, sleep quality is 4-5/5, stress is 1-2/5, hydration is adequate, and pain is 0 with no pain areas selected, readiness should be 92-100 and the label should be Full Training unless the schedule/history includes an obvious red flag.
- Do not punish an athlete for having a normal practice or gym session scheduled when all readiness inputs are excellent.
- For a game, do not choose Controlled Training just because the event is demanding. If readiness inputs are strong and there are no red flags, use Full Training and give game-specific preparation and monitoring instructions.
- Use Controlled Training only when the athlete can participate but a clearly identified demand needs to be reduced, such as overhead work, sprinting, jumping, cutting, contact, or volume.
- Low pain (1-2 out of 10) should usually lead to Full Training or Controlled Training with specific modifications, not automatic rest, unless the pain type is a red flag.
- A readiness score measures how much the event plan should be adjusted today; it is not a danger score, injury diagnosis, or measure of how serious a person is. Do not make a single low-level pain report dominate the score.
- With no red flags, a single low-level pain report should generally score in the mid-60s or above. A moderate pain report should usually mean a controlled or modified plan, not a crisis; scores below the mid-50s are for red flags or several meaningful readiness problems together.
- "Potential Bone Bruise" is not the same as a suspected bone stress injury or fracture. With a low, stable, localized symptom and no red flags, treat it as a bruise and recommend modifying only the affected demands.
- Sharp pain alone is not a reason to recommend sitting out when it is low-level, localized, stable, and only occurs during one specific movement. Modify that movement and any directly related contact, rather than removing the athlete from every drill.
- Reserve "Stop and Check In" and a medical-evaluation recommendation for explicit red flags: severe or rapidly worsening pain, meaningful pain at rest, inability to bear weight, obvious swelling/deformity, numbness/tingling/weakness, chest pain, breathing trouble, fainting/confusion, head injury symptoms, or a confirmed/suspected bone stress injury.
- Example calibration: an athlete with strong energy, minimal soreness/fatigue, seven or more hours of sleep, no illness, and one stable low-level localized symptom should receive a score in the high 60s to low 80s and a controlled or modified event plan. Keep the athlete in the event's unaffected work, modify only the related demands, and do not tell them to merely observe from the sidelines.
- Avoid/focus should be practical instructions for this event, not generic wellness filler.
- Give an event plan, not a binary clearance verdict. Explain what the athlete can do, what to change, how to warm up, when to reassess, and what to do afterward.
- Make each list item a complete, specific instruction of about 8-20 words.
- Always return 2-4 concrete items in each of preparation, during, and recovery. Those three arrays power the visible event-plan cards, so do not leave them empty.
- Do not use numeric pain cutoffs or phrases such as "exceeds 3/10" in the recommendation. Describe meaningful changes plainly, such as sharp pain, worsening symptoms, altered movement, or inability to perform the motion normally.
- Use the event type, sport, association, duration, intensity, surface, environment, and every selected pain area together. Tailor each modification to the athlete's sport and the actual event demands: upper-body symptoms may affect overhead work, throwing, catching, lifting, bracing, or contact; lower-body symptoms may affect sprinting, jumping, cutting, kicking, landing, or lifting; trunk symptoms may affect rotation, bracing, and contact. Head or neck symptoms require the red-flag rules.
- When event.tournament is present, account for the tournament date range and its scheduled games. A short turnaround to the next match should favor practical recovery, symptom monitoring, and avoiding unnecessary extra work; do not treat a tournament game like an isolated event.
- Consider expected duration, surface, indoor/outdoor environment, location/weather when present, expected difficulty, leg heaviness, illness symptoms, sleep quality, recovery actions, and every selected pain area's type, trigger, trend, and affected movement. If previousCheckout is present, use only its session difficulty, duration, completion, physical response, pain change, performance/focus data, and saved recoveryPlan action statuses or feedback as the prior-session context. Notice when an athlete repeatedly cannot complete an important recovery action, but do not shame them; make the next plan practical and prioritize the most important missing action.
- Treat hydrationOz as the athlete's cumulative fluid total so far today, measured at the time of this event. Compare it with the event start time: an early-morning event should not be judged as if the athlete had the whole day to hydrate, while an evening event reasonably has a higher expected total. Never penalize an early event simply because the daily total is not yet high.
- When dailyWellness and nutritionContext are present, use cumulative hydration, logged foods, macro totals, daily targets, meal timing, event timing, and the athlete's selected goals as live day context. Mention missing meal or hydration follow-through only as a practical preparation priority, never as a diagnosis and never with rigid calorie, body-weight, or fluid prescriptions. Do not make nutrition the sole reason to remove participation.
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
  "reasons": array of 1 to 5 concrete reasons,
  "breakdown": array of score factors like [{"label":"Sleep","value":-8}]
}

Athlete data:
${JSON.stringify(payload, null, 2)}
`
}

function buildQuickCheckInPrompt(payload: any) {
  return `
You are Athlete Reload's quick check-in assistant for a student athlete.
Use only the athlete's edited words below. Do not invent missing measurements or pretend the athlete answered the detailed check-in fields.
Create a practical event recommendation from the information that is actually present. Clearly state what is unknown and keep the plan conservative when important details are missing.
This is not medical advice or clearance. Direct the athlete to a parent, coach, athletic trainer, or qualified healthcare professional for red flags.

Return ONLY valid JSON in the same recommendation shape used by the app, including action, label, summary, score, tone, preparation, during, recovery, reasons, avoid, focus, reassess, intensity, nextEventWarning, and breakdown.

Quick check-in text:
${String(payload?.quickTranscript ?? '').trim()}
`
}

function buildPostCheckoutPrompt(payload: unknown) {
  return `
You are Athlete Reload's post-training recovery assistant for student athletes.

Return ONLY valid JSON. No markdown. No extra commentary.

Use the completed event, its preCheckIn, the current checkout, athlete profile, and previousCheckout to create a recovery recommendation after this specific session. previousCheckout is the only historical session context: do not infer or reference older sessions. This is not a medical diagnosis. The goal is to help the athlete recover from the session they just completed and monitor symptoms.

Important behavior:
- This is after training, not before training. Do not tell the athlete whether to participate in the session they already completed.
- Use participation, actual session length, session-RPE, session load, session content, fatigue and soreness after the event, pain before versus pain after, and the post-event body map.
- Consider new pain, cramping, dizziness, nausea, headache, unusual shortness of breath, changed movement or performance, performance rating, mental focus, motivation, and whether fatigue affected decisions or technique.
- Do not make this about deciding tomorrow's participation. Tomorrow's check-in handles that.
- Use the completed session intensity only to scale recovery care, not to predict readiness. A larger session load needs more deliberate recovery, but never call a number inherently safe or dangerous.
- Use the athlete profile's sport, position, training style, and dominant side to make recovery steps relevant to the session, without turning the profile into a diagnosis.
- Use dailyWellness and nutritionContext for practical recovery-food and hydration priorities based on what the athlete has already logged, their targets, goals, and the completed session. Do not prescribe exact medical nutrition quantities or make nutrition the sole reason to escalate a symptom.
- If pain worsened, symptoms are new, movement changed, or the athlete stopped early, give a more cautious recovery plan and a concise next-event warning for the following check-in.
- If the session was completed normally with stable pain, give practical recovery steps without sounding alarmist.
- When the athlete reports cramping with dizziness, nausea, headache, or unusual shortness of breath, instruct them to stop additional exercise, move to a cool environment, and tell an adult, coach, or trainer. State that fainting, confusion, vomiting, or severe/worsening symptoms require urgent help.
- Red flags like head injury symptoms, numbness, severe or worsening pain, swelling, instability, breathing pain, or pain at rest should recommend adult/medical/athletic trainer help.
- Use concrete recovery steps: hydration according to team or medical guidance, food, cooldown, gentle mobility, light stretching when appropriate, icing for irritated/sore areas, elevation when swollen, sleep setup, symptom monitoring, and when to tell an adult/coach/athletic trainer.
- Make the recovery response detailed and actionable, including an order or timing such as immediately after training, later tonight, and before sleep.
- Always return 2-4 concrete items in each of preparation, during, and recovery. Those three arrays power the visible recovery-plan cards, so do not leave them empty.
- For a shorter or easier-than-planned session with stable symptoms, explain that normal recovery is appropriate and they should not automatically add extra training.
- Do not say "prepare for the next session" unless it is a small note inside the recovery context. Do not mention the next event as the main recommendation.

JSON shape:
{
  "score": number from 0 to 100, still required for storage but not shown in the recovery UI,
  "label": "Normal Recovery" | "Monitor Symptoms" | "Extra Recovery" | "Tell an Adult / Trainer" | "Seek Help",
  "tone": "ready" | "caution" | "warning" | "danger",
  "intensity": short recovery category phrase like "Normal cooldown" or "Soreness care",
  "summary": one short sentence explaining the recovery plan,
  "action": one specific paragraph telling the athlete what to do tonight after training,
  "avoid": array of 0 to 4 specific things to avoid during recovery,
  "focus": array of 3 to 5 specific recovery actions,
  "preparation": array of 0 to 2 immediate post-session steps,
  "during": array of 0 to 2 symptom-monitoring steps for the next few hours,
  "recovery": array of 3 to 5 detailed recovery steps in order,
  "nextEventWarning": one concise carry-forward warning for the next check-in, or an empty string when no special warning is needed,
  "reasons": array of 1 to 5 concrete reasons,
  "breakdown": array of score factors like [{"label":"Pain after session","value":-10}]
}

Athlete data:
${JSON.stringify(payload, null, 2)}
`
}

function buildRecoveryPlanPrompt(payload: unknown) {
  return `
You are Athlete Reload's recovery planning assistant for student athletes.

Return ONLY valid JSON. No markdown. No extra commentary.

Build an actionable recovery plan from the athlete's latest completed checkout, its pre-event check-in, the completed event, athlete profile, equipment choice, available time, and the next scheduled event. This is not medical advice or injury diagnosis.

Important behavior:
- The recovery plan is for the completed event. Do not decide whether the athlete is cleared for the next event.
- Use actual minutes, session difficulty, participation, session content, surface, sport, position, current soreness, pain before versus after, new symptoms, changed movement, and the next event's timing together.
- Generate 3-6 prioritized Do now recovery steps. Each needs a title, why it matters, and a suggested completion time.
- Use dailyWellness, nutritionContext, selected goals, and dietary preferences to make food and hydration steps practical. Use what is already logged that day; do not prescribe exact medical nutrition quantities or claim a meal repairs an injury.
- Include normal recovery habits such as fluids, a normal meal or snack, sleep, a cooldown, and comfortable mobility when appropriate. Do not prescribe exact medical or nutrition quantities.
- If participation was Did not participate, do not recommend recovery for training that did not happen. Focus on symptom monitoring, comfortable whole-body recovery, and evaluation guidance when needed.
- A painful area must not automatically receive a deeper stretch. Sharp or worsening pain, limping, loss of movement, instability, swelling, numbness, concerning symptoms, or changed movement should remove that area from stretching and recommend telling a parent, coach, athletic trainer, or qualified healthcare professional.
- Do not imply stretching prevents soreness or injury or that temporary looseness proves healing. Present it as optional comfortable mobility or relaxation.
- Treat the supplied timeAvailable as an exact routine time budget, not merely a maximum. Set routine.durationMinutes to exactly that selected whole-minute duration. The sum of the individual timed exercise steps must land within about one minute of that duration, with enough distinct exercises to cover full-body recovery. Adjust the content to effort, duration, participation, and the next event. The equipment array describes what is available, but the routine does not need to use every item. Always include a no-equipment option.
- Build a real stretching and mobility routine, not generic filler. The routine must contain enough distinct stretches and movements to use the full exact time budget. For 10 minutes, return 10-14 individual exercise steps; for 15 minutes, 14-18; for 20 minutes, 18-24; for 30 minutes, 24-32. Each step should usually be a 20-45 second hold or 6-12 controlled repetitions; do not rely on long holds to fill time. Never prescribe a three-minute hold or a multi-minute single movement.
- Only split a movement into separate left and right exercise steps when it is genuinely unilateral. For example, output "Half-kneeling hip-flexor stretch - Left" and then a separate "Half-kneeling hip-flexor stretch - Right" instead of one "each side" entry. Keep truly bilateral or full-body movements, such as cat-cow, child's pose, wall slides, or a symmetrical squat hold, as one exercise labeled "Both sides" or "Full body". Do not force a left/right split where it does not make sense.
- Build every routine as full-body recovery, not only an injury-focused sequence. Include comfortable mobility or flexibility for the major regions relevant after activity: neck/upper back and shoulders, trunk/thoracic movement, hips, legs, and ankles/feet, unless a reported symptom makes a region inappropriate. Then devote additional exercises to the athlete's pain areas, sport demands, and session content. Keep painful or concerning areas protected rather than forcing direct stretching.
- Do not include standalone walking, breathing, or generic ankle rolls as routine exercises. They are not acceptable filler. Only include a short cooldown movement when it is specific to the completed sport or a symptom/safety concern, and it must never replace the stretching and mobility work.
- Prefer useful movement variety: dynamic range work, joint-specific mobility, controlled rotations, tissue-friendly flexibility, and side-specific stretches. Every routine should feel like something an athlete can actually follow exercise by exercise.
- Prefer widely recognized, high-quality recovery and mobility movements with clear form cues: for example, cat-cow, open books, child's pose, thread-the-needle, wall slides, shoulder circles, chest doorway stretches, hip flexor stretches, 90/90 hip switches, adductor rock-backs, hamstring flosses, calf stretches, ankle dorsiflexion mobility, and gentle quad stretches when appropriate. Use niche or specialty exercises only when they clearly fit a specific sport, position, painful area, equipment choice, or movement limitation. Do not choose unusual movements just to create variety.
- Match most exercises to the active body areas and sport demands. For a mild, stable shoulder symptom without red flags, favor comfortable shoulder range, scapular control, thoracic rotation or extension, chest and lat flexibility, and optional gentle neck mobility when it feels relevant. Do not default to lower-body or ankle exercises for a shoulder-focused report.
- For lower-body symptoms, use the specific involved region and related joints. For example, a stable calf issue can use calf and ankle mobility; a hamstring issue can use gentle hip and hamstring movement; a knee issue can use comfortable hip, quad, and ankle mobility. Do not stretch directly into sharp, worsening, unstable, numb, swollen, or movement-changing symptoms.
- Use each exercise's instruction, side, feel, and avoid fields well. Include a mix of reps and holds, clear body-area labels, and enough useful work to fill the selected time without exceeding it.
- Use sport and position. A volleyball shoulder routine, soccer lower-body routine, baseball pitcher routine, and lower-body gym routine should differ when the supplied data supports it.
- If the next event is soon, shorten the routine and prioritize prompt food, fluids, sleep, and symptom monitoring. If the next day is a rest day, a slightly longer comfortable mobility routine may fit.
- Do not use a readiness score in this response. A stored score may be 0.

JSON shape:
{
  "label": "Immediate recovery" | "Extra recovery" | "Monitor symptoms" | "Tell an adult / trainer",
  "tone": "ready" | "caution" | "warning" | "danger",
  "summary": "one short sentence",
  "action": "one short paragraph describing the priority tonight",
  "recoverySteps": [{"title":"Drink fluids","why":"Why this matters","when":"Right now"}],
  "timeline": [{"title":"Right now","items":["..."]},{"title":"Within two hours","items":["..."]},{"title":"Tonight","items":["..."]},{"title":"Tomorrow morning","items":["..."]}],
  "routine": {"title":"sport-aware routine title","summary":"optional comfortable routine explanation","durationMinutes":10,"painAware":true,"exercises":[{"name":"movement name","type":"Mobility","area":"body area","side":"Both sides","durationSeconds":30,"instruction":"...","why":"short reason this movement fits this session","feel":"...","avoid":"..."}]},
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

function normalizeRecommendation(value: any, payload?: any): Recommendation {
  const calibration = getCalibration(payload)
  const score = clampNumber(value.score, 0, 100)
  const scoreWithMinimum = calibration.minScore ? Math.max(score, calibration.minScore) : score
  const calibratedScore = calibration.maxScore ? Math.min(scoreWithMinimum, calibration.maxScore) : scoreWithMinimum
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
    action: calibration.minorLocalizedPain && hasOverlyRestrictiveAdvice(action)
      ? getMinorPainAction(payload)
      : action,
    avoid: calibration.clearAvoid ? [] : removeOverlyRestrictiveAdvice(stringArray(value.avoid).slice(0, 4), calibration),
    breakdown: normalizeBreakdown(value.breakdown),
    during: ensurePlanItems(removeOverlyRestrictiveAdvice(during, calibration), sectionFallbacks.during),
    focus: removeOverlyRestrictiveAdvice(stringArray(value.focus).slice(0, 5), calibration),
    intensity: calibration.intensity ?? stringOrFallback(value.intensity, 'Modified load'),
    label: getRecommendationLabel(value, calibration, payload),
    nextEventWarning: stringOrFallback(value.nextEventWarning, ''),
    preparation: ensurePlanItems(removeOverlyRestrictiveAdvice(prepare, calibration), sectionFallbacks.preparation),
    reassess: stringArray(value.reassess).slice(0, 3),
    recovery: ensurePlanItems(recovery, sectionFallbacks.recovery),
    recoverySteps: normalizeRecoverySteps(value.recoverySteps, recovery),
    reasons: stringArray(value.reasons).slice(0, 5),
    score: calibratedScore,
    summary: stringOrFallback(value.summary, 'Recommendation generated from this event check-in.'),
    timeline: normalizeRecoveryTimeline(value.timeline, prepare, during, recovery),
    tone,
    routine: normalizeRoutine(value.routine, payload),
  }
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
  if (Array.isArray(value) && value.length > 0) {
    return value.slice(0, 4).map((phase, index) => ({
      title: stringOrFallback(phase?.title, ['Right now', 'Within two hours', 'Tonight', 'Tomorrow morning'][index]),
      items: stringArray(phase?.items).slice(0, 5),
    })).filter((phase) => phase.items.length > 0)
  }

  return [
    { title: 'Right now', items: preparation.slice(0, 4) },
    { title: 'Within two hours', items: during.slice(0, 4) },
    { title: 'Tonight', items: recovery.slice(0, 5) },
    { title: 'Tomorrow morning', items: ['Recheck soreness and pain before the next readiness check.'] },
  ]
}

function normalizeRoutine(value: any, payload?: any) {
  const exercises = Array.isArray(value?.exercises)
    ? value.exercises.slice(0, 32).map((exercise: any) => ({
      area: stringOrFallback(exercise?.area, 'Comfortable range'),
      avoid: stringOrFallback(exercise?.avoid, 'Sharp or worsening pain'),
      durationSeconds: Number.isFinite(Number(exercise?.durationSeconds))
        ? clampNumber(exercise.durationSeconds, 15, 60)
        : 0,
      feel: stringOrFallback(exercise?.feel, 'Mild, comfortable tension'),
      instruction: stringOrFallback(exercise?.instruction, 'Move slowly through a comfortable range.'),
      name: stringOrFallback(exercise?.name, 'Gentle mobility'),
      reps: Number.isFinite(Number(exercise?.reps))
        ? clampNumber(exercise.reps, 4, 15)
        : 0,
      side: stringOrFallback(exercise?.side, 'Both sides'),
      type: stringOrFallback(exercise?.type, 'Mobility'),
      why: stringOrFallback(exercise?.why, 'This fits the recovery plan for the session you completed.'),
    }))
    : []

  return {
    durationMinutes: getRequestedRoutineMinutes(payload?.timeAvailable) ?? Math.max(10, Math.min(30, Math.round(Number(value?.durationMinutes) || 10))),
    exercises,
    painAware: Boolean(value?.painAware),
    summary: stringOrFallback(value?.summary, 'Use comfortable movement as an optional way to relax and maintain mobility.'),
    title: stringOrFallback(value?.title, 'Cooldown and mobility'),
  }
}

function getRequestedRoutineMinutes(value: unknown) {
  const minutes = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(minutes) && minutes >= 10 && minutes <= 30 ? minutes : null
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

function getCalibration(payload: any) {
  if (payload?.requestType === 'post_checkout') return {}

  const checkIn = payload?.checkIn

  if (!checkIn) return {}

  const idealReadiness =
    Number(checkIn.energy) >= 5 &&
    Number(checkIn.soreness) <= 1 &&
    Number(checkIn.fatigue) <= 1 &&
    Number(checkIn.legHeaviness ?? 1) <= 1 &&
    Number(checkIn.sleep) >= 9 &&
    ['Low', '1 - Low', '2'].includes(checkIn.stress) &&
    checkIn.hydration === 'Good' &&
    Number(checkIn.pain) === 0

  if (idealReadiness) {
    return {
      clearAvoid: true,
      intensity: 'Normal load',
      label: 'Full Training',
      minScore: 92,
      tone: 'ready',
    }
  }

  const painDetails = Object.values(checkIn.painDetails ?? {}) as Array<any>
  const painLevels = [Number(checkIn.pain), ...Object.values(checkIn.painMap ?? {}).map(Number)]
    .filter(Number.isFinite)
  const highestPain = Math.max(0, ...painLevels)
  const allPainDetails = [
    {
      injuryType: checkIn.injuryType,
      painType: checkIn.painType,
      hurtsWhen: checkIn.hurtsWhen,
    },
    ...painDetails,
  ]
  const hasRedFlag = highestPain >= 8
    || String(checkIn.illnessSymptoms ?? '').toLowerCase() === 'significant'
    || allPainDetails.some((detail) => {
      const injuryType = String(detail?.injuryType ?? '').toLowerCase()
      const painType = String(detail?.painType ?? '').toLowerCase()
      const hurtsWhen = String(detail?.hurtsWhen ?? '').toLowerCase()

      return injuryType.includes('concussion')
        || injuryType.includes('bone stress')
        || painType.includes('numb')
        || painType.includes('tingling')
        || painType.includes('instability')
        || painType.includes('headache')
        || hurtsWhen.includes('breathing')
        || (hurtsWhen === 'at rest' && highestPain >= 4)
    })
  const stableMinorLocalizedPain =
    highestPain > 0
    && highestPain <= 2
    && !hasRedFlag
    && Number(checkIn.energy) >= 4
    && Number(checkIn.soreness) <= 1
    && Number(checkIn.fatigue) <= 1
    && Number(checkIn.legHeaviness ?? 1) <= 2
    && Number(checkIn.sleep) >= 7
    && String(checkIn.illnessSymptoms ?? 'None').toLowerCase() === 'none'

  if (stableMinorLocalizedPain) {
    return {
      intensity: 'Modified event plan',
      label: 'Modified Participation',
      maxScore: 82,
      minScore: 68,
      minorLocalizedPain: true,
      tone: 'caution',
    }
  }

  if (highestPain > 0 && highestPain <= 2 && !hasRedFlag) {
    return {
      minScore: 64,
      preventStopLabel: true,
    }
  }

  if (highestPain >= 3 && highestPain <= 4 && !hasRedFlag) {
    return {
      minScore: 56,
      preventStopLabel: true,
    }
  }

  return {}
}

function hasOverlyRestrictiveAdvice(value: string) {
  return /(sit out|sideline|observe practice|no training|do not begin|medical evaluation before|consult a medical)/i.test(value)
}

function removeOverlyRestrictiveAdvice(items: string[], calibration: any) {
  if (!calibration.minorLocalizedPain) return items

  return items.filter((item) => !hasOverlyRestrictiveAdvice(item))
}

function getRecommendationLabel(value: any, calibration: any, payload?: any) {
  if (calibration.label) return calibration.label

  const requestedLabel = stringOrFallback(value.label, 'Modified Participation')
  if (calibration.preventStopLabel && /stop and check in|no training|rehab|rest/i.test(requestedLabel)) {
    return formatEventLabel('Controlled Training', payload)
  }

  return formatEventLabel(requestedLabel, payload)
}

function getMinorPainAction(payload: any) {
  const checkIn = payload?.checkIn ?? {}
  const area = String(checkIn.location ?? 'affected area').toLowerCase()
  const event = payload?.schedule?.find((item: any) => item?.id === checkIn.eventId)
  const eventName = String(event?.type ?? event?.title ?? checkIn.session ?? 'event').toLowerCase()

  return `Take part in ${eventName}, but modify only the movements that recreate your ${area} symptoms and related contact. Keep the unaffected parts of the session, use controlled alternatives for the trigger, and stop that specific movement if symptoms become sharper or change your form.`
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
