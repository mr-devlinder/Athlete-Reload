import { describe, expect, it } from 'vitest'
import {
  isCheckoutAtomicWritePermissionError,
  isMissingAtomicWriteRpc,
  isUnreleasedScheduleColumnError,
  withoutUnknownCheckInFields,
  withoutUnknownCheckoutFields,
  withoutUnreleasedScheduleColumns,
} from './athleteData'

describe('deployed-schema compatibility', () => {
  it('retries schedule writes only for known unreleased columns', () => {
    expect(isUnreleasedScheduleColumnError({ code: 'PGRST204', message: "Could not find the 'event_subtype' column in the schema cache" })).toBe(true)
    expect(isUnreleasedScheduleColumnError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(withoutUnreleasedScheduleColumns({ athlete_id: 'a', event_subtype: 'x', position_or_event: 'y', title: 'Practice' })).toEqual({ title: 'Practice' })
  })

  it('recognizes missing atomic RPCs without hiding other server errors', () => {
    expect(isMissingAtomicWriteRpc({ code: 'PGRST202', message: 'save_checkin_with_pain_reports was not found in the schema cache' }, 'save_checkin_with_pain_reports')).toBe(true)
    expect(isMissingAtomicWriteRpc({ code: 'PGRST202', message: 'delete_schedule_event_complete was not found in the schema cache' }, 'delete_schedule_event_complete')).toBe(true)
    expect(isMissingAtomicWriteRpc({ code: '23503', message: 'Schedule event not found' }, 'save_checkin_with_pain_reports')).toBe(false)
  })

  it('falls back only when the checkout wrapper cannot execute its base function', () => {
    expect(isCheckoutAtomicWritePermissionError({ code: '42501', message: 'permission denied for function save_checkout_with_pain_reports_base' })).toBe(true)
    expect(isCheckoutAtomicWritePermissionError({ code: '42501', message: 'permission denied for table training_checkouts' })).toBe(false)
    expect(isCheckoutAtomicWritePermissionError({ code: '23503', message: 'Schedule event not found' })).toBe(false)
  })

  it('omits unanswered subjective fields only for legacy writes', () => {
    expect(withoutUnknownCheckInFields({ energy: 4, stress: null, leg_heaviness: null, expected_difficulty: 6 })).toEqual({ energy: 4, expected_difficulty: 6 })
    expect(withoutUnknownCheckoutFields({ actual_minutes: 45, post_fatigue: null, post_soreness: 3, mental_focus: null, motivation: null })).toEqual({ actual_minutes: 45, post_soreness: 3 })
  })
})
