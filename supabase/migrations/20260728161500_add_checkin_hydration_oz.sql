alter table public.check_ins
  add column if not exists hydration_oz integer not null default 0;
