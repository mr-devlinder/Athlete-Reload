import { calculatePerformanceTargets } from '../../lib/recommendationContext'

const LOAD_TO_INTENSITY = { Low: 3, Medium: 6, High: 8 }

export function buildDailyFuelingContext({ athleteProfile = {}, date, entries = [], hydrationMl = null, schedule = [] } = {}) {
  const events = schedule
    .filter((event) => event.date === date && !/rest|recovery/i.test(`${event.type ?? ''} ${event.title ?? ''}`))
    .map(normalizeEvent)
    .sort((first, second) => first.startMinutes - second.startMinutes)
  const hasFoodLogs = entries.length > 0
  const hasHydrationLogs = hydrationMl != null && Number(hydrationMl) > 0

  if (!events.length) return {
    demand: 'normal',
    eventCount: 0,
    hasFoodLogs,
    hasHydrationLogs,
    headline: 'Normal daily fueling',
    summary: 'No demanding event is scheduled. Use familiar meals, steady fluids, and your normal eating pattern.',
    moments: [
      moment('Morning', 'Start normally', 'Choose a familiar breakfast and begin drinking fluids normally.'),
      moment('Through the day', 'Keep a regular pattern', 'Use meals and snacks that fit hunger, goals, and dietary needs; missing logs are not treated as missed intake.'),
    ],
  }

  const totalMinutes = events.reduce((sum, event) => sum + event.durationMinutes, 0)
  const demand = events.length >= 2 || totalMinutes >= 150 || events.some((event) => event.intensity >= 8) ? 'high' : totalMinutes >= 75 ? 'moderate' : 'light'
  const moments = []
  const first = events[0]
  const firstTargets = targetsFor(first, athleteProfile)

  moments.push(moment(
    first.startMinutes < 720 ? 'Morning' : 'Earlier today',
    events.length > 1 ? 'Build fuel before the first session' : 'Set up the day',
    preEventGuidance(first, firstTargets, events.length),
  ))

  events.forEach((event, index) => {
    moments.push(moment(formatMinutes(event.startMinutes), event.name, `${event.durationMinutes} min · ${event.load.toLowerCase()} expected demand`, 'event'))
    const next = events[index + 1]
    const currentTargets = targetsFor(event, athleteProfile)
    if (next) {
      const gapMinutes = Math.max(0, next.startMinutes - (event.startMinutes + event.durationMinutes))
      moments.push(moment(
        formatWindow(event.startMinutes + event.durationMinutes, Math.min(next.startMinutes - 60, event.startMinutes + event.durationMinutes + 90)),
        gapMinutes <= 240 ? 'Rapid refuel between sessions' : 'Between sessions: recover, then rebuild',
        betweenEventGuidance(event, next, currentTargets, gapMinutes),
        'priority',
      ))
      if (gapMinutes > 180) moments.push(moment(
        formatWindow(Math.max(event.startMinutes + event.durationMinutes + 90, next.startMinutes - 120), next.startMinutes - 45),
        `Top up before ${next.name}`,
        preEventGuidance(next, targetsFor(next, athleteProfile), events.length),
      ))
    } else {
      moments.push(moment(
        'After the final event',
        events.length > 1 ? 'Finish the day’s recovery' : 'Recovery meal and fluids',
        postEventGuidance(event, currentTargets, demand),
        'priority',
      ))
    }
  })

  return {
    demand,
    eventCount: events.length,
    hasFoodLogs,
    hasHydrationLogs,
    headline: events.length === 1 ? `${first.name} shapes today’s plan` : `${events.length} sessions require a whole-day plan`,
    summary: events.length === 1
      ? `${first.durationMinutes} planned minutes at ${formatMinutes(first.startMinutes)}. Guidance is organized around the moments that matter.`
      : `${totalMinutes} planned minutes with ${describeShortestTurnaround(events)}. Refueling between sessions is the key difference today.`,
    moments: dedupeMoments(moments),
  }
}

function normalizeEvent(event) {
  return {
    ...event,
    name: event.title || event.customActivityName || event.type || 'Training',
    startMinutes: parseTime(event.time),
    durationMinutes: Math.max(15, Number(event.plannedMinutes ?? event.expectedDuration) || 60),
    intensity: LOAD_TO_INTENSITY[event.load] ?? 5,
    load: event.load ?? 'Medium',
  }
}

function targetsFor(event, athleteProfile) {
  return calculatePerformanceTargets({ durationMinutes: event.durationMinutes, intensity: event.intensity, weightKg: athleteProfile?.weightKg })
}

function preEventGuidance(event, targets, eventCount) {
  const range = targets?.fueling?.preEventCarbsG
  const amount = range ? `${range.low}–${range.high} g carbohydrate` : 'a familiar carbohydrate-containing meal or snack'
  return `${eventCount > 1 ? 'Protect energy for the entire day: ' : ''}aim for ${amount} in a familiar option before ${event.name}; keep fluids steady rather than trying to catch up at once.`
}

function betweenEventGuidance(event, next, targets, gapMinutes) {
  const protein = targets?.recovery?.proteinG
  const proteinText = protein ? `${protein.low}–${protein.high} g protein` : 'a useful protein source'
  if (gapMinutes <= 150) return `Turnaround is short. Start a familiar, easy-to-tolerate carbohydrate source and fluids soon after ${event.name}; include ${proteinText} as tolerated before ${next.name}.`
  return `Replace carbohydrate and fluids after ${event.name}, include ${proteinText}, then return to normal meals before the later top-up for ${next.name}.`
}

function postEventGuidance(event, targets, demand) {
  const protein = targets?.recovery?.proteinG
  return `Use a familiar meal with carbohydrate and ${protein ? `${protein.low}–${protein.high} g protein` : 'protein'}, then continue fluids based on thirst and your usual guidance${demand === 'high' ? '; today’s total demand makes this more important than an extra training snack' : ''}.`
}

function describeShortestTurnaround(events) {
  const gaps = events.slice(1).map((event, index) => event.startMinutes - (events[index].startMinutes + events[index].durationMinutes)).filter((value) => value >= 0)
  if (!gaps.length) return 'limited separation between sessions'
  const shortest = Math.min(...gaps)
  return `${Math.floor(shortest / 60)}h ${shortest % 60}m at the shortest turnaround`
}

function moment(time, title, guidance, tone = 'normal') { return { time, title, guidance, tone } }
function parseTime(value) { const [hours, minutes] = String(value || '12:00').split(':').map(Number); return Math.max(0, Math.min(1439, (hours || 0) * 60 + (minutes || 0))) }
function formatMinutes(value) { const minutes = Math.max(0, Math.min(1439, value)); const hours = Math.floor(minutes / 60); const mins = minutes % 60; const suffix = hours >= 12 ? 'PM' : 'AM'; return `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${suffix}` }
function formatWindow(start, end) { return `${formatMinutes(start)}–${formatMinutes(Math.max(start, end))}` }
function dedupeMoments(items) { return items.filter((item, index) => items.findIndex((candidate) => candidate.time === item.time && candidate.title === item.title) === index) }
