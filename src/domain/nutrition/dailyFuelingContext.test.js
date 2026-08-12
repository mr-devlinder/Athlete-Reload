import { describe, expect, it } from 'vitest'
import { buildDailyFuelingContext } from './dailyFuelingContext'

const profile = { weightKg: 70 }
const date = '2026-08-12'

describe('daily fueling context', () => {
  it('uses a normal day pattern when no event exists', () => {
    const result = buildDailyFuelingContext({ athleteProfile: profile, date, schedule: [] })
    expect(result.eventCount).toBe(0)
    expect(result.headline).toMatch(/Normal daily/)
    expect(result.moments.some((item) => /Before|During|After/.test(item.title))).toBe(false)
  })

  it('creates one coherent event timeline for a single session', () => {
    const result = buildDailyFuelingContext({ athleteProfile: profile, date, schedule: [{ date, time: '18:00', title: 'Team training', load: 'Medium', plannedMinutes: 90 }] })
    expect(result.eventCount).toBe(1)
    expect(result.moments.filter((item) => item.tone === 'event')).toHaveLength(1)
    expect(result.moments.at(-1).title).toMatch(/Recovery meal/)
  })

  it('prioritizes the turnaround between two sessions instead of duplicating before/during/after cards', () => {
    const result = buildDailyFuelingContext({ athleteProfile: profile, date, schedule: [
      { date, time: '10:00', title: 'Futsal', load: 'High', plannedMinutes: 60 },
      { date, time: '18:00', title: 'Team training', load: 'Medium', plannedMinutes: 90 },
    ] })
    expect(result.eventCount).toBe(2)
    expect(result.demand).toBe('high')
    expect(result.moments.some((item) => /between sessions/i.test(item.title))).toBe(true)
    expect(result.moments.filter((item) => item.tone === 'event')).toHaveLength(2)
  })

  it('preserves missing log state instead of treating it as zero intake', () => {
    const result = buildDailyFuelingContext({ athleteProfile: profile, date, entries: [], hydrationMl: 0, schedule: [] })
    expect(result.hasFoodLogs).toBe(false)
    expect(result.hasHydrationLogs).toBe(false)
  })
})
