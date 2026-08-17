import { describe, expect, it } from 'vitest'
import { createCheckoutRecoveryPlan, findRecoveryPlanForCheckout, getRecoveryPlanInputSignature } from './recoveryPlanIdentity'

describe('recovery plan identity', () => {
  it('uses one stable persistence key per checkout', () => {
    expect(getRecoveryPlanInputSignature('checkout-1')).toBe('recovery:checkout-1')
    expect(getRecoveryPlanInputSignature('checkout-1')).toBe('recovery:checkout-1')
  })

  it('finds a previously generated plan for the checkout', () => {
    const plan = { id: 'plan-1', sourceCheckoutId: 'checkout-1' }
    expect(findRecoveryPlanForCheckout([plan], 'checkout-1')).toBe(plan)
    expect(findRecoveryPlanForCheckout([plan], 'checkout-2')).toBeNull()
  })

  it('turns the checkout recommendation into the waiting recovery plan', () => {
    const plan = createCheckoutRecoveryPlan({ label: 'Refuel now', routine: { exercises: [] } }, { id: 'checkout-1' }, '2026-08-16T12:00:00.000Z')
    expect(plan).toMatchObject({ generatedAt: '2026-08-16T12:00:00.000Z', label: 'Refuel now', recordType: 'recovery_plan', sourceCheckoutId: 'checkout-1' })
    expect(plan.routine).toBeUndefined()
  })
})
