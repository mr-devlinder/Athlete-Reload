function normalizePriority(value) {
  if (typeof value === 'string') return value.trim()
  return String(value?.instruction ?? value?.message ?? value?.label ?? value?.title ?? value?.summary ?? '').trim()
}

export function getRecoveryPriorities(plan, limit = Number.POSITIVE_INFINITY) {
  if (!plan) return []
  const prioritySection = (plan.reportSections ?? []).find((section) => section?.id === 'recovery-priorities')
  const candidates = [
    prioritySection?.items,
    plan.priorities,
    plan.actions,
    plan.focus,
    plan.recovery,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const priorities = [...new Set(candidate.map(normalizePriority).filter(Boolean))]
    if (priorities.length) return priorities.slice(0, limit)
  }

  const primary = normalizePriority(plan.primaryAction)
  return primary ? [primary].slice(0, limit) : []
}
