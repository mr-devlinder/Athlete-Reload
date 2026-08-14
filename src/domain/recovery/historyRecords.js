export function createRecoveryHistoryRecords(recoveryPlans = [], mobilityRoutines = [], toDateKey = defaultDateKey) {
  return [
    ...recoveryPlans.map((entry) => ({ date: toDateKey(entry.generatedAt ?? entry.refreshedAt), entry, kind: 'recovery-plan' })),
    ...mobilityRoutines.map((entry) => ({ date: toDateKey(entry.completedAt ?? entry.finishedAt), entry, kind: 'recovery-completion' })),
  ].filter((item) => item.date)
}

function defaultDateKey(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
