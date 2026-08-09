import { describe, expect, it } from 'vitest'
import { buildAthleteContext, calculatePerformanceTargets } from './recommendationContext'

describe('calculatePerformanceTargets', () => {
  it('returns ranges and adds during-event fuel for long events', () => {
    const targets = calculatePerformanceTargets({ durationMinutes: 120, heat: { isHot: true }, intensity: 8, weightKg: 70 })
    expect(targets.confidence).toBe('personalized-range')
    expect(targets.hydration.duringMlPerHour.low).toBeLessThanOrEqual(targets.hydration.duringMlPerHour.high)
    expect(targets.hydration.duringMlPerHour.high).toBeLessThanOrEqual(1000)
    expect(targets.fueling.duringCarbsGPerHour).toEqual({ low: 30, high: 60 })
    expect(targets.hydration.electrolytesUseful).toBe(true)
  })

  it('does not add during-event targets to a short mild session', () => {
    const targets = calculatePerformanceTargets({ durationMinutes: 30, heat: { isHot: false }, intensity: 4, weightKg: 60 })
    expect(targets.hydration.duringMlPerHour).toBeNull()
    expect(targets.fueling.duringCarbsGPerHour).toBeNull()
  })
})

describe('buildAthleteContext', () => {
  it('keeps missing logs distinct from zero intake and excludes old pain reports', () => {
    const context = buildAthleteContext({
      athleteProfile: { sport: 'Soccer', weightKg: 65 },
      checkIn: { fatigue: 0, painMap: {}, sleep: 8 },
      event: { date: '2026-08-08', expectedDuration: 90, time: '18:00', type: 'Game' },
      generatedAt: '2026-08-08T12:00:00.000Z',
      nutritionContext: { hasFoodLogs: false, hasHydrationLogs: false },
      recentPainReports: [{ date: '2026-06-01', area: 'Knee', severity: 5 }],
    })
    expect(context.current.fatigue).toBe(0)
    expect(context.nutrition.hydrationMl).toBeNull()
    expect(context.missing).toContain('recent food')
    expect(context.recent.painReports).toEqual([])
  })
})
