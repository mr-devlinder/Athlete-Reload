-- Recovery Plans and Mobility Routines are separate domain/history records.
alter table public.recovery_plans
  add column if not exists record_type text not null default 'recovery_plan',
  add column if not exists plan_version text not null default '1',
  add column if not exists completed_actions jsonb not null default '[]'::jsonb,
  add column if not exists dismissed_actions jsonb not null default '[]'::jsonb;

update public.recovery_plans set record_type = 'recovery_plan' where record_type is distinct from 'recovery_plan';

do $$ begin
  alter table public.recovery_plans add constraint recovery_plans_record_type_check
    check (record_type = 'recovery_plan');
exception when duplicate_object then null; end $$;

alter table public.saved_recovery_routines
  add column if not exists record_type text not null default 'mobility_routine',
  add column if not exists equipment_requirements jsonb not null default '[]'::jsonb,
  add column if not exists original_duration_seconds integer;

update public.saved_recovery_routines set record_type = 'mobility_routine' where record_type is distinct from 'mobility_routine';

do $$ begin
  alter table public.saved_recovery_routines add constraint saved_routines_record_type_check
    check (record_type = 'mobility_routine');
exception when duplicate_object then null; end $$;

alter table public.recovery_routine_completions
  add column if not exists record_type text not null default 'mobility_routine',
  add column if not exists exercise_statuses jsonb not null default '[]'::jsonb,
  add column if not exists skip_events jsonb not null default '[]'::jsonb,
  add column if not exists selected_time_seconds integer,
  add column if not exists generation_context jsonb not null default '{}'::jsonb;

update public.recovery_routine_completions set record_type = 'mobility_routine' where record_type is distinct from 'mobility_routine';

do $$ begin
  alter table public.recovery_routine_completions add constraint mobility_completions_record_type_check
    check (record_type = 'mobility_routine');
exception when duplicate_object then null; end $$;

create index if not exists recovery_plans_user_generated_idx
  on public.recovery_plans(user_id, generated_at desc);
create index if not exists mobility_completions_user_finished_idx
  on public.recovery_routine_completions(user_id, finished_at desc);

alter table public.recovery_plans enable row level security;
alter table public.saved_recovery_routines enable row level security;
alter table public.recovery_routine_completions enable row level security;
alter table public.routine_pain_events enable row level security;

drop policy if exists "Users manage own recovery plans" on public.recovery_plans;
create policy "Users manage own recovery plans" on public.recovery_plans
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and record_type = 'recovery_plan');

drop policy if exists "Users manage own saved recovery routines" on public.saved_recovery_routines;
create policy "Users manage own saved recovery routines" on public.saved_recovery_routines
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and record_type = 'mobility_routine');

drop policy if exists "Users manage own recovery routine completions" on public.recovery_routine_completions;
create policy "Users manage own recovery routine completions" on public.recovery_routine_completions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and record_type = 'mobility_routine');

drop policy if exists "Users manage own routine pain events" on public.routine_pain_events;
create policy "Users manage own routine pain events" on public.routine_pain_events
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.recovery_plans, public.saved_recovery_routines, public.recovery_routine_completions, public.routine_pain_events from anon;
grant select, insert, update, delete on public.recovery_plans, public.saved_recovery_routines, public.recovery_routine_completions, public.routine_pain_events to authenticated;
