import { isAllDayEvent, parseEventDateTime } from '../../utils/events'

export const EVENT_SEMANTICS = Object.freeze({
  competition: { background: '#7f1d1d', foreground: '#ffffff', border: '#ef4444' },
  team_training: { background: '#1f2937', foreground: '#ffffff', border: '#64748b' },
  personal_training: { background: '#1e3a5f', foreground: '#ffffff', border: '#3b82f6' },
  recovery: { background: '#14532d', foreground: '#ffffff', border: '#22c55e' },
  rest: { background: '#e7e5e4', foreground: '#292524', border: '#a8a29e' },
  general: { background: '#4c1d6f', foreground: '#ffffff', border: '#a855f7' },
})

export function getEventSemanticType(event = {}) {
  const value = `${event.type ?? ''} ${event.title ?? ''}`.toLowerCase()
  if (/game|match|meet|race|competition|tournament|bout/.test(value)) return 'competition'
  if (/rest day|\brest\b/.test(value)) return 'rest'
  if (/recovery|mobility|flexibility/.test(value)) return 'recovery'
  if (/team|practice|training/.test(value)) return 'team_training'
  if (/gym|strength|lift|personal/.test(value)) return 'personal_training'
  return 'general'
}

export function getEventColorStyle(event) {
  const colors = EVENT_SEMANTICS[getEventSemanticType(event)]
  return { '--event-background': colors.background, '--event-foreground': colors.foreground, '--event-border': colors.border }
}

export function compareEventsChronologically(first, second) {
  const dateOrder = String(first?.date ?? '').localeCompare(String(second?.date ?? ''))
  if (dateOrder !== 0) return dateOrder
  const firstAllDay = isAllDayEvent(first) || first?.allDay === true
  const secondAllDay = isAllDayEvent(second) || second?.allDay === true
  if (firstAllDay !== secondAllDay) return firstAllDay ? -1 : 1
  const firstTime = parseEventDateTime(first)?.getTime() ?? Number.POSITIVE_INFINITY
  const secondTime = parseEventDateTime(second)?.getTime() ?? Number.POSITIVE_INFINITY
  return firstTime - secondTime || String(first?.id ?? '').localeCompare(String(second?.id ?? ''))
}
