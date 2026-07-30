alter table public.check_ins
  add column if not exists pain_map jsonb not null default '{}'::jsonb;
