import { getActivityDemandProfile, getDemandSummary } from '../domain/activityDemands'
import { evaluateSafety } from '../domain/safety'
import { summarizeRecentLoad } from '../domain/workload'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const RECOMMENDATION_SCHEMA_VERSION = 2

export function buildAthleteContext({
  athleteProfile = {},
  checkIn = null,
  checkout = null,
  event = null,
  generatedAt = new Date().toISOString(),
  nutritionContext = {},
  recentEvents = [],
  recentPainReports = [],
  scheduleContext = {},
  weather = null,
}) {
  const now = new Date(generatedAt)
  const eventDurationMinutes = positiveNumber(
    checkout?.actualMinutes ?? event?.plannedMinutes ?? event?.expectedDuration,
  )
  const intensity = parseIntensity(checkout?.difficulty ?? checkout?.actualIntensity ?? event?.loadLevel ?? event?.load)
  const weightKg = positiveNumber(athleteProfile.weightKg)
  const currentPain = normalizeCurrentPain(checkout ?? checkIn)
  const eventDate = getEventDate(event)
  const eventStartsInMinutes = eventDate ? Math.round((eventDate.getTime() - now.getTime()) / 60000) : null
  const resolvedWeather = weather ?? event?.weather ?? null
  const heat = getHeatContext(resolvedWeather, event)
  const freshness = {
    currentBody: freshnessOf(checkout?.createdAt ?? checkIn?.createdAt ?? checkIn?.date, now),
    nutrition: freshnessOf(nutritionContext.updatedAt ?? nutritionContext.date, now),
    weather: freshnessOf(resolvedWeather?.observedAt ?? resolvedWeather?.time, now),
  }
  const missing = [
    !weightKg && 'athlete weight',
    !eventDurationMinutes && 'event duration',
    !event?.type && !event?.eventType && 'event type',
    eventStartsInMinutes == null && 'event start time',
    nutritionContext.hasFoodLogs !== true && 'recent food',
    nutritionContext.hasHydrationLogs !== true && 'recent hydration',
  ].filter(Boolean)
  const activityDemand = getActivityDemandProfile({ sport: athleteProfile.sport, event, workload: checkout ?? {} })
  const safetyFindings = evaluateSafety(checkout ?? checkIn ?? {})
  const recentLoad = summarizeRecentLoad(recentEvents, now)
  const confidence = Math.round(Math.max(0.35, Math.min(0.98, 1 - missing.length * 0.08 + Math.min(0.2, recentEvents.length * 0.03))) * 100) / 100

  return {
    schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
    generatedAt,
    athlete: compact({
      ageYears: positiveNumber(athleteProfile.ageYears ?? athleteProfile.age),
      goals: athleteProfile.goals,
      position: athleteProfile.position,
      sport: athleteProfile.sport,
      trainingStyle: athleteProfile.trainingStyle,
      weightKg,
    }),
    event: compact({
      durationMinutes: eventDurationMinutes,
      environment: event?.environment,
      startsInMinutes: eventStartsInMinutes,
      surface: event?.surface,
      title: event?.title,
      type: event?.type ?? event?.eventType,
      intensity,
    }),
    current: compact({
      fatigue: numberOrNull(checkout?.postFatigue ?? checkIn?.fatigue),
      participation: checkout?.participation,
      pain: currentPain,
      sleepHours: numberOrNull(checkIn?.sleep),
      sleepQuality: numberOrNull(checkIn?.sleepQuality),
      soreness: numberOrNull(checkout?.postSoreness ?? checkIn?.soreness),
    }),
    currentState: compact({
      energy: numberOrNull(checkIn?.energy),
      fatigue: numberOrNull(checkout?.postFatigue ?? checkIn?.fatigue),
      illnessSymptoms: numberOrNull(checkIn?.illnessSymptoms),
      pain: currentPain,
      sleepHours: numberOrNull(checkIn?.sleep),
      sleepQuality: numberOrNull(checkIn?.sleepQuality),
      soreness: numberOrNull(checkout?.postSoreness ?? checkIn?.soreness),
      stress: numberOrNull(checkIn?.stress),
    }),
    recentLoad,
    upcomingDemand: {
      profile: activityDemand,
      strongestDemands: getDemandSummary(activityDemand),
      eventCountToday: Number(scheduleContext?.sameDayEvents?.length ?? scheduleContext?.eventCountToday ?? 1),
    },
    safetyFindings,
    confidence,
    environment: heat,
    nutrition: compact({
      hasFoodLogs: nutritionContext.hasFoodLogs === true,
      hasHydrationLogs: nutritionContext.hasHydrationLogs === true,
      hydrationMl: nutritionContext.hasHydrationLogs === true ? numberOrNull(nutritionContext.hydrationMl) : null,
      mealBreakdown: nutritionContext.hasFoodLogs === true ? nutritionContext.mealBreakdown : null,
    }),
    recent: {
      events: recentEvents.slice(0, 7),
      painReports: recentPainReports.filter((report) => isFresh(report.createdAt ?? report.date, now, 14)).slice(0, 12),
      schedule: scheduleContext,
    },
    freshness,
    missing,
    targets: calculatePerformanceTargets({
      durationMinutes: eventDurationMinutes,
      heat,
      intensity,
      startsInMinutes: eventStartsInMinutes,
      weightKg,
    }),
  }
}

export function calculatePerformanceTargets({
  durationMinutes,
  heat = {},
  intensity = 5,
  startsInMinutes = null,
  sweatRateMlPerHour = null,
  weightKg,
}) {
  const weight = positiveNumber(weightKg)
  const duration = positiveNumber(durationMinutes)
  const intensityFactor = clamp(Number(intensity) || 5, 1, 10) / 10
  const heatFactor = heat.isHot ? 1.2 : heat.isWarm ? 1.1 : 1
  const baseHourly = sweatRateMlPerHour
    ? clamp(Number(sweatRateMlPerHour), 200, 1200)
    : clamp((weight || 65) * (6 + intensityFactor * 4) * heatFactor, 300, 900)
  const duringLow = roundTo(baseHourly * 0.8, 50)
  const duringHigh = roundTo(Math.min(baseHourly * 1.05, 1000), 50)
  const preLow = weight ? roundTo(weight * 5, 50) : 300
  const preHigh = weight ? roundTo(weight * 7, 50) : 500
  const longOrHard = (duration ?? 0) >= 60 || intensityFactor >= 0.75
  const veryLong = (duration ?? 0) >= 90
  const carbBase = weight || 65
  const timeWindowHours = startsInMinutes == null ? null : startsInMinutes / 60
  const preCarbMultiplier = timeWindowHours != null && timeWindowHours <= 1 ? 0.5 : timeWindowHours != null && timeWindowHours >= 2 ? 1.5 : 1

  return {
    confidence: weight && duration ? 'personalized-range' : 'baseline-range',
    hydration: {
      preEventMl: { low: preLow, high: preHigh, timing: 'about 2-4 hours before' },
      duringMlPerHour: duration && duration < 45 && !heat.isHot ? null : { low: duringLow, high: duringHigh },
      electrolytesUseful: Boolean(veryLong || heat.isHot),
      note: sweatRateMlPerHour ? 'Uses your measured sweat rate.' : 'Estimated range; personal sweat rate is not available.',
    },
    fueling: {
      preEventCarbsG: weight ? range(carbBase * preCarbMultiplier * 0.8, carbBase * preCarbMultiplier * 1.2, 5) : null,
      preEventProteinG: weight ? range(weight * 0.2, weight * 0.3, 5) : { low: 15, high: 25 },
      mealType: timeWindowHours != null && timeWindowHours <= 1 ? 'small familiar snack' : 'meal or substantial snack',
      duringCarbsGPerHour: longOrHard ? (veryLong ? { low: 30, high: 60 } : { low: 20, high: 40 }) : null,
    },
    recovery: {
      carbsG: weight && longOrHard ? range(weight * 0.8, weight * 1.2, 5) : null,
      proteinG: weight ? range(weight * 0.25, weight * 0.3, 5) : { low: 15, high: 25 },
      rehydrationMl: duration ? range((baseHourly * duration / 60) * 0.8, (baseHourly * duration / 60) * 1.1, 50) : null,
    },
  }
}

export function buildFallbackRecommendation(requestType, context) {
  const targets = context?.targets ?? {}
  const pain = context?.current?.pain
  const hasPain = Number(pain?.highestSeverity) > 0
  const hydration = targets.hydration ?? {}
  const fueling = targets.fueling ?? {}
  const recovery = targets.recovery ?? {}
  const factors = [context?.athlete?.sport, context?.event?.type, context?.event?.durationMinutes && `${context.event.durationMinutes} minutes`, context?.environment?.isHot && 'hot conditions', hasPain && 'current pain'].filter(Boolean)

  if (requestType === 'recovery_plan') {
    return {
      ...baseFallback(context, hasPain ? 'Protective recovery' : 'Balanced recovery', hasPain ? 'Use comfortable movement and protect the currently painful area.' : 'Use a short, comfortable routine and support it with food, fluids, and sleep.', [
        section('recovery-status', 'Recovery Status', hasPain ? 'Take extra care with the current symptom.' : 'Normal recovery support is appropriate.'),
        section('recovery-priorities', 'Recovery Priorities', 'Focus on the few actions most likely to help now.', ['Complete the comfortable routine below.', 'Return to normal food and hydration gradually.', 'Protect the next useful sleep window.']),
        section('recovery-timeline', 'Recovery Timeline', 'Reassess after the routine and again before the next planned event.'),
      ], factors),
      planType: 'fallback',
      routine: {
        durationMinutes: 5,
        exercises: [],
        goal: 'Comfortable whole-body recovery',
        painAware: hasPain,
        summary: 'AI routine details are unavailable, so use easy pain-free movement only.',
        title: 'Simple recovery reset',
      },
    }
  }

  if (requestType === 'post_checkout') {
    const effort = Number(context?.event?.intensity ?? 0)
    const status = hasPain ? 'Take extra care' : effort >= 8 ? 'Higher recovery need' : 'Normal recovery'
    return baseFallback(context, status, hasPain ? 'Current symptoms deserve attention before adding more load.' : 'Use the next few hours to restore normal energy and hydration.', [
      section('session-summary', 'Session Summary', `${context?.event?.durationMinutes ?? 'Recorded'} minutes at ${effort || 'recorded'} effort with ${context?.current?.participation ?? 'recorded'} participation.`),
      section('recovery-status', 'Recovery Status', status),
      recovery.rehydrationMl && section('hydration-recovery', 'Hydration', `Gradually replace approximately ${formatRange(recovery.rehydrationMl)} mL, adjusting for thirst and your normal tolerance.`),
      section('nutrition-recovery', 'Nutrition', recovery.proteinG ? `Choose a familiar meal or snack with ${formatRange(recovery.proteinG)} g protein${recovery.carbsG ? ` and ${formatRange(recovery.carbsG)} g carbohydrate` : ''}.` : 'Choose a familiar balanced meal or snack when comfortable.'),
      hasPain && section('new-pain-soreness', 'New Pain or Soreness', 'Avoid movements that reproduce or worsen the current symptom and tell an adult or trainer if function changes.'),
      section('next-few-hours', 'Next Few Hours', 'Keep the recovery plan simple.', ['Cool down with easy event-specific movement if it feels comfortable.', 'Eat and drink gradually instead of trying to catch up at once.', 'Recheck pain, soreness, and fatigue before adding more activity.']),
    ], factors)
  }

  return baseFallback(context, hasPain ? 'Prepare with modifications' : 'Ready to prepare', hasPain ? 'Use a progressive warm-up and reassess the currently painful movement.' : 'Use the timeline below to arrive prepared for this event.', [
    section('readiness-status', 'Readiness', hasPain ? 'Current pain is the main factor changing preparation.' : 'No current pain restriction was reported.'),
    section('warm-up-focus', 'Warm-up Focus', sportWarmup(context), hasPain ? ['Build intensity gradually.', 'Reassess the painful movement before event speed.'] : ['Build from easy movement to event speed.', 'Finish with sport-specific actions.']),
    section('hydration-target', 'Hydration Target', `Aim for ${formatRange(hydration.preEventMl)} mL ${hydration.preEventMl?.timing ?? 'before the event'}.${hydration.note ? ` ${hydration.note}` : ''}`),
    section('fueling-target', 'Fueling Target', fueling.preEventCarbsG ? `Choose a ${fueling.mealType} with approximately ${formatRange(fueling.preEventCarbsG)} g carbohydrate and ${formatRange(fueling.preEventProteinG)} g protein.` : 'Choose a familiar meal or snack that fits the time available.'),
    fueling.duringCarbsGPerHour && section('during-event-fueling', 'During-event Fueling', `For this longer event, approximately ${formatRange(fueling.duringCarbsGPerHour)} g carbohydrate per hour may be useful if tolerated.`),
    section('performance-focus', 'Performance Focus', 'Start controlled, use the warm-up as feedback, and adjust only the demands affected by current symptoms.'),
    hasPain && section('pain-guidance', 'Pain and Soreness Guidance', 'Modify only movements connected to the currently reported area; stop and tell an adult or trainer if symptoms worsen or movement changes.'),
    section('pre-event-timeline', 'Quick Timeline', '', timelineItems(context, targets)),
  ], factors)
}

function baseFallback(context, label, summary, sections, contextFactors) {
  return {
    _source: 'local', action: summary, avoid: [], breakdown: [], contextFactors, contextSnapshot: context,
    during: [], focus: [], intensity: 'Use event-specific preparation', label, nextEventWarning: '', preparation: [],
    reassess: [], reasons: contextFactors, recovery: [], reportSections: sections.filter(Boolean), schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
    score: Number(context?.current?.pain?.highestSeverity) > 0 ? 68 : 82, summary, targets: context?.targets ?? {}, tone: Number(context?.current?.pain?.highestSeverity) > 0 ? 'caution' : 'ready',
  }
}

function section(id, title, summary, items = []) { return { id, title, summary, items } }
function formatRange(value) { return value ? `${value.low}-${value.high}` : '' }
function sportWarmup(context) {
  const sport = String(context?.athlete?.sport ?? context?.event?.type ?? 'event').toLowerCase()
  if (/soccer|football|run/.test(sport)) return 'Prioritize ankles, calves, hips, progressive running, and event-speed direction changes.'
  if (/weight|gym|lift/.test(sport)) return 'Prepare the joints and movement patterns used in the first working sets, then ramp load gradually.'
  if (/volleyball|basketball/.test(sport)) return 'Prepare ankles, hips, shoulders, landing mechanics, and progressive jumping or overhead work.'
  return 'Move through the event-specific ranges first, then build speed and intensity gradually.'
}
function timelineItems(context, targets) {
  const items = []
  if (Number(context?.event?.startsInMinutes) >= 120) items.push(`2-3 hours before: ${formatRange(targets?.hydration?.preEventMl)} mL fluid and a familiar ${targets?.fueling?.mealType ?? 'meal or snack'}.`)
  items.push('30-60 minutes before: sip gradually, check current symptoms, and avoid last-minute catch-up eating or drinking.')
  items.push('Warm-up: progress from comfortable movement to the exact speed, range, and skill the event requires.')
  if (targets?.hydration?.duringMlPerHour || targets?.fueling?.duringCarbsGPerHour) items.push('During event: use the supplied fluid or fuel ranges as tolerated and never drink beyond losses.')
  return items
}

function normalizeCurrentPain(report = {}) {
  const painMap = Object.fromEntries(
    Object.entries(report?.painMap ?? {}).filter(([, severity]) => Number(severity) > 0),
  )
  return {
    areas: painMap,
    highestSeverity: Math.max(0, Number(report?.pain) || 0, ...Object.values(painMap).map(Number)),
    details: report?.painDetails ?? null,
    isNew: Boolean(report?.newPain),
  }
}

function getHeatContext(weather, event) {
  const temperatureC = numberOrNull(weather?.temperatureC ?? weather?.temperature)
  const environment = String(event?.environment ?? '').toLowerCase()
  return compact({
    available: temperatureC != null || Boolean(weather),
    indoor: environment.includes('indoor'),
    isHot: temperatureC != null && temperatureC >= 29,
    isWarm: temperatureC != null && temperatureC >= 23,
    temperatureC,
    wet: weather?.wet,
  })
}

function getEventDate(event) {
  if (!event?.date && !event?.eventDate) return null
  const value = `${event.date ?? event.eventDate}T${event.time ?? event.eventTime ?? '12:00'}:00`
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function freshnessOf(value, now) {
  if (!value) return 'missing'
  const age = now.getTime() - new Date(value).getTime()
  if (!Number.isFinite(age)) return 'unknown'
  if (age <= DAY_MS) return 'current'
  if (age <= 7 * DAY_MS) return 'recent'
  return 'historical'
}

function isFresh(value, now, days) {
  if (!value) return false
  const age = now.getTime() - new Date(value).getTime()
  return Number.isFinite(age) && age >= 0 && age <= days * DAY_MS
}

function range(low, high, step) {
  return { low: roundTo(low, step), high: roundTo(high, step) }
}

function roundTo(value, step) {
  return Math.max(0, Math.round(Number(value) / step) * step)
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parseIntensity(value) {
  if (typeof value === 'string' && !Number.isFinite(Number(value))) {
    return { low: 3, moderate: 5, medium: 5, high: 8, maximum: 10 }[value.toLowerCase()] ?? 5
  }
  return clamp(positiveNumber(value) ?? 5, 1, 10)
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}
