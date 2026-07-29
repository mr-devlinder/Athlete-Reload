alter table public.check_ins
  add column if not exists pain_trend text not null default 'New',
  add column if not exists affected_movement text not null default 'None';
