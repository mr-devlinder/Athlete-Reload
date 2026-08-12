import { describe, expect, it } from 'vitest'
import { calculateSweatRate, getHydrationResult } from './hydration'

describe('hydration domain', () => {
  it('treats missing logs as unknown', () => {
    expect(getHydrationResult({ currentLoggedMl: 0, hasLogs: false }).status).toBe('unknown')
  })

  it('uses one personalized range for status', () => {
    const result = getHydrationResult({ profile: { weightKg: 70 }, currentLoggedMl: 2500, hasLogs: true })
    expect(result.status).toBe('on_track')
    expect(result.currentLoggedMl).toBe(2500)
  })

  it('only calculates sweat rate from a valid manual measurement', () => {
    expect(calculateSweatRate({ preSessionWeightKg: 70, postSessionWeightKg: 69.5, fluidConsumedMl: 500, durationMinutes: 60 })).toBe(1000)
    expect(calculateSweatRate({ preSessionWeightKg: 70, postSessionWeightKg: 70.5, fluidConsumedMl: 0, durationMinutes: 60 })).toBeNull()
  })
})
