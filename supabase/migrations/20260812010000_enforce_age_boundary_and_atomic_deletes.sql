-- Product boundary rollout is deliberately non-destructive.
-- Existing under-16 rows are retained with their true age and restricted for remediation.
alter table public.athlete_profiles
  add column if not exists product_access_status text not null default 'active'
  check (product_access_status in ('active', 'age_remediation_required'));

do $$
declare
  underage_count integer;
begin
  select count(*) into underage_count from public.athlete_profiles where age_years is not null and age_years < 16;
  raise notice 'Athlete Reload 16+ migration found % profile(s) below 16; records are retained and restricted.', underage_count;
end
$$;

update public.athlete_profiles
set product_access_status = 'age_remediation_required'
where age_years is not null and age_years < 16;

alter table public.athlete_profiles
  drop constraint if exists athlete_profiles_product_age_check;
alter table public.athlete_profiles
  add constraint athlete_profiles_product_age_check
  check (age_years is null or age_years >= 16) not valid;

comment on constraint athlete_profiles_product_age_check on public.athlete_profiles is
  'Enforced for new/updated rows. NOT VALID preserves existing under-16 records until support remediation; do not validate until the under-16 count is zero.';

alter table public.recommendations drop constraint if exists recommendations_status_check;
alter table public.recommendations add constraint recommendations_status_check
  check (status in ('ready', 'adjust', 'limit', 'stop_and_seek_help', 'stop_and_check'));

create or replace function public.delete_schedule_event_complete(p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.schedule_events where id = p_event_id and user_id = current_user_id) then
    raise exception 'Schedule event not found';
  end if;
  delete from public.pain_reports where user_id = current_user_id and source_id in (
    select id from public.check_ins where user_id = current_user_id and schedule_event_id = p_event_id
    union all
    select id from public.training_checkouts where user_id = current_user_id and schedule_event_id = p_event_id
  );
  delete from public.check_ins where user_id = current_user_id and schedule_event_id = p_event_id;
  delete from public.training_checkouts where user_id = current_user_id and schedule_event_id = p_event_id;
  delete from public.schedule_events where id = p_event_id and user_id = current_user_id;
end;
$$;

create or replace function public.delete_history_entry_complete(p_kind text, p_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_kind = 'check_in' then
    if not exists (select 1 from public.check_ins where id = p_entry_id and user_id = current_user_id) then raise exception 'Check-in not found'; end if;
    delete from public.pain_reports where user_id = current_user_id and source_type = 'check_in' and source_id = p_entry_id;
    delete from public.check_ins where id = p_entry_id and user_id = current_user_id;
  elsif p_kind = 'checkout' then
    if not exists (select 1 from public.training_checkouts where id = p_entry_id and user_id = current_user_id) then raise exception 'Checkout not found'; end if;
    delete from public.pain_reports where user_id = current_user_id and source_type = 'checkout' and source_id = p_entry_id;
    delete from public.training_checkouts where id = p_entry_id and user_id = current_user_id;
  else
    raise exception 'Unsupported history kind';
  end if;
end;
$$;

revoke all on function public.delete_schedule_event_complete(uuid) from public;
revoke all on function public.delete_history_entry_complete(text, uuid) from public;
grant execute on function public.delete_schedule_event_complete(uuid) to authenticated;
grant execute on function public.delete_history_entry_complete(text, uuid) to authenticated;
