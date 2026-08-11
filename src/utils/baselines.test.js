import { describe, expect, it } from 'vitest'
import { getBaselineComparison, getBaselineRecords, getPersonalBaseline, getRollingBaselineRecords } from './baselines'

describe('personal baselines', () => {
  const history = Array.from({ length: 8 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, energy: 4, fatigue: 2, score: 80, sleep: 8, soreness: 1, session: 'Practice' }))
  it('reports sample size and confidence', () => {
    const baseline = getPersonalBaseline(history, { type: 'Practice' })
    expect(baseline.confidence).toBe('Building')
    expect(baseline.confidenceScore).toBeGreaterThan(0.5)
  })
  it('creates persistable metric records', () => expect(getBaselineRecords(history, { type: 'Practice' })).toHaveLength(5))
  it('explains meaningful deviations only', () => expect(getBaselineComparison({ energy: 2, fatigue: 2, sleep: 8, soreness: 1 }, getPersonalBaseline(history))).toContain('Energy is lower than your usual all events check-ins.'))
  it('builds versioned multi-window records across the full loop', () => {
    const records = getRollingBaselineRecords({ history, checkouts: [{ actualMinutes: 60, difficulty: 7 }], painReports: [{ severity: 4 }] })
    expect(records).toHaveLength(24)
    expect(records.find((record) => record.metricKey === 'session_load' && record.windowDays === 28)).toMatchObject({ value: 420, sampleSize: 1, calculationVersion: 'baseline-3.0.0' })
  })
})
