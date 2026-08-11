-- Athlete context foundations. This migration is additive so the
-- application can dual-read existing user-owned rows during rollout.

create schema if not exists private;

alter table public.athlete_profiles
  add column if not exists date_of_birth date,
  add column if not exists age_verified_at timestamptz;

alter table public.athlete_profiles
  drop constraint if exists athlete_profiles_age_years_check;

alter table public.athlete_profiles
  add constraint athlete_profiles_age_years_check
  check (age_years is null or age_years between 0 and 120),
  add constraint athlete_profiles_date_of_birth_check
  check (date_of_birth is null or date_of_birth <= current_date);

alter table public.schedule_events
  add column if not exists activity_key text not null default '',
  add column if not exists demand_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.athlete_memberships (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_role text not null check (relationship_role in ('athlete', 'parent', 'trainer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  permission_scopes text[] not null default array['profile','schedule','health','nutrition','history']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, user_id)
);

insert into public.athletes (owner_user_id, display_name)
select profile.user_id, profile.display_name
from public.athlete_profiles profile
on conflict (owner_user_id) do update set display_name = excluded.display_name;

insert into public.athlete_memberships (athlete_id, user_id, relationship_role)
select athlete.id, athlete.owner_user_id, 'athlete'
from public.athletes athlete
on conflict (athlete_id, user_id) do nothing;

create table if not exists public.athlete_physiology_profiles (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  biological_sex text not null default '' check (biological_sex in ('', 'female', 'male', 'intersex', 'not_listed')),
  menstrual_context_enabled boolean not null default false,
  menstrual_symptoms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  activity_key text not null,
  position_or_event text not null default '',
  is_primary boolean not null default false,
  experience_level text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, activity_key, position_or_event)
);

insert into public.athlete_activities (athlete_id, activity_key, position_or_event, is_primary)
select athlete.id, profile.sport, profile.position, true
from public.athlete_profiles profile
join public.athletes athlete on athlete.owner_user_id = profile.user_id
where profile.sport <> ''
on conflict (athlete_id, activity_key, position_or_event) do update set is_primary = true;

create or replace function private.sync_athlete_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid;
begin
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) then
    raise exception 'Profile ownership mismatch';
  end if;
  insert into public.athletes (owner_user_id, display_name)
  values (new.user_id, new.display_name)
  on conflict (owner_user_id) do update set display_name = excluded.display_name, updated_at = now()
  returning id into v_athlete_id;
  insert into public.athlete_memberships (athlete_id, user_id, relationship_role)
  values (v_athlete_id, new.user_id, 'athlete')
  on conflict (athlete_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.sync_athlete_identity() from public, anon, authenticated;
drop trigger if exists sync_athlete_identity on public.athlete_profiles;
create trigger sync_athlete_identity
after insert or update of display_name on public.athlete_profiles
for each row execute function private.sync_athlete_identity();

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  source_type text not null check (source_type in ('check_in', 'checkout', 'recovery', 'daily')),
  source_id uuid,
  schema_version integer not null,
  engine_version text not null,
  status text not null check (status in ('ready', 'adjust', 'limit', 'stop_and_check')),
  confidence numeric not null check (confidence between 0 and 1),
  score numeric check (score is null or score between 0 and 100),
  result_json jsonb not null,
  context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.athlete_baselines (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  metric_key text not null,
  cohort_key text not null default 'all',
  window_days integer not null check (window_days between 7 and 365),
  sample_size integer not null check (sample_size >= 0),
  baseline_value numeric,
  confidence numeric not null check (confidence between 0 and 1),
  calculation_version text not null,
  calculated_at timestamptz not null default now(),
  unique (athlete_id, metric_key, cohort_key, window_days)
);

create table if not exists public.athlete_insights (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  insight_key text not null,
  status text not null default 'active' check (status in ('active', 'dismissed', 'expired')),
  sample_size integer not null check (sample_size >= 0),
  confidence numeric not null check (confidence between 0 and 1),
  window_start date not null,
  window_end date not null,
  insight_json jsonb not null,
  calculation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, insight_key, window_start, window_end)
);

create index if not exists athlete_memberships_user_idx on public.athlete_memberships(user_id, status);
create index if not exists athlete_activities_athlete_idx on public.athlete_activities(athlete_id, is_primary desc);
create index if not exists recommendations_athlete_created_idx on public.recommendations(athlete_id, created_at desc);
create index if not exists athlete_baselines_lookup_idx on public.athlete_baselines(athlete_id, metric_key, window_days);
create index if not exists athlete_insights_active_idx on public.athlete_insights(athlete_id, status, updated_at desc);

alter table public.athletes enable row level security;
alter table public.athlete_memberships enable row level security;
alter table public.athlete_physiology_profiles enable row level security;
alter table public.athlete_activities enable row level security;
alter table public.recommendations enable row level security;
alter table public.athlete_baselines enable row level security;
alter table public.athlete_insights enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_athlete_access(target_athlete_id uuid, required_scope text default null, required_role text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.athlete_memberships membership
    where membership.athlete_id = target_athlete_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (required_scope is null or required_scope = any(membership.permission_scopes))
      and (required_role is null or membership.relationship_role = required_role)
  );
$$;

create or replace function private.is_athlete_owner(target_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.athletes athlete
    where athlete.id = target_athlete_id
      and athlete.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.has_athlete_access(uuid, text, text) from public, anon;
revoke all on function private.is_athlete_owner(uuid) from public, anon;
grant execute on function private.has_athlete_access(uuid, text, text) to authenticated;
grant execute on function private.is_athlete_owner(uuid) to authenticated;

create policy "Members can read athletes" on public.athletes for select to authenticated
using (owner_user_id = (select auth.uid()) or private.has_athlete_access(id, 'profile'));
create policy "Owners can create athletes" on public.athletes for insert to authenticated
with check (owner_user_id = (select auth.uid()));
create policy "Owners can update athletes" on public.athletes for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy "Members can read memberships" on public.athlete_memberships for select to authenticated
using (user_id = (select auth.uid()) or private.is_athlete_owner(athlete_id));
create policy "Owners manage memberships" on public.athlete_memberships for all to authenticated
using (private.is_athlete_owner(athlete_id))
with check (private.is_athlete_owner(athlete_id));

create policy "Athletes manage physiology" on public.athlete_physiology_profiles for all to authenticated
using (private.has_athlete_access(athlete_id, 'health', 'athlete'))
with check (private.has_athlete_access(athlete_id, 'health', 'athlete'));

create policy "Active members manage activities" on public.athlete_activities for all to authenticated
using (private.has_athlete_access(athlete_id, 'profile'))
with check (private.has_athlete_access(athlete_id, 'profile'));
create policy "Active members manage recommendations" on public.recommendations for all to authenticated
using (private.has_athlete_access(athlete_id, 'health'))
with check (private.has_athlete_access(athlete_id, 'health'));
create policy "Active members read baselines" on public.athlete_baselines for select to authenticated
using (private.has_athlete_access(athlete_id, 'history'));
create policy "Athletes manage baselines" on public.athlete_baselines for all to authenticated
using (private.has_athlete_access(athlete_id, 'history', 'athlete'))
with check (private.has_athlete_access(athlete_id, 'history', 'athlete'));
create policy "Active members read insights" on public.athlete_insights for select to authenticated
using (private.has_athlete_access(athlete_id, 'history'));
create policy "Athletes manage insights" on public.athlete_insights for all to authenticated
using (private.has_athlete_access(athlete_id, 'history', 'athlete'))
with check (private.has_athlete_access(athlete_id, 'history', 'athlete'));

revoke all on public.athletes, public.athlete_memberships, public.athlete_physiology_profiles, public.athlete_activities, public.recommendations, public.athlete_baselines, public.athlete_insights from anon;
grant select, insert, update on public.athletes, public.athlete_memberships, public.athlete_physiology_profiles, public.athlete_activities, public.recommendations, public.athlete_baselines, public.athlete_insights to authenticated;
grant delete on public.athlete_memberships, public.athlete_physiology_profiles, public.athlete_activities, public.recommendations, public.athlete_baselines, public.athlete_insights to authenticated;

update public.pain_issues set status = 'improving' where status = 'monitoring';
update public.pain_issues set status = 'active' where status = 'evaluated';
alter table public.pain_issues drop constraint if exists pain_issues_status_check;
alter table public.pain_issues add constraint pain_issues_status_check check (status in ('active', 'improving', 'resolved', 'recurring'));

-- Keep the existing privacy control complete as health data moves into
-- athlete-owned tables. SECURITY INVOKER intentionally leaves RLS in force.
create or replace function public.clear_complete_health_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  delete from public.recommendations
  where athlete_id in (
    select athlete.id from public.athletes athlete
    where athlete.owner_user_id = (select auth.uid())
  );
  delete from public.athlete_baselines
  where athlete_id in (
    select athlete.id from public.athletes athlete
    where athlete.owner_user_id = (select auth.uid())
  );
  delete from public.athlete_insights
  where athlete_id in (
    select athlete.id from public.athletes athlete
    where athlete.owner_user_id = (select auth.uid())
  );
  delete from public.athlete_physiology_profiles
  where athlete_id in (
    select athlete.id from public.athletes athlete
    where athlete.owner_user_id = (select auth.uid())
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
