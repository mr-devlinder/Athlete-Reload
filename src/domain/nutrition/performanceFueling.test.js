import { describe, expect, it } from 'vitest'
import { getPerformanceFueling } from './performanceFueling'

describe('getPerformanceFueling', () => {
  it('responds to event duration without false point precision', () => {
    expect(getPerformanceFueling({ durationMinutes: 45 }).carbohydrateRangeGramsPerHour).toBeNull()
    expect(getPerformanceFueling({ durationMinutes: 120 }).carbohydrateRangeGramsPerHour).toEqual({ low: 30, high: 60 })
  })
})
