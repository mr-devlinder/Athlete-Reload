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
- Consider expected duration, surface, indoor/outdoor environment, location/weather when present, expected difficulty, leg heaviness, illness symptoms, sleep quality, recovery actions, and every selected pain area's type, trigger, trend, and affected movement. If previousCheckout is present, use only its session difficulty, duration, completion, physical response, pain change, and performance/focus data as the prior-session context.
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

Use the completed event, its preCheckIn, the current checkout, athlete profile, and previousCheckout to create a recovery recommendation after this specific session. previousCheckout is the only historical session context: do not infer or reference older sessions. This is not a medical diagnosis. The goal is to help the athlete recover from the session they just completed and monitor symptoms.

Important behavior:
- This is after training, not before training. Do not tell the athlete whether to participate in the session they already completed.
- Use participation, actual session length, session-RPE, session load, session content, fatigue and soreness after the event, pain before versus pain after, and the post-event body map.
- Consider new pain, cramping, dizziness, nausea, headache, unusual shortness of breath, changed movement or performance, performance rating, mental focus, motivation, and whether fatigue affected decisions or technique.
- Do not make this about deciding tomorrow's participation. Tomorrow's check-in handles that.
- Use the completed session intensity only to scale recovery care, not to predict readiness. A larger session load needs more deliberate recovery, but never call a number inherently safe or dangerous.
- Use the athlete profile's sport, position, training style, and dominant side to make recovery steps relevant to the session, without turning the profile into a diagnosis.
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
