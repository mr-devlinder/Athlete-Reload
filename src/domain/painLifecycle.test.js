import { describe, expect, it } from 'vitest'
import { issueAffectsCurrentRecommendation, transitionPainIssue } from './painLifecycle'

describe('pain lifecycle', () => {
  it('records resolution and excludes resolved issues from current decisions', () => {
    const resolved = transitionPainIssue({ status: 'improving' }, { status: 'resolved' }, '2026-08-11')
    expect(resolved.resolvedDate).toBe('2026-08-11')
    expect(issueAffectsCurrentRecommendation(resolved)).toBe(false)
  })

  it('increments recurrence when a resolved issue reactivates', () => {
    const recurring = transitionPainIssue(
      { status: 'resolved', recurrenceCount: 1, resolvedDate: '2026-08-01' },
      { status: 'recurring' },
      '2026-08-11',
    )
    expect(recurring.recurrenceCount).toBe(2)
    expect(recurring.resolvedDate).toBeNull()
  })
})
