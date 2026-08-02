create table if not exists public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  food jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index if not exists saved_foods_user_created_idx on public.saved_foods (user_id, created_at desc);
alter table public.saved_foods enable row level security;

create policy "Users can read their saved foods" on public.saved_foods for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can save their own foods" on public.saved_foods for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own saved foods" on public.saved_foods for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can remove their own saved foods" on public.saved_foods for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.verified_foods (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  food jsonb not null,
  verified_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists verified_foods_created_idx on public.verified_foods (created_at desc);
alter table public.verified_foods enable row level security;
create policy "Authenticated users can read verified foods" on public.verified_foods for select to authenticated using (true);

grant select, insert, update, delete on public.saved_foods to authenticated;
grant select on public.verified_foods to authenticated;

