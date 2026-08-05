create or replace function public.enforce_linked_record_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  case tg_table_name
    when 'check_ins' then
      if new.schedule_event_id is not null and not exists (
        select 1 from public.schedule_events where id = new.schedule_event_id and user_id = new.user_id
      ) then
        raise exception 'Referenced schedule event must belong to the authenticated user';
      end if;
    when 'training_checkouts' then
      if new.schedule_event_id is not null and not exists (
        select 1 from public.schedule_events where id = new.schedule_event_id and user_id = new.user_id
      ) then
        raise exception 'Referenced schedule event must belong to the authenticated user';
      end if;
    when 'schedule_events' then
      if new.tournament_id is not null and not exists (
        select 1 from public.tournaments where id = new.tournament_id and user_id = new.user_id
      ) then
        raise exception 'Referenced tournament must belong to the authenticated user';
      end if;
    when 'saved_recovery_routines' then
      if new.source_checkout_id is not null and not exists (
        select 1 from public.training_checkouts where id = new.source_checkout_id and user_id = new.user_id
      ) then
        raise exception 'Referenced checkout must belong to the authenticated user';
      end if;
    when 'recovery_routine_completions' then
      if new.routine_id is not null and not exists (
        select 1 from public.saved_recovery_routines where id = new.routine_id and user_id = new.user_id
      ) then
        raise exception 'Referenced routine must belong to the authenticated user';
      end if;
      if new.source_checkout_id is not null and not exists (
        select 1 from public.training_checkouts where id = new.source_checkout_id and user_id = new.user_id
      ) then
        raise exception 'Referenced checkout must belong to the authenticated user';
      end if;
    when 'voice_logs' then
      if new.event_id is not null and not exists (
        select 1 from public.schedule_events where id = new.event_id and user_id = new.user_id
      ) then
        raise exception 'Referenced schedule event must belong to the authenticated user';
      end if;
    else
      raise exception 'Unsupported ownership trigger table: %', tg_table_name;
  end case;

  return new;
end;
$$;

revoke all on function public.enforce_linked_record_ownership() from public;

-- Recreate the triggers idempotently so stale attachments cannot survive.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'check_ins', 'training_checkouts', 'schedule_events',
    'saved_recovery_routines', 'recovery_routine_completions', 'voice_logs'
  ] loop
    execute format('drop trigger if exists enforce_linked_record_ownership on public.%I', target_table);
    execute format(
      'create trigger enforce_linked_record_ownership before insert or update on public.%I for each row execute function public.enforce_linked_record_ownership()',
      target_table
    );
  end loop;
end;
$$;

alter table public.schedule_events enable row level security;

drop policy if exists "Users can insert own schedule events" on public.schedule_events;
create policy "Users can insert own schedule events"
on public.schedule_events for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own schedule events" on public.schedule_events;
create policy "Users can read own schedule events"
on public.schedule_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own schedule events" on public.schedule_events;
create policy "Users can update own schedule events"
on public.schedule_events for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own schedule events" on public.schedule_events;
create policy "Users can delete own schedule events"
on public.schedule_events for delete to authenticated
using ((select auth.uid()) = user_id);
