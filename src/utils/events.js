export function estimatePlannedMinutes(load = 'Medium') {
  if (load === 'High') return 90
  if (load === 'Low') return 35

  return 60
}

export function isRestDayEvent(event) {
  return ['rest day', 'rest'].includes(String(event?.type ?? '').trim().toLowerCase())
}

export function isRecoveryDayEvent(event) {
  return String(event?.type ?? '').trim().toLowerCase() === 'recovery day'
}

export function isAllDayEvent(event) {
  return isRestDayEvent(event) || isRecoveryDayEvent(event)
}

export function isOtherActivityEvent(event) {
  return String(event?.type ?? '').trim().toLowerCase() === 'other activity'
}

export function isEventActionable(event) {
  return Boolean(event) && !isAllDayEvent(event)
}

export function getEventDisplayName(event) {
  if (isOtherActivityEvent(event)) return event.customActivityName?.trim() || event.title?.trim() || 'Other activity'
  if (isRestDayEvent(event)) return 'Rest Day'
  if (isRecoveryDayEvent(event)) return 'Recovery Day'
  return event?.title || event?.type || 'Training'
}

export function parseEventDateTime(event) {
  if (!event?.date) return null

  const time = event.time?.trim()

  if (!time && event.allDay && isEventActionable(event)) {
    return new Date(`${event.date}T18:00:00`)
  }
  if (!time) return null

  const dateMatch = event.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/)

  if (!dateMatch || !timeMatch) return null

  const [, year, month, day] = dateMatch
  const [, hourText, minuteText, period] = timeMatch
  let hour = Number(hourText)
  const minute = Number(minuteText)

  if (minute > 59 || hour > 23 || hour < 0) return null

  if (period) {
    if (hour < 1 || hour > 12) return null
    hour = hour % 12 + (period.toLowerCase() === 'pm' ? 12 : 0)
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute)
}

export function hasEventStarted(event, now = new Date()) {
  if (!isEventActionable(event)) return false
  const eventDate = parseEventDateTime(event)

  return eventDate ? eventDate <= now : false
}

export function getCheckoutForEvent(checkouts, eventId) {
  return checkouts.find((checkout) => checkout.eventId === eventId)
}
