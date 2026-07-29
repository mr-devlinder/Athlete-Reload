alter table public.schedule_events
  add column if not exists association text not null default 'Personal';

create table if not exists public.athlete_associations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create index if not exists athlete_associations_user_name_idx
  on public.athlete_associations(user_id, name);

alter table public.athlete_associations enable row level security;

grant select, insert, update, delete on public.athlete_associations to authenticated;

drop policy if exists "Users can read own athlete associations" on public.athlete_associations;
create policy "Users can read own athlete associations"
on public.athlete_associations for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own athlete associations" on public.athlete_associations;
create policy "Users can insert own athlete associations"
on public.athlete_associations for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own athlete associations" on public.athlete_associations;
create policy "Users can update own athlete associations"
on public.athlete_associations for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own athlete associations" on public.athlete_associations;
create policy "Users can delete own athlete associations"
on public.athlete_associations for delete
to authenticated
using ((select auth.uid()) = user_id);
