import { format, parseISO, startOfWeek } from 'date-fns'

export const mondayWeekOptions = { weekStartsOn: 1 }

export function parseLocalCalendarDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
}

export function localDateKey(value) {
  const date = parseLocalCalendarDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

export function mondayWeekStart(value) {
  return calendarWeekStart(value, 1)
}

export function calendarWeekStart(value, weekStartsOn = 1) {
  const date = parseLocalCalendarDate(value)
  return date ? startOfWeek(date, { weekStartsOn: weekStartsOn === 0 ? 0 : 1 }) : null
}

export function parseStoredDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? parseISO(value) : parseLocalCalendarDate(value)
}
