import { describe, expect, it } from 'vitest'
import { getCheckoutQuestionSchema } from './checkoutQuestionSchema'

describe('checkout question schema', () => {
  it('uses minutes played for field-sport competition', () => expect(getCheckoutQuestionSchema({ type: 'Match' }, { sport: 'Soccer' }).durationLabel).toBe('Minutes played'))
  it('omits competition performance language and RPE for recovery', () => expect(getCheckoutQuestionSchema({ type: 'Recovery' }).showRpe).toBe(false))
  it('only requests fueling for sufficiently long or competitive events', () => {
    expect(getCheckoutQuestionSchema({ type: 'Training', plannedMinutes: 45 }).showFuel).toBe(false)
    expect(getCheckoutQuestionSchema({ type: 'Race', plannedMinutes: 45 }).showFuel).toBe(true)
  })
})
