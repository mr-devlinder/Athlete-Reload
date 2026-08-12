export const RECOMMENDATION_SCHEMA_VERSION = 3

export function buildDecisionPacket(input = {}) {
  const allowedStatuses = new Set(['ready', 'adjust', 'limit', 'stop_and_seek_help'])
  if (!allowedStatuses.has(input.status)) throw new TypeError('Invalid recommendation status')
  return {
    schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
    kind: input.kind ?? 'pre_event',
    source: input.source ?? 'deterministic',
    status: input.status,
    score: Number.isFinite(input.score) ? input.score : null,
    dataQuality: input.dataQuality ?? { level: 'low', reasons: ['Insufficient context'], sampleSize: null, freshnessMinutes: null },
    summary: String(input.summary ?? ''),
    primaryAction: input.primaryAction ?? { title: 'Next step', instruction: String(input.summary ?? '') },
    reasons: Array.isArray(input.reasons) ? input.reasons : [],
    actions: Array.isArray(input.actions) ? input.actions : [],
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    fueling: input.fueling ?? {},
    hydration: input.hydration ?? {},
    routine: input.routine ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    deterministicVersion: input.deterministicVersion ?? 'decision-3.0.0',
    ...(input.source === 'ai_assisted' && input.provider ? { provider: input.provider, model: input.model ?? null } : {}),
  }
}

export function isDecisionPacket(value) {
  return Boolean(value && value.schemaVersion === 3 && ['ready', 'adjust', 'limit', 'stop_and_seek_help'].includes(value.status) && value.primaryAction?.instruction)
}
