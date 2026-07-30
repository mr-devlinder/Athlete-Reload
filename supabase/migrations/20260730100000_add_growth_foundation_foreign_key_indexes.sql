create index if not exists saved_recovery_routines_checkout_idx
  on public.saved_recovery_routines(source_checkout_id);

create index if not exists recovery_routine_completions_routine_idx
  on public.recovery_routine_completions(routine_id);

create index if not exists recovery_routine_completions_checkout_idx
  on public.recovery_routine_completions(source_checkout_id);

create index if not exists schedule_events_tournament_idx
  on public.schedule_events(tournament_id);
