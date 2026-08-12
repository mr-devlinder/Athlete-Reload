import { describe, expect, it } from 'vitest'
import { calculateReadiness } from './readinessModel'

const healthy = { energy: 5, fatigue: 1, soreness: 1, sleep: 8, sleepQuality: 5, stress: 0, illnessSymptoms: 0, pain: 0 }

describe('calculateReadiness', () => {
  it.each([
    ['severe fatigue', { fatigue: 5 }, 'limit'],
    ['poor sleep', { sleep: 3, sleepQuality: 1 }, 'adjust'],
    ['illness', { illnessSymptoms: 4 }, 'stop_and_seek_help'],
    ['mild pain', { pain: 2 }, 'adjust'],
    ['severe pain', { pain: 8 }, 'stop_and_seek_help'],
    ['red flags', { painType: 'Numbness', pain: 1 }, 'stop_and_seek_help'],
  ])('%s produces a conservative status', (_name, values, status) => {
    expect(calculateReadiness({ currentState: { ...healthy, ...values } }).status).toBe(status)
  })

  it('combines multiple adverse inputs without a score floor', () => {
    const result = calculateReadiness({ currentState: { ...healthy, energy: 1, fatigue: 5, soreness: 5, sleep: 3, pain: 2 } })
    expect(result.score).toBeLessThan(45)
    expect(result.status).toBe('limit')
  })

  it('marks missing inputs as low quality instead of adverse', () => {
    const result = calculateReadiness({ currentState: {} })
    expect(result.dataQuality.level).toBe('low')
    expect(result.score).toBe(100)
  })

  it('includes baseline deviations and multiple same-day events', () => {
    const result = calculateReadiness({ currentState: { ...healthy, baselineDeviationPenalty: 10 }, recentLoad: { sameDayEventCount: 3 } })
    expect(result.score).toBe(82)
  })

  it('ignores historical or resolved pain when current pain is zero', () => {
    const historical = calculateReadiness({ currentState: { ...healthy, historicalPain: 8, painIssueStatus: 'resolved' } })
    expect(historical.score).toBe(100)
  })

  it('pain can never increase readiness', () => {
    const poor = { ...healthy, energy: 1, fatigue: 5, soreness: 5, sleep: 3, sleepQuality: 1, stress: 5 }
    const noPain = calculateReadiness({ currentState: poor })
    const withPain = calculateReadiness({ currentState: { ...poor, pain: 2 } })
    expect(withPain.score).toBeLessThanOrEqual(noPain.score)
  })
})
