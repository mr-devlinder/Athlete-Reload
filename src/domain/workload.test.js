import { describe, expect, it } from 'vitest'
import { calculateSessionLoad, getScheduleDensity, summarizeRecentLoad } from './workload'

describe('workload calculations', () => {
  it('calculates session RPE load', () => expect(calculateSessionLoad(75, 8)).toBe(600))
  it('detects multiple events in a day', () => expect(getScheduleDensity([{ date: '2026-08-11', type: 'Practice', plannedMinutes: 60 }, { date: '2026-08-11', type: 'Gym', plannedMinutes: 45 }], '2026-08-11')).toEqual({ eventCount: 2, plannedMinutes: 105, multipleEvents: true }))
  it('summarizes recent load without universal thresholds', () => {
    const summary = summarizeRecentLoad([{ date: '2026-08-10', actualMinutes: 60, difficulty: 5 }], new Date('2026-08-11T12:00:00'))
    expect(summary.sevenDayLoad).toBe(300)
    expect(summary.sampleSize).toBe(1)
  })
})
