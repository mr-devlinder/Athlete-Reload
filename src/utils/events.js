export function estimatePlannedMinutes(load = 'Medium') {
  if (load === 'High') return 90
  if (load === 'Low') return 35

  return 60
}

export function parseEventDateTime(event) {
  if (!event?.date) return null

  const time = event.time?.trim()

  if (!time) {
    return new Date(`${event.date}T00:00:00`)
  }

  if (/^\d{2}:\d{2}$/.test(time)) {
    return new Date(`${event.date}T${time}:00`)
  }

  const parsed = new Date(`${event.date} ${time}`)

  return Number.isNaN(parsed.getTime()) ? new Date(`${event.date}T00:00:00`) : parsed
}

export function hasEventStarted(event, now = new Date()) {
  const eventDate = parseEventDateTime(event)

  return eventDate ? eventDate <= now : false
}

export function getCheckoutForEvent(checkouts, eventId) {
  return checkouts.find((checkout) => checkout.eventId === eventId)
}
