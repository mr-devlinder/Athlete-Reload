import { describe, expect, it } from 'vitest'
import { calculateDailyEnergyContext } from './dailyEnergy'

const profile = { age: 17, heightCm: 175, weightKg: 70, trainingStyle: 'Mostly individual', goals: ['Lose weight'] }

describe('calculateDailyEnergyContext', () => {
  it('does not apply an automated deficit to a 16-17 year old', () => {
    const youth = calculateDailyEnergyContext(profile, [], '2026-08-11')
    const performance = calculateDailyEnergyContext({ ...profile, goals: ['Sport performance'] }, [], '2026-08-11')
    expect(youth.safety.allowAutomatedDeficit).toBe(false)
    expect(youth.midpointKcal).toBeLessThan(performance.midpointKcal)
    expect(performance.midpointKcal - youth.midpointKcal).toBe(150)
    expect(youth.safety.message).toContain('growth')
  })

  it('uses only the optional physiology field', () => {
    const identityOnly = calculateDailyEnergyContext({ ...profile, genderIdentity: 'male' }, [], '2026-08-11')
    const explicit = calculateDailyEnergyContext({ ...profile, genderIdentity: 'female', physiologySex: 'male' }, [], '2026-08-11')
    expect(identityOnly.physiologyAssumption).toBe('neutral_estimate')
    expect(explicit.physiologyAssumption).toBe('male')
  })
})
