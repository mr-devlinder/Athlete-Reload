import { describe, expect, it } from 'vitest'
import { getRecommendation } from './readiness'

const context = { pain: 0, injuryType: 'Unknown', painType: 'No pain', hurtsWhen: 'At rest', location: 'Hamstring', session: 'Team practice', yesterdayLoad: 'Rest', hydration: 'Unknown' }

describe('readiness with missing subjective data', () => {
  it('does not treat unanswered inputs as poor or ideal answers', () => {
    const result = getRecommendation({ ...context, energy: null, sleep: null, sleepQuality: null, fatigue: null, soreness: null, stress: null, illnessSymptoms: null })
    expect(result.reasons).not.toContain('low energy')
    expect(result.reasons).not.toContain('low sleep')
    expect(result.confidence).toBeLessThanOrEqual(0.1)
  })

  it('still responds monotonically when a known signal worsens', () => {
    const rested = getRecommendation({ ...context, energy: 5, sleep: 8, sleepQuality: 5, fatigue: 1, soreness: 1, stress: 0, illnessSymptoms: 0 })
    const fatigued = getRecommendation({ ...context, energy: 2, sleep: 6, sleepQuality: 2, fatigue: 5, soreness: 4, stress: 4, illnessSymptoms: 0 })
    expect(fatigued.score).toBeLessThan(rested.score)
  })
})
