create table if not exists public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null,
  sport text not null default '',
  position text not null default '',
  training_style text not null default 'Team and individual',
  dominant_side text not null default 'Right',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athlete_profiles enable row level security;

grant select, insert, update on public.athlete_profiles to authenticated;

drop policy if exists "Users can read own athlete profile" on public.athlete_profiles;
create policy "Users can read own athlete profile"
on public.athlete_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own athlete profile" on public.athlete_profiles;
create policy "Users can insert own athlete profile"
on public.athlete_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own athlete profile" on public.athlete_profiles;
create policy "Users can update own athlete profile"
on public.athlete_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
