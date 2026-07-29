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
  preparation: string[]
  reassess: string[]
  recovery: string[]
  reasons: string[]
  score: number
  summary: string
  tone: 'danger' | 'warning' | 'caution' | 'ready'
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
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite'
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        model,
        input: buildPrompt(body),
      }),
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

function buildPrompt(payload: unknown) {
  if ((payload as any)?.requestType === 'post_checkout') {
    return buildPostCheckoutPrompt(payload)
  }

  return `
You are Athlete Reload's training readiness assistant for student athletes.

Return ONLY valid JSON. No markdown. No extra commentary.

Use the athlete's check-in, the selected scheduled event, recent history, pain reports, and checkout data to create a recommendation for that specific event. The event is the main unit, not the calendar day. This is not a medical diagnosis. Be practical: do not default to "no training" for very low pain unless the symptoms are red flags. If there are red flags like head injury symptoms, numbness, severe pain, worsening swelling, instability, or pain at rest, recommend adult/medical/athletic trainer help.

Calibration rules:
- If energy is 5/5, soreness is 1/5, fatigue is 1/5, leg heaviness is 1/5, sleep is 9-10 hours, sleep quality is 4-5/5, stress is 1-2/5, hydration is adequate, and pain is 0 with no pain areas selected, readiness should be 92-100 and the label should be Full Training unless the schedule/history includes an obvious red flag.
- Do not punish an athlete for having a normal practice or gym session scheduled when all readiness inputs are excellent.
- For a game, do not choose Controlled Training just because the event is demanding. If readiness inputs are strong and there are no red flags, use Full Training and give game-specific preparation and monitoring instructions.
- Use Controlled Training only when the athlete can participate but a clearly identified demand needs to be reduced, such as overhead work, sprinting, jumping, cutting, contact, or volume.
- Low pain (1-2 out of 10) should usually lead to Full Training or Controlled Training with specific modifications, not automatic rest, unless the pain type is a red flag.
- Avoid/focus should be practical instructions for this event, not generic wellness filler.
- Give an event plan, not a binary clearance verdict. Explain what the athlete can do, what to change, how to warm up, when to reassess, and what to do afterward.
- Make each list item a complete, specific instruction of about 8-20 words.
- Do not use numeric pain cutoffs or phrases such as "exceeds 3/10" in the recommendation. Describe meaningful changes plainly, such as sharp pain, worsening symptoms, altered movement, or inability to perform the motion normally.
- Use the event type, sport, association, duration, intensity, surface, environment, and selected pain areas together. Shoulder symptoms should change overhead or throwing work; lower-body symptoms should change sprinting, jumping, cutting, or lifting.
- Consider expected duration, surface, indoor/outdoor environment, location/weather when present, expected difficulty, leg heaviness, illness symptoms, sleep quality, recovery actions, prior checkout completion, time since a hard session, and every selected pain area's type, trigger, trend, and affected movement.
- Treat hydrationOz as the athlete's cumulative fluid total so far today, measured at the time of this event. Compare it with the event start time: an early-morning event should not be judged as if the athlete had the whole day to hydrate, while an evening event reasonably has a higher expected total. Never penalize an early event simply because the daily total is not yet high.
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

function buildPostCheckoutPrompt(payload: unknown) {
  return `
You are Athlete Reload's post-training recovery assistant for student athletes.

Return ONLY valid JSON. No markdown. No extra commentary.

Use the scheduled event, the athlete's check-in, the completed checkout, recent history, pain reports, and notes to create a recovery recommendation after this specific session. This is not a medical diagnosis. The goal is to help the athlete recover from the session they just completed and monitor symptoms.

Important behavior:
- This is after training, not before training. Do not tell the athlete whether to participate in the session they already completed.
- Use the actual session length, difficulty/RPE, completion level, pain before versus pain after, pain map, and notes.
- Do not make this about deciding tomorrow's participation. Tomorrow's check-in handles that.
- Use the completed session intensity only to scale recovery care, not to predict readiness.
- Use the athlete profile's sport, position, training style, and dominant side to make recovery steps relevant to the session, without turning the profile into a diagnosis.
- If pain worsened, symptoms are new, or the athlete stopped early, give a more cautious recovery plan.
- If the session was completed normally with stable pain, give practical recovery steps without sounding alarmist.
- Red flags like head injury symptoms, numbness, severe or worsening pain, swelling, instability, breathing pain, or pain at rest should recommend adult/medical/athletic trainer help.
- Avoid/focus should be concrete recovery steps: hydration, food, cooldown, gentle mobility, light stretching when appropriate, icing for irritated/sore areas, elevation when swollen, sleep setup, symptom monitoring, and when to tell an adult/coach/athletic trainer.
- Make the recovery response detailed and actionable, including an order or timing such as immediately after training, later tonight, and before sleep.
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
  "reasons": array of 1 to 5 concrete reasons,
  "breakdown": array of score factors like [{"label":"Pain after session","value":-10}]
}

Athlete data:
${JSON.stringify(payload, null, 2)}
`
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text

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
  const calibratedScore = calibration.minScore ? Math.max(score, calibration.minScore) : score
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
    action: stringOrFallback(value.action, 'Use a conservative modified session and reassess after warm-up.'),
    avoid: calibration.clearAvoid ? [] : stringArray(value.avoid).slice(0, 4),
    breakdown: normalizeBreakdown(value.breakdown),
    during: stringArray(value.during).slice(0, 5),
    focus: stringArray(value.focus).slice(0, 5),
    intensity: calibration.intensity ?? stringOrFallback(value.intensity, 'Modified load'),
    label: calibration.label ?? formatEventLabel(stringOrFallback(value.label, 'Modified Participation'), payload),
    preparation: stringArray(value.preparation).slice(0, 5),
    reassess: stringArray(value.reassess).slice(0, 3),
    recovery: stringArray(value.recovery).slice(0, 5),
    reasons: stringArray(value.reasons).slice(0, 5),
    score: calibratedScore,
    summary: stringOrFallback(value.summary, 'Recommendation generated from this event check-in.'),
    tone,
  }
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

  return {}
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
