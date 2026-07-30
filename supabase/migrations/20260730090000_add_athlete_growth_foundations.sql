alter table public.athlete_profiles
  add column if not exists gender_identity text not null default '',
  add column if not exists height_inches numeric,
  add column if not exists weight_lbs numeric,
  add column if not exists sport_profiles jsonb not null default '[]'::jsonb;

create table if not exists public.daily_wellness (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  wellness_date date not null default current_date,
  hydration_oz integer not null default 0 check (hydration_oz >= 0),
  nutrition_entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, wellness_date)
);

create table if not exists public.pain_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body_part text not null,
  side text not null default 'center',
  status text not null default 'active' check (status in ('active', 'monitoring', 'evaluated', 'resolved')),
  first_reported_date date not null default current_date,
  resolved_date date,
  athlete_notes text not null default '',
  trainer_notes text not null default '',
  clinician_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_recovery_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_checkout_id uuid references public.training_checkouts(id) on delete set null,
  title text not null,
  routine_json jsonb not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recovery_routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  routine_id uuid references public.saved_recovery_routines(id) on delete set null,
  source_checkout_id uuid references public.training_checkouts(id) on delete set null,
  completion_json jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  association text not null default 'Personal',
  start_date date not null,
  end_date date not null,
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.schedule_events
  add column if not exists availability text not null default 'Required' check (availability in ('Required max effort', 'Required', 'Optional', 'Recovery')),
  add column if not exists opponent text not null default '',
  add column if not exists venue text not null default '',
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null;

create table if not exists public.share_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  report_type text not null,
  report_reference_id uuid,
  recipient_label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists daily_wellness_user_date_idx on public.daily_wellness(user_id, wellness_date desc);
create index if not exists pain_issues_user_status_idx on public.pain_issues(user_id, status, updated_at desc);
create index if not exists saved_recovery_routines_user_favorite_idx on public.saved_recovery_routines(user_id, is_favorite desc, updated_at desc);
create index if not exists recovery_routine_completions_user_completed_idx on public.recovery_routine_completions(user_id, completed_at desc);
create index if not exists tournaments_user_start_idx on public.tournaments(user_id, start_date desc);
create index if not exists share_audit_log_user_created_idx on public.share_audit_log(user_id, created_at desc);

alter table public.daily_wellness enable row level security;
alter table public.pain_issues enable row level security;
alter table public.saved_recovery_routines enable row level security;
alter table public.recovery_routine_completions enable row level security;
alter table public.tournaments enable row level security;
alter table public.share_audit_log enable row level security;

grant select, insert, update, delete on public.daily_wellness, public.pain_issues, public.saved_recovery_routines, public.recovery_routine_completions, public.tournaments, public.share_audit_log to authenticated;

create policy "Users manage own daily wellness" on public.daily_wellness for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own pain issues" on public.pain_issues for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own saved recovery routines" on public.saved_recovery_routines for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own recovery routine completions" on public.recovery_routine_completions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own tournaments" on public.tournaments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own share audit log" on public.share_audit_log for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
