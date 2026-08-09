import { describe, expect, it } from 'vitest'
import { localDateKey, mondayWeekStart } from './calendarDate'
import { format } from 'date-fns'

describe('calendar dates', () => {
  it('groups Saturday August 8 2026 under Monday August 3', () => {
    expect(format(mondayWeekStart('2026-08-08'), 'yyyy-MM-dd')).toBe('2026-08-03')
  })

  it('keeps UTC timestamps on the local calendar date', () => {
    const value = new Date(2026, 7, 8, 23, 45).toISOString()
    expect(localDateKey(value)).toBe('2026-08-08')
  })
})
