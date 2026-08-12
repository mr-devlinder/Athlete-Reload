import { describe, expect, it } from 'vitest'
import { getCheckInFlowState, getCheckoutFlowState } from './progressiveFlow'

const normalCheckIn = { energy: 4, fatigue: 2, soreness: 1, sleep: 8, sleepQuality: 4, painConcern: false, symptomConcern: false }
const normalCheckout = { participation: 'Full', actualMinutes: 75, difficulty: 7, painConcern: false, symptomConcern: false, performanceRating: 'Normal' }

describe('progressive Check-In', () => {
  it('completes the normal path without a pain map or symptom follow-up', () => expect(getCheckInFlowState(normalCheckIn).complete).toBe(true))
  it('requires a location only after pain is reported', () => expect(getCheckInFlowState({ ...normalCheckIn, painConcern: true, painMap: {} }).missing).toContain('painLocation'))
  it('requires symptom impact only after symptoms are reported', () => expect(getCheckInFlowState({ ...normalCheckIn, symptomConcern: true, illnessSymptoms: null }).missing).toContain('symptomImpact'))
  it('keeps unanswered subjective inputs unknown', () => expect(getCheckInFlowState({ ...normalCheckIn, energy: null }).missing).toContain('energy'))
})

describe('progressive Checkout', () => {
  it('completes the normal fast path', () => expect(getCheckoutFlowState(normalCheckout).complete).toBe(true))
  it('requires focused pain information only on the pain path', () => expect(getCheckoutFlowState({ ...normalCheckout, painConcern: true, painMap: {} }).missing).toContain('painLocation'))
  it('requires a symptom selection only on the symptom path', () => expect(getCheckoutFlowState({ ...normalCheckout, symptomConcern: true, heatSymptoms: [] }).missing).toContain('symptoms'))
})
