import { describe, expect, it } from 'vitest'
import { sanitizeRecommendationPayload } from './aiRecommendations'

describe('AI payload privacy', () => {
  it('removes direct identity and birth date while keeping relevant context', () => {
    const payload = sanitizeRecommendationPayload({ athleteProfile: { displayName: 'Private Name', dateOfBirth: '2000-01-01', genderIdentity: 'Private', sport: 'Running', age: 26 } })
    expect(payload.athleteProfile).toEqual({ age: 26, dietaryPreferences: undefined, goals: undefined, position: undefined, sport: 'Running', trainingStyle: undefined, weightKg: undefined })
    expect(payload.athleteProfile.dateOfBirth).toBeUndefined()
    expect(payload.athleteProfile.displayName).toBeUndefined()
  })
})
