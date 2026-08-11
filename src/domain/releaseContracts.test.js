import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20260811223000_complete_athlete_ownership.sql', import.meta.url),
  'utf8',
)
const recommendationFunction = readFileSync(
  new URL('../../supabase/functions/generate-recommendation/index.ts', import.meta.url),
  'utf8',
)

describe('release security contracts', () => {
  it('normalizes every remaining athlete-owned legacy table', () => {
    for (const table of [
      'schedule_events', 'check_ins', 'training_checkouts', 'pain_reports',
      'pain_issues', 'daily_wellness', 'saved_recovery_routines',
      'recovery_routine_completions', 'tournaments', 'athlete_associations',
      'event_templates', 'voice_logs', 'saved_foods', 'share_audit_log',
    ]) {
      expect(migration).toContain(`alter table public.${table} add column if not exists athlete_id`)
    }
    expect(migration).toContain('create or replace function public.verify_athlete_backfill()')
    expect(migration).toContain('create or replace function public.clear_complete_health_data()')
  })

  it('enables RLS, revokes anonymous access, and keeps normalized health tables clearable', () => {
    for (const table of ['recommendation_feedback', 'recovery_responses']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`delete from public.${table}`)
    }
    expect(migration).toContain('revoke all on public.recommendation_feedback, public.recovery_responses from anon')
  })

  it('requires an authenticated recommendation request and does not use wildcard CORS', () => {
    expect(recommendationFunction).toContain("authorization.startsWith('Bearer ')")
    expect(recommendationFunction).toContain('/auth/v1/user')
    expect(recommendationFunction).not.toContain("'Access-Control-Allow-Origin': '*'")
    expect(recommendationFunction).toContain('applyDeterministicGuard')
  })
})
