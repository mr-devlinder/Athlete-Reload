export function estimatePlannedMinutes(load = 'Medium') {
  if (load === 'High') return 90
  if (load === 'Low') return 35

  return 60
}

export function parseEventDateTime(event) {
  if (!event?.date) return null

  const time = event.time?.trim()

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
  const eventDate = parseEventDateTime(event)

  return eventDate ? eventDate <= now : false
}

export function getCheckoutForEvent(checkouts, eventId) {
  return checkouts.find((checkout) => checkout.eventId === eventId)
}
