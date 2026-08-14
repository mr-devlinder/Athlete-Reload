import { describe, expect, it } from 'vitest'
import { createRecoveryHistoryRecords } from './historyRecords'

describe('recovery history record separation', () => {
  it('keeps guidance plans and physical routines as distinct record kinds', () => {
    const records = createRecoveryHistoryRecords(
      [{ id: 'plan-1', type: 'recovery_plan', generatedAt: '2026-08-13T18:00:00Z', plan: { reportSections: [] } }],
      [{ id: 'routine-1', type: 'mobility_routine', completedAt: '2026-08-13T19:00:00Z', details: { routineSnapshot: { exercises: [] } } }],
      () => '2026-08-13',
    )

    expect(records.map((record) => record.kind)).toEqual(['recovery-plan', 'recovery-completion'])
    expect(records[0].entry.plan).toBeDefined()
    expect(records[0].entry.details).toBeUndefined()
    expect(records[1].entry.details?.routineSnapshot).toBeDefined()
    expect(records[1].entry.plan).toBeUndefined()
  })
})
