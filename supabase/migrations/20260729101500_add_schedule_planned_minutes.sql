alter table public.schedule_events
  add column if not exists planned_minutes integer;
