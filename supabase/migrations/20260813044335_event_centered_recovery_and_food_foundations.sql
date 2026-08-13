-- Event-centered recovery, mobility, food provenance and schedule semantics.
-- This migration is additive so existing clients can continue dual-reading legacy JSON.

alter table public.schedule_events
  add column if not exists activity_kind text not null default 'training',
  add column if not exists event_subtype text not null default '',
  add column if not exists importance text not null default 'normal',
  add column if not exists expected_intensity text,
  add column if not exists recurrence_rule jsonb not null default '{}'::jsonb,
  add column if not exists template_source_id uuid references public.event_templates(id) on delete set null;

do $$ begin
  alter table public.schedule_events add constraint schedule_events_activity_kind_check
    check (activity_kind in ('competition', 'training', 'strength', 'conditioning', 'recovery', 'other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.schedule_events add constraint schedule_events_importance_check
    check (importance in ('normal', 'important', 'priority'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.schedule_events add constraint schedule_events_expected_intensity_check
    check (expected_intensity is null or expected_intensity in ('low', 'moderate', 'high', 'maximal'));
exception when duplicate_object then null; end $$;

alter table public.pain_reports
  add column if not exists onset text,
  add column if not exists trend text,
  add column if not exists movement_effect text,
  add column if not exists related_event_id uuid references public.schedule_events(id) on delete set null;

do $$ begin
  alter table public.pain_reports add constraint pain_reports_onset_check
    check (onset is null or onset in ('today', 'recent', 'ongoing'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pain_reports add constraint pain_reports_trend_check
    check (trend is null or trend in ('improving', 'same', 'worsening'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pain_reports add constraint pain_reports_movement_effect_check
    check (movement_effect is null or movement_effect in ('none', 'noticeable', 'limits', 'cannot_perform'));
exception when duplicate_object then null; end $$;

alter table public.daily_wellness
  add column if not exists hydration_logged boolean not null default false,
  add column if not exists nutrition_last_logged_at timestamptz;

alter table public.saved_recovery_routines
  add column if not exists plan_type text not null default 'mobility',
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists context_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists engine_version text not null default 'deterministic-3.0.0',
  add column if not exists rule_version text not null default 'recovery-rules-1.0.0',
  add column if not exists catalog_version text not null default 'recovery-catalog-2.0.0';

alter table public.recovery_routine_completions
  add column if not exists routine_type text not null default 'mobility',
  add column if not exists generated_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists planned_duration_seconds integer,
  add column if not exists actual_duration_seconds integer,
  add column if not exists movement_ids jsonb not null default '[]'::jsonb,
  add column if not exists movement_order jsonb not null default '[]'::jsonb,
  add column if not exists planned_prescription jsonb not null default '{}'::jsonb,
  add column if not exists completed_prescription jsonb not null default '{}'::jsonb,
  add column if not exists movements_completed jsonb not null default '[]'::jsonb,
  add column if not exists movements_skipped jsonb not null default '[]'::jsonb,
  add column if not exists completion_percentage numeric(5,2),
  add column if not exists hurt_events jsonb not null default '[]'::jsonb,
  add column if not exists modifications jsonb not null default '[]'::jsonb,
  add column if not exists associated_event_id uuid references public.schedule_events(id) on delete set null,
  add column if not exists athlete_state jsonb not null default '{}'::jsonb,
  add column if not exists equipment jsonb not null default '[]'::jsonb,
  add column if not exists stated_goal text not null default '',
  add column if not exists status text not null default 'completed';

do $$ begin
  alter table public.recovery_routine_completions add constraint recovery_completion_percentage_check
    check (completion_percentage is null or completion_percentage between 0 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.recovery_routine_completions add constraint recovery_completion_status_check
    check (status in ('planned', 'in_progress', 'partial', 'completed', 'ended_for_pain', 'abandoned'));
exception when duplicate_object then null; end $$;

create table if not exists public.recovery_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_checkout_id uuid references public.training_checkouts(id) on delete set null,
  source_event_id uuid references public.schedule_events(id) on delete set null,
  next_event_id uuid references public.schedule_events(id) on delete set null,
  plan_json jsonb not null default '{}'::jsonb,
  context_snapshot jsonb not null default '{}'::jsonb,
  input_signature text not null,
  engine_version text not null,
  rule_version text not null,
  prompt_version text,
  catalog_version text,
  action_statuses jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recovery_plans_user_signature_idx
  on public.recovery_plans(user_id, input_signature);
create index if not exists recovery_plans_user_refreshed_idx
  on public.recovery_plans(user_id, refreshed_at desc);

alter table public.recovery_plans enable row level security;
drop policy if exists "Users manage own recovery plans" on public.recovery_plans;
create policy "Users manage own recovery plans" on public.recovery_plans
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
revoke all on public.recovery_plans from anon;
grant select, insert, update, delete on public.recovery_plans to authenticated;

create table if not exists public.routine_pain_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_completion_id uuid references public.recovery_routine_completions(id) on delete cascade,
  routine_id uuid references public.saved_recovery_routines(id) on delete set null,
  source_checkout_id uuid references public.training_checkouts(id) on delete set null,
  movement_id text not null,
  body_region text not null default '',
  side text not null default 'not_applicable',
  response text not null default 'meaningful_pain',
  action_taken text not null,
  occurred_at timestamptz not null default now(),
  context_json jsonb not null default '{}'::jsonb
);

do $$ begin
  alter table public.routine_pain_events add constraint routine_pain_events_response_check
    check (response in ('mild_discomfort', 'meaningful_pain'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.routine_pain_events add constraint routine_pain_events_action_check
    check (action_taken in ('substitute', 'skip', 'end'));
exception when duplicate_object then null; end $$;

create index if not exists routine_pain_events_user_occurred_idx
  on public.routine_pain_events(user_id, occurred_at desc);
alter table public.routine_pain_events enable row level security;
drop policy if exists "Users manage own routine pain events" on public.routine_pain_events;
create policy "Users manage own routine pain events" on public.routine_pain_events
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
revoke all on public.routine_pain_events from anon;
grant select, insert, update, delete on public.routine_pain_events to authenticated;

create table if not exists public.user_food_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_key text not null,
  food_json jsonb not null,
  selection_count integer not null default 1 check (selection_count > 0),
  first_selected_at timestamptz not null default now(),
  last_selected_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

create index if not exists user_food_usage_recent_idx
  on public.user_food_usage(user_id, last_selected_at desc);
alter table public.user_food_usage enable row level security;
drop policy if exists "Users manage own food usage" on public.user_food_usage;
create policy "Users manage own food usage" on public.user_food_usage
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
revoke all on public.user_food_usage from anon;
grant select, insert, update, delete on public.user_food_usage to authenticated;

alter table public.recommendations
  add column if not exists rule_version text,
  add column if not exists prompt_version text,
  add column if not exists movement_catalog_version text,
  add column if not exists source_input_ids jsonb not null default '{}'::jsonb;

comment on table public.recovery_plans is 'Living event-centered recovery plans; action_statuses change as the athlete logs follow-through.';
comment on table public.routine_pain_events is 'Non-diagnostic movement pain feedback used for routine safety, history and cautious future exclusion.';
comment on table public.user_food_usage is 'Private per-athlete recent/frequent food ranking signals. Never exposed across users.';
