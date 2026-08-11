export const PAIN_LIFECYCLE_STATUSES = ['active', 'improving', 'resolved', 'recurring']

export function transitionPainIssue(existing, changes, today = new Date().toISOString().slice(0, 10)) {
  const status = PAIN_LIFECYCLE_STATUSES.includes(changes?.status)
    ? changes.status
    : existing?.status ?? 'active'
  const reactivated = status === 'recurring' && existing?.status === 'resolved'

  return {
    ...existing,
    ...changes,
    status,
    recurrenceCount: reactivated
      ? Number(existing?.recurrenceCount ?? 0) + 1
      : Number(changes?.recurrenceCount ?? existing?.recurrenceCount ?? 0),
    resolvedDate: status === 'resolved' ? (changes?.resolvedDate ?? today) : null,
  }
}

export function issueAffectsCurrentRecommendation(issue) {
  return issue?.status !== 'resolved'
}
