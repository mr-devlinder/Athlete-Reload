create table if not exists public.privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  analytics_allowed boolean not null default false,
  cloud_sync boolean not null default true,
  coach_include_notes boolean not null default false,
  coach_include_pain boolean not null default false,
  local_copy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_preferences enable row level security;

grant select, insert, update, delete on public.privacy_preferences to authenticated;

drop policy if exists "Users can read own privacy preferences" on public.privacy_preferences;
create policy "Users can read own privacy preferences"
on public.privacy_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own privacy preferences" on public.privacy_preferences;
create policy "Users can insert own privacy preferences"
on public.privacy_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own privacy preferences" on public.privacy_preferences;
create policy "Users can update own privacy preferences"
on public.privacy_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own privacy preferences" on public.privacy_preferences;
create policy "Users can delete own privacy preferences"
on public.privacy_preferences
for delete
to authenticated
using ((select auth.uid()) = user_id);
