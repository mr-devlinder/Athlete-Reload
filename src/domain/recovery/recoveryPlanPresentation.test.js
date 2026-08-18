import { describe, expect, it } from 'vitest'
import { getRecoveryPriorities } from './recoveryPlanPresentation'

describe('recovery plan presentation', () => {
  it('uses explicit recovery-priority items first', () => {
    expect(getRecoveryPriorities({ reportSections: [{ id: 'recovery-priorities', items: ['Hydrate first'] }], priorities: ['Sleep'] })).toEqual(['Hydrate first'])
  })

  it('falls back when the recovery-priority section is present but empty', () => {
    expect(getRecoveryPriorities({ reportSections: [{ id: 'recovery-priorities', items: [] }], priorities: ['Refuel', 'Sleep'] })).toEqual(['Refuel', 'Sleep'])
  })

  it('normalizes structured action values', () => {
    expect(getRecoveryPriorities({ actions: [{ instruction: 'Recheck soreness' }] })).toEqual(['Recheck soreness'])
  })
})
