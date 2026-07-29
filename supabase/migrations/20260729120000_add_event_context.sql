alter table public.schedule_events
  add column if not exists expected_duration integer not null default 60,
  add column if not exists surface text not null default 'Grass',
  add column if not exists environment text not null default 'Outdoor',
  add column if not exists location text not null default '';

alter table public.check_ins
  add column if not exists leg_heaviness integer not null default 1,
  add column if not exists illness_symptoms text not null default 'None',
  add column if not exists sleep_quality integer not null default 5,
  add column if not exists expected_difficulty integer not null default 5,
  add column if not exists recovery_actions jsonb not null default '[]'::jsonb;
