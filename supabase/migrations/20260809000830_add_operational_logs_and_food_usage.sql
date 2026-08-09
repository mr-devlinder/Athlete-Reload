create table if not exists public.operational_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null check (feature ~ '^[a-z0-9_-]{2,50}$'),
  error_code text not null check (error_code ~ '^[A-Z0-9_]{2,80}$'),
  severity text not null check (severity in ('info', 'warning', 'error')),
  release_version text not null default 'unknown',
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists operational_events_created_idx
  on public.operational_events (created_at desc);
create index if not exists operational_events_feature_code_idx
  on public.operational_events (feature, error_code, created_at desc);

alter table public.operational_events enable row level security;
revoke all on public.operational_events from anon, authenticated;

create or replace function public.record_operational_event(
  p_feature text,
  p_error_code text,
  p_severity text default 'error',
  p_release_version text default 'unknown'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_correlation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_feature !~ '^[a-z0-9_-]{2,50}$' then raise exception 'Invalid feature'; end if;
  if p_error_code !~ '^[A-Z0-9_]{2,80}$' then raise exception 'Invalid error code'; end if;
  if p_severity not in ('info', 'warning', 'error') then raise exception 'Invalid severity'; end if;

  delete from public.operational_events where created_at < now() - interval '30 days';
  insert into public.operational_events (user_id, feature, error_code, severity, release_version)
  values (auth.uid(), p_feature, p_error_code, p_severity, left(coalesce(p_release_version, 'unknown'), 50))
  returning correlation_id into event_correlation_id;
  return event_correlation_id;
end;
$$;

revoke all on function public.record_operational_event(text, text, text, text) from public, anon;
grant execute on function public.record_operational_event(text, text, text, text) to authenticated;

alter table public.verified_foods
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id text,
  add column if not exists display_name text,
  add column if not exists duplicate_fingerprint text;

create unique index if not exists verified_foods_duplicate_fingerprint_idx
  on public.verified_foods (duplicate_fingerprint)
  where duplicate_fingerprint is not null;
create unique index if not exists verified_foods_source_identity_idx
  on public.verified_foods (source_type, source_id)
  where source_id is not null;

create table if not exists public.external_food_usage (
  source_type text not null check (source_type in ('usda_generic', 'usda_branded', 'open_food_facts')),
  source_id text not null,
  display_name text not null,
  brand text not null default '',
  selection_count bigint not null default 1 check (selection_count > 0),
  first_selected_at timestamptz not null default now(),
  last_selected_at timestamptz not null default now(),
  primary key (source_type, source_id)
);

create index if not exists external_food_usage_popular_idx
  on public.external_food_usage (selection_count desc, last_selected_at desc);

alter table public.external_food_usage enable row level security;
revoke all on public.external_food_usage from anon, authenticated;

create or replace function public.record_external_food_usage(
  p_source_type text,
  p_source_id text,
  p_display_name text,
  p_brand text default ''
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.external_food_usage (source_type, source_id, display_name, brand)
  values (p_source_type, left(p_source_id, 180), left(p_display_name, 180), left(coalesce(p_brand, ''), 180))
  on conflict (source_type, source_id) do update set
    display_name = excluded.display_name,
    brand = excluded.brand,
    selection_count = public.external_food_usage.selection_count + 1,
    last_selected_at = now();
$$;

revoke all on function public.record_external_food_usage(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_external_food_usage(text, text, text, text) to service_role;

create or replace function public.get_release_compatibility()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 20260809000830,
    'features', jsonb_build_array(
      'adaptive-recommendations', 'database-rate-limits', 'operational-events',
      'complete-health-clear', 'verified-food-catalog', 'external-food-usage'
    )
  );
$$;

revoke all on function public.get_release_compatibility() from public, anon;
grant execute on function public.get_release_compatibility() to authenticated;
