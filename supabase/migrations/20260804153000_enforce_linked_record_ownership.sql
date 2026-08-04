create or replace function public.enforce_linked_record_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name in ('check_ins', 'training_checkouts') and new.schedule_event_id is not null
    and not exists (select 1 from public.schedule_events where id = new.schedule_event_id and user_id = new.user_id) then
    raise exception 'Referenced schedule event must belong to the authenticated user';
  end if;

  if tg_table_name = 'schedule_events' and new.tournament_id is not null
    and not exists (select 1 from public.tournaments where id = new.tournament_id and user_id = new.user_id) then
    raise exception 'Referenced tournament must belong to the authenticated user';
  end if;

  if tg_table_name = 'saved_recovery_routines' and new.source_checkout_id is not null
    and not exists (select 1 from public.training_checkouts where id = new.source_checkout_id and user_id = new.user_id) then
    raise exception 'Referenced checkout must belong to the authenticated user';
  end if;

  if tg_table_name = 'recovery_routine_completions' then
    if new.routine_id is not null
      and not exists (select 1 from public.saved_recovery_routines where id = new.routine_id and user_id = new.user_id) then
      raise exception 'Referenced routine must belong to the authenticated user';
    end if;
    if new.source_checkout_id is not null
      and not exists (select 1 from public.training_checkouts where id = new.source_checkout_id and user_id = new.user_id) then
      raise exception 'Referenced checkout must belong to the authenticated user';
    end if;
  end if;

  if tg_table_name = 'voice_logs' and new.event_id is not null
    and not exists (select 1 from public.schedule_events where id = new.event_id and user_id = new.user_id) then
    raise exception 'Referenced schedule event must belong to the authenticated user';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_linked_record_ownership() from public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'check_ins', 'training_checkouts', 'schedule_events',
    'saved_recovery_routines', 'recovery_routine_completions', 'voice_logs'
  ] loop
    execute format('drop trigger if exists enforce_linked_record_ownership on public.%I', table_name);
    execute format(
      'create trigger enforce_linked_record_ownership before insert or update on public.%I for each row execute function public.enforce_linked_record_ownership()',
      table_name
    );
  end loop;
end;
$$;
