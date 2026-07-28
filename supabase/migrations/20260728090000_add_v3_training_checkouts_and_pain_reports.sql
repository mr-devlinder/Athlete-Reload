create table if not exists public.training_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  schedule_event_id uuid references public.schedule_events(id) on delete set null,
  session_date date not null default current_date,
  session_title text not null default 'Training',
  planned_type text not null default 'Training',
  planned_load text not null default 'Medium',
  planned_minutes integer,
  actual_minutes integer not null,
  difficulty integer not null,
  pain_change text not null,
  completion_level text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pain_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_type text not null,
  source_id uuid,
  report_date date not null default current_date,
  body_part text not null,
  side text not null default 'center',
  severity integer not null check (severity >= 0 and severity <= 100),
  trigger_movement text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists training_checkouts_user_date_idx
  on public.training_checkouts(user_id, session_date desc, created_at desc);

create index if not exists training_checkouts_event_idx
  on public.training_checkouts(schedule_event_id);

create index if not exists pain_reports_user_part_date_idx
  on public.pain_reports(user_id, body_part, side, report_date desc);

alter table public.training_checkouts enable row level security;
alter table public.pain_reports enable row level security;

drop policy if exists "Users can read own training checkouts" on public.training_checkouts;
create policy "Users can read own training checkouts"
on public.training_checkouts for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own training checkouts" on public.training_checkouts;
create policy "Users can insert own training checkouts"
on public.training_checkouts for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own training checkouts" on public.training_checkouts;
create policy "Users can update own training checkouts"
on public.training_checkouts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own training checkouts" on public.training_checkouts;
create policy "Users can delete own training checkouts"
on public.training_checkouts for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own pain reports" on public.pain_reports;
create policy "Users can read own pain reports"
on public.pain_reports for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own pain reports" on public.pain_reports;
create policy "Users can insert own pain reports"
on public.pain_reports for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own pain reports" on public.pain_reports;
create policy "Users can update own pain reports"
on public.pain_reports for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own pain reports" on public.pain_reports;
create policy "Users can delete own pain reports"
on public.pain_reports for delete
to authenticated
using ((select auth.uid()) = user_id);
