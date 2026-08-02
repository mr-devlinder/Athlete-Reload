import { parseEventDateTime } from './events.js'

const STATUS = {
  ON_TRACK: 'on-track',
  SLIGHTLY_BEHIND: 'slightly-behind',
  BEHIND: 'behind',
  INSUFFICIENT_DATA: 'insufficient-data',
  NOT_APPLICABLE: 'not-applicable',
}

export function getTimeOfDayExpectation(checkInTime = new Date()) {
  const hour = checkInTime.getHours() + (checkInTime.getMinutes() / 60)

  if (hour < 9) return { context: 'early-morning-event', expectedDailyFraction: 0.1, estimatedHoursAwake: Math.max(0.5, hour - 5.5) }
  if (hour < 12) return { context: 'morning-event', expectedDailyFraction: 0.25, estimatedHoursAwake: Math.max(1, hour - 6.5) }
  if (hour < 15) return { context: 'midday-event', expectedDailyFraction: 0.42, estimatedHoursAwake: Math.max(1, hour - 7) }
  if (hour < 19) return { context: 'later-day-event', expectedDailyFraction: 0.62, estimatedHoursAwake: Math.max(1, hour - 7) }

  return { context: 'evening-event', expectedDailyFraction: 0.78, estimatedHoursAwake: Math.max(1, hour - 7) }
}

export function getEventFuelContext({
  checkInTime = new Date(),
  entries = [],
  event,
  previousDayEntries = [],
  targets = {},
} = {}) {
  if (isRecoveryOnlyEvent(event)) return notApplicable('Event fueling analysis is not needed for a Rest Day or Recovery Day.')

  const expectation = getTimeOfDayExpectation(checkInTime)
  const timing = getEventTiming(event, checkInTime)
  const availableEntries = getEntriesAvailableAtCheckIn(entries, checkInTime)
  const recentFuelLogged = availableEntries.some((entry) => isWithinHours(entry.loggedAt, checkInTime, 4))
  const previousEveningFuelLogged = previousDayEntries.some((entry) => {
    const loggedAt = parseDate(entry.loggedAt)
    return loggedAt && loggedAt.getHours() >= 17
  })
  const demandingEvent = isDemandingEvent(event)
  const availableTotals = availableEntries.reduce((result, entry) => ({
    calories: result.calories + Number(entry.calories ?? 0),
    carbohydrates: result.carbohydrates + Number(entry.carbohydrates ?? 0),
  }), { calories: 0, carbohydrates: 0 })

  if (availableEntries.length === 0) {
    return {
      status: STATUS.INSUFFICIENT_DATA,
      confidence: 'limited',
      context: expectation.context,
      message: expectation.context === 'early-morning-event'
        ? 'This is an early session, so full-day nutrition progress is not expected yet.'
        : 'There is not enough food logging before this check-in to assess event preparation.',
      recentFuelLogged: false,
      previousEveningFuelLogged,
      demandingEvent,
      ...timing,
    }
  }

  const calorieTarget = Number(targets.calories)
  const carbohydrateTarget = Number(targets.carbohydrates)
  const calorieProgress = calorieTarget > 0 ? availableTotals.calories / (calorieTarget * expectation.expectedDailyFraction) : null
  const carbohydrateProgress = carbohydrateTarget > 0 ? availableTotals.carbohydrates / (carbohydrateTarget * expectation.expectedDailyFraction) : null
  const availableRatios = [calorieProgress, carbohydrateProgress].filter(Number.isFinite)
  const broadProgress = availableRatios.length ? availableRatios.reduce((sum, value) => sum + value, 0) / availableRatios.length : null
  const status = broadProgress === null
    ? STATUS.ON_TRACK
    : broadProgress >= 0.75
      ? STATUS.ON_TRACK
      : broadProgress >= 0.45
        ? STATUS.SLIGHTLY_BEHIND
        : STATUS.BEHIND

  return {
    status,
    confidence: availableRatios.length ? 'moderate' : 'limited',
    context: expectation.context,
    message: getFuelMessage({ demandingEvent, expectation, recentFuelLogged, status, timing }),
    loggedFoodItems: availableEntries.length,
    recentFuelLogged,
    previousEveningFuelLogged,
    demandingEvent,
    ...timing,
  }
}

export function getEventHydrationContext({ checkInTime = new Date(), event, hydrationOz, hydrationTargetOz } = {}) {
  if (isRecoveryOnlyEvent(event)) return notApplicable('Event hydration analysis is not needed for a Rest Day or Recovery Day.')

  const expectation = getTimeOfDayExpectation(checkInTime)
  const timing = getEventTiming(event, checkInTime)
  const loggedOz = Number(hydrationOz)
  const targetOz = Number(hydrationTargetOz)

  if (!(loggedOz > 0) || !(targetOz > 0)) {
    return {
      status: STATUS.INSUFFICIENT_DATA,
      confidence: 'limited',
      context: expectation.context,
      message: expectation.context === 'early-morning-event'
        ? 'Full-day hydration progress is not expected before this early session; some fluid after waking may help if tolerated.'
        : 'There is not enough hydration logging before this check-in to assess event preparation.',
      loggedOz: Math.max(0, loggedOz || 0),
      ...timing,
    }
  }

  const timeAdjustedExpectation = targetOz * expectation.expectedDailyFraction
  const broadProgress = loggedOz / Math.max(1, timeAdjustedExpectation)
  const status = broadProgress >= 0.75
    ? STATUS.ON_TRACK
    : broadProgress >= 0.45
      ? STATUS.SLIGHTLY_BEHIND
      : STATUS.BEHIND

  return {
    status,
    confidence: 'moderate',
    context: expectation.context,
    message: ['event-started', 'substantially-after-event'].includes(timing.timing)
      ? 'This check-in was submitted after the event started; use logged hydration as context, not a pre-event readiness judgment.'
      : status === STATUS.ON_TRACK
      ? expectation.context === 'early-morning-event'
        ? 'Hydration appears reasonable for this early point in the day; the full daily target is not expected yet.'
        : 'Logged hydration appears broadly on track for this point before the event.'
      : timing.minutesUntilEvent !== null && timing.minutesUntilEvent <= 60
        ? 'Hydration may be behind for this event. Sip gradually before and during training rather than trying to catch up now.'
        : 'Hydration may be behind for this point in the day; build fluids gradually before the event.',
    loggedOz,
    ...timing,
  }
}

export function getCheckInPreparationContext({
  checkInTime = new Date(),
  checkouts = [],
  dailyWellness = {},
  event,
  nutritionContext = {},
  nutritionHistory = [],
  schedule = [],
} = {}) {
  const previousDate = event?.date ? getPreviousIsoDate(event.date) : ''
  const previousDayEntries = nutritionHistory.find((day) => day.date === previousDate)?.nutritionEntries ?? []
  const earlierCompletedEvents = schedule.filter((item) => item.date === event?.date
    && item.id !== event?.id
    && checkouts.some((checkout) => checkout.eventId === item.id))

  return {
    applicable: !isRecoveryOnlyEvent(event),
    checkInTime: checkInTime.toISOString(),
    eventStartTime: getEventStart(event)?.toISOString() ?? null,
    timeOfDayExpectation: getTimeOfDayExpectation(checkInTime),
    fuel: getEventFuelContext({
      checkInTime,
      entries: dailyWellness.nutritionEntries ?? [],
      event,
      previousDayEntries,
      targets: nutritionContext.targets,
    }),
    hydration: getEventHydrationContext({
      checkInTime,
      event,
      hydrationOz: dailyWellness.hydrationOz,
      hydrationTargetOz: nutritionContext.hydrationTargetOz,
    }),
    earlierCompletedEvents: earlierCompletedEvents.map((item) => {
      const checkout = checkouts.find((entry) => entry.eventId === item.id)
      return {
        name: item.customActivityName || item.title || item.type,
        actualMinutes: Number(checkout?.actualMinutes ?? 0),
        difficulty: Number(checkout?.difficulty ?? 0),
      }
    }),
  }
}

function getFuelMessage({ demandingEvent, expectation, recentFuelLogged, status, timing }) {
  if (['event-started', 'substantially-after-event'].includes(timing.timing)) {
    return 'This check-in was submitted after the event started; use logged fuel as context, not a pre-event readiness judgment.'
  }
  if (expectation.context === 'early-morning-event') {
    return recentFuelLogged
      ? 'Some fuel is logged for this early session; full-day nutrition progress is not expected yet.'
      : 'Full-day intake is not expected before this early session. A small familiar snack may help if tolerated.'
  }
  if (status === STATUS.ON_TRACK) return 'Logged intake appears broadly on track for this point before the event.'
  if (timing.minutesUntilEvent !== null && timing.minutesUntilEvent <= 60) {
    return demandingEvent
      ? 'Fuel may be behind for this demanding event; choose only a small familiar option if tolerated this close to start.'
      : 'Fuel may be slightly behind; avoid a large meal this close to the event.'
  }
  return demandingEvent
    ? 'Fuel appears behind for this point before a longer or harder event; there is still time for a familiar adjustment.'
    : 'Fuel appears slightly behind for this point in the day, with time for a modest adjustment.'
}

function getEventTiming(event, checkInTime) {
  const eventStart = getEventStart(event)
  if (!eventStart) return { minutesUntilEvent: null, timing: 'unknown-start-time' }

  const minutesUntilEvent = Math.round((eventStart - checkInTime) / 60000)
  return {
    minutesUntilEvent,
    timing: minutesUntilEvent < -60
      ? 'substantially-after-event'
      : minutesUntilEvent < 0
        ? 'event-started'
        : minutesUntilEvent <= 60
          ? 'event-begins-soon'
          : minutesUntilEvent > 360
            ? 'substantially-before-event'
            : 'pre-event-window',
  }
}

function getEventStart(event) {
  return parseEventDateTime(event)
}

function getEntriesAvailableAtCheckIn(entries, checkInTime) {
  return entries.filter((entry) => {
    const loggedAt = parseDate(entry.loggedAt)
    return !loggedAt || loggedAt <= checkInTime
  })
}

function isWithinHours(value, reference, hours) {
  const date = parseDate(value)
  if (!date) return false
  const difference = reference - date
  return difference >= 0 && difference <= hours * 60 * 60 * 1000
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isDemandingEvent(event) {
  return event?.load === 'High' || Number(event?.expectedDuration ?? event?.plannedMinutes ?? 0) >= 75
}

function isRecoveryOnlyEvent(event) {
  return /^(rest day|rest|recovery|recovery day)$/i.test(String(event?.type ?? '').trim())
}

function notApplicable(message) {
  return { status: STATUS.NOT_APPLICABLE, confidence: 'not-applicable', context: 'recovery-only-event', message }
}

function getPreviousIsoDate(value) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
