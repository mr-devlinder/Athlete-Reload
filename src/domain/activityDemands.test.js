import { describe, expect, it } from 'vitest'
import { getActivityDemandProfile, getDemandSummary } from './activityDemands'

describe('activity demand profiles', () => {
  it('distinguishes sports through structured demands', () => {
    const soccer = getActivityDemandProfile({ sport: 'Soccer', event: { load: 'High', plannedMinutes: 90 } })
    const swimming = getActivityDemandProfile({ sport: 'Swimming', event: { load: 'High', plannedMinutes: 90 } })
    expect(soccer.cutting).toBeGreaterThan(swimming.cutting)
    expect(swimming.impact).toBeLessThan(soccer.impact)
  })

  it('summarizes only the strongest demands', () => {
    expect(getDemandSummary(getActivityDemandProfile({ sport: 'Basketball' })).length).toBeLessThanOrEqual(4)
  })

  it('applies subtype, position, and surface modifiers', () => {
    const base = getActivityDemandProfile({ sport: 'Baseball', event: { load: 'Medium', type: 'Practice', surface: 'Grass' } })
    const pitching = getActivityDemandProfile({ sport: 'Baseball', event: { load: 'Medium', type: 'Pitching practice', positionOrEvent: 'Pitcher', surface: 'Hard court' } })
    expect(pitching.upperBody).toBeGreaterThan(base.upperBody)
    expect(pitching.impact).toBeGreaterThan(base.impact)
  })
})
