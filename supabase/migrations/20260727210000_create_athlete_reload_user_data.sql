create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_date date not null,
  title text not null default 'Training',
  event_type text not null default 'Team practice',
  load_level text not null default 'Medium',
  event_time text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  check_in_date date not null default current_date,
  score integer not null,
  energy integer not null,
  soreness integer not null,
  pain integer not null,
  fatigue integer not null,
  sleep numeric not null,
  stress text not null,
  yesterday_load text not null,
  hydration text not null,
  pain_location text not null,
  injury_type text not null,
  pain_type text not null,
  hurts_when text not null,
  session_type text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists schedule_events_user_date_idx
  on public.schedule_events(user_id, event_date);

create index if not exists check_ins_user_date_idx
  on public.check_ins(user_id, check_in_date desc, created_at desc);

alter table public.schedule_events enable row level security;
alter table public.check_ins enable row level security;

drop policy if exists "Users can read own schedule events" on public.schedule_events;
create policy "Users can read own schedule events"
on public.schedule_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own schedule events" on public.schedule_events;
create policy "Users can insert own schedule events"
on public.schedule_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own schedule events" on public.schedule_events;
create policy "Users can update own schedule events"
on public.schedule_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own schedule events" on public.schedule_events;
create policy "Users can delete own schedule events"
on public.schedule_events for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own check ins" on public.check_ins;
create policy "Users can read own check ins"
on public.check_ins for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own check ins" on public.check_ins;
create policy "Users can insert own check ins"
on public.check_ins for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own check ins" on public.check_ins;
create policy "Users can delete own check ins"
on public.check_ins for delete
to authenticated
using ((select auth.uid()) = user_id);
