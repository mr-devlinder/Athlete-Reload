alter table public.privacy_preferences
  add column if not exists ai_personalization_enabled boolean not null default true;

-- Curated food records are shared catalog data and may outlive the curator's account.
alter table public.verified_foods
  drop constraint if exists verified_foods_verified_by_fkey;

alter table public.verified_foods
  add constraint verified_foods_verified_by_fkey
  foreign key (verified_by) references auth.users(id) on delete set null;

create index if not exists verified_foods_verified_by_idx
  on public.verified_foods(verified_by);
