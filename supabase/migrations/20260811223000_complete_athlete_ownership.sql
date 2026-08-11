-- Complete additive athlete ownership normalization while legacy user_id reads
-- and writes remain supported during the compatibility window.

create or replace function private.athlete_id_for_user(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select athlete.id
  from public.athletes athlete
  where athlete.owner_user_id = target_user_id
  limit 1;
$$;

revoke all on function private.athlete_id_for_user(uuid) from public, anon, authenticated;

alter table public.schedule_events add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.schedule_events add column if not exists event_subtype text not null default '';
alter table public.schedule_events add column if not exists position_or_event text not null default '';
alter table public.check_ins add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.training_checkouts add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.pain_reports add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.pain_issues add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.daily_wellness add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.saved_recovery_routines add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.recovery_routine_completions add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.tournaments add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.athlete_associations add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.event_templates add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.voice_logs add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.saved_foods add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;
alter table public.share_audit_log add column if not exists athlete_id uuid references public.athletes(id) on delete cascade;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'schedule_events', 'check_ins', 'training_checkouts', 'pain_reports',
    'pain_issues', 'daily_wellness', 'saved_recovery_routines',
    'recovery_routine_completions', 'tournaments', 'athlete_associations',
    'event_templates', 'voice_logs', 'saved_foods', 'share_audit_log'
  ] loop
    execute format(
      'update public.%I row set athlete_id = athlete.id from public.athletes athlete where row.athlete_id is null and athlete.owner_user_id = row.user_id',
      table_name
    );
    execute format('create index if not exists %I on public.%I (athlete_id)', table_name || '_athlete_id_idx', table_name);
  end loop;
end;
$$;

create or replace function private.enforce_legacy_athlete_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_athlete_id uuid;
begin
  expected_athlete_id := private.athlete_id_for_user(new.user_id);
  if expected_athlete_id is null then
    raise exception 'No athlete exists for the legacy row owner';
  end if;
  if new.athlete_id is null then
    new.athlete_id := expected_athlete_id;
  elsif new.athlete_id <> expected_athlete_id then
    raise exception 'Athlete ownership mismatch';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_legacy_athlete_owner() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'schedule_events', 'check_ins', 'training_checkouts', 'pain_reports',
    'pain_issues', 'daily_wellness', 'saved_recovery_routines',
    'recovery_routine_completions', 'tournaments', 'athlete_associations',
    'event_templates', 'voice_logs', 'saved_foods', 'share_audit_log'
  ] loop
    execute format('drop trigger if exists enforce_legacy_athlete_owner on public.%I', table_name);
    execute format(
      'create trigger enforce_legacy_athlete_owner before insert or update of user_id, athlete_id on public.%I for each row execute function private.enforce_legacy_athlete_owner()',
      table_name
    );
  end loop;
end;
$$;

alter table public.pain_issues
  add column if not exists recurrence_count integer not null default 0 check (recurrence_count >= 0),
  add column if not exists functional_limitation text not null default '',
  add column if not exists activity_relationship text not null default '',
  add column if not exists severity_trend text not null default 'stable' check (severity_trend in ('improving', 'stable', 'worsening', 'unknown'));

create unique index if not exists recommendations_source_unique_idx
  on public.recommendations (source_type, source_id)
  where source_id is not null;

insert into public.recommendations (
  athlete_id, source_type, source_id, schema_version, engine_version,
  status, confidence, score, result_json, context_snapshot, created_at
)
select
  check_in.athlete_id,
  'check_in',
  check_in.id,
  case when (check_in.recommendation_json->>'schemaVersion') ~ '^[0-9]+$'
    then (check_in.recommendation_json->>'schemaVersion')::integer else 1 end,
  coalesce(check_in.recommendation_json->>'engineVersion', 'legacy-check-in'),
  case when check_in.recommendation_json->>'status' in ('ready', 'adjust', 'limit', 'stop_and_check')
    then check_in.recommendation_json->>'status' else 'adjust' end,
  least(1, greatest(0, coalesce((check_in.recommendation_json->>'confidence')::numeric, 0.5))),
  check_in.score,
  check_in.recommendation_json,
  jsonb_build_object('legacy', true, 'eventId', check_in.schedule_event_id),
  check_in.created_at
from public.check_ins check_in
where check_in.athlete_id is not null and check_in.recommendation_json is not null
on conflict (source_type, source_id) where source_id is not null do nothing;

insert into public.recommendations (
  athlete_id, source_type, source_id, schema_version, engine_version,
  status, confidence, score, result_json, context_snapshot, created_at
)
select
  checkout.athlete_id,
  'checkout',
  checkout.id,
  case when (checkout.recommendation_json->>'schemaVersion') ~ '^[0-9]+$'
    then (checkout.recommendation_json->>'schemaVersion')::integer else 1 end,
  coalesce(checkout.recommendation_json->>'engineVersion', 'legacy-checkout'),
  case when checkout.recommendation_json->>'status' in ('ready', 'adjust', 'limit', 'stop_and_check')
    then checkout.recommendation_json->>'status' else 'adjust' end,
  least(1, greatest(0, coalesce((checkout.recommendation_json->>'confidence')::numeric, 0.5))),
  case when (checkout.recommendation_json->>'score') ~ '^[0-9]+([.][0-9]+)?$'
    then (checkout.recommendation_json->>'score')::numeric else null end,
  checkout.recommendation_json,
  jsonb_build_object('legacy', true, 'eventId', checkout.schedule_event_id),
  checkout.created_at
from public.training_checkouts checkout
where checkout.athlete_id is not null and checkout.recommendation_json is not null
on conflict (source_type, source_id) where source_id is not null do nothing;

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  usefulness text not null check (usefulness in ('helpful', 'neutral', 'not_helpful')),
  followed_action boolean,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, recommendation_id)
);

create table if not exists public.recovery_responses (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  routine_completion_id uuid references public.recovery_routine_completions(id) on delete set null,
  source_checkout_id uuid references public.training_checkouts(id) on delete set null,
  response_timing text not null check (response_timing in ('immediate', 'later_day', 'next_day')),
  fatigue integer check (fatigue between 1 and 5),
  soreness integer check (soreness between 1 and 5),
  pain_change text not null default 'unchanged' check (pain_change in ('better', 'unchanged', 'worse')),
  response_json jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists recommendation_feedback_athlete_idx on public.recommendation_feedback (athlete_id, updated_at desc);
create index if not exists recovery_responses_athlete_idx on public.recovery_responses (athlete_id, recorded_at desc);

alter table public.recommendation_feedback enable row level security;
alter table public.recovery_responses enable row level security;

create policy "Athletes manage recommendation feedback" on public.recommendation_feedback
for all to authenticated
using (private.has_athlete_access(athlete_id, 'health', 'athlete'))
with check (private.has_athlete_access(athlete_id, 'health', 'athlete'));

create policy "Athletes manage recovery responses" on public.recovery_responses
for all to authenticated
using (private.has_athlete_access(athlete_id, 'health', 'athlete'))
with check (private.has_athlete_access(athlete_id, 'health', 'athlete'));

revoke all on public.recommendation_feedback, public.recovery_responses from anon;
grant select, insert, update, delete on public.recommendation_feedback, public.recovery_responses to authenticated;

-- Extend health-data clearing after the normalized feedback tables exist.
-- SECURITY INVOKER keeps every delete constrained by the caller's RLS access.
create or replace function public.clear_complete_health_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  delete from public.recommendation_feedback where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );
  delete from public.recovery_responses where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );
  delete from public.recommendations where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );
  delete from public.athlete_baselines where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );
  delete from public.athlete_insights where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );
  delete from public.athlete_physiology_profiles where athlete_id in (
    select id from public.athletes where owner_user_id = (select auth.uid())
  );

  delete from public.recovery_routine_completions where user_id = (select auth.uid());
  delete from public.saved_recovery_routines where user_id = (select auth.uid());
  delete from public.pain_reports where user_id = (select auth.uid());
  delete from public.pain_issues where user_id = (select auth.uid());
  delete from public.training_checkouts where user_id = (select auth.uid());
  delete from public.check_ins where user_id = (select auth.uid());
  delete from public.daily_wellness where user_id = (select auth.uid());
  delete from public.voice_logs where user_id = (select auth.uid());
end;
$$;

revoke all on function public.clear_complete_health_data() from public, anon;
grant execute on function public.clear_complete_health_data() to authenticated;

create or replace function public.verify_athlete_backfill()
returns table (table_name text, legacy_rows bigint, normalized_rows bigint, orphan_rows bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_table text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  foreach target_table in array array[
    'schedule_events', 'check_ins', 'training_checkouts', 'pain_reports',
    'pain_issues', 'daily_wellness', 'saved_recovery_routines',
    'recovery_routine_completions', 'tournaments', 'athlete_associations',
    'event_templates', 'voice_logs', 'saved_foods', 'share_audit_log'
  ] loop
    return query execute format(
      'select %L, count(*), count(athlete_id), count(*) filter (where athlete_id is null) from public.%I where user_id = auth.uid()',
      target_table, target_table
    );
  end loop;
end;
$$;

revoke all on function public.verify_athlete_backfill() from public, anon;
grant execute on function public.verify_athlete_backfill() to authenticated;
