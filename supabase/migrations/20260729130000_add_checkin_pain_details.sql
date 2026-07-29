alter table public.check_ins
  add column if not exists pain_details jsonb not null default '{}'::jsonb;
