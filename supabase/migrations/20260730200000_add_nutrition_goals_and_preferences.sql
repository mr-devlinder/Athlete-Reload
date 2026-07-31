alter table public.athlete_profiles
  add column if not exists age_years integer check (age_years is null or age_years between 13 and 120),
  add column if not exists goals jsonb not null default '[]'::jsonb,
  add column if not exists dietary_preferences jsonb not null default '[]'::jsonb,
  add column if not exists tracking_preferences jsonb not null default '{"mode":"standard","nutrition":true,"voice":false,"detailed_pain":true,"recovery":true,"schedule":true}'::jsonb;

alter table public.privacy_preferences
  add column if not exists coach_include_nutrition boolean not null default false;

alter table public.daily_wellness
  add column if not exists nutrition_goal_override jsonb not null default '{}'::jsonb,
  add column if not exists meal_timing_json jsonb not null default '{}'::jsonb;

create table if not exists public.event_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  template_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  log_type text not null check (log_type in ('check_in', 'checkout', 'general')),
  transcript text not null,
  extracted_json jsonb not null default '{}'::jsonb,
  event_id uuid references public.schedule_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists daily_wellness_user_date_history_idx
  on public.daily_wellness(user_id, wellness_date desc);
create index if not exists event_templates_user_updated_idx
  on public.event_templates(user_id, updated_at desc);
create index if not exists voice_logs_user_created_idx
  on public.voice_logs(user_id, created_at desc);
create index if not exists voice_logs_event_idx
  on public.voice_logs(event_id);

alter table public.event_templates enable row level security;
alter table public.voice_logs enable row level security;

grant select, insert, update, delete on public.event_templates, public.voice_logs to authenticated;

create policy "Users manage own event templates" on public.event_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own voice logs" on public.voice_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
