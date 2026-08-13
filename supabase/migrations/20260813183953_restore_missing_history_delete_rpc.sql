create or replace function public.delete_history_entry_complete(p_kind text, p_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  if p_kind = 'check_in' then
    if not exists (select 1 from public.check_ins where id=p_entry_id and user_id=current_user_id) then
      raise exception 'Check-in not found';
    end if;
    delete from public.pain_reports where user_id=current_user_id and source_type='check_in' and source_id=p_entry_id;
    delete from public.recommendations where source_type='check_in' and source_id=p_entry_id
      and athlete_id in (select id from public.athletes where owner_user_id=current_user_id);
    delete from public.check_ins where id=p_entry_id and user_id=current_user_id;
  elsif p_kind = 'checkout' then
    if not exists (select 1 from public.training_checkouts where id=p_entry_id and user_id=current_user_id) then
      raise exception 'Checkout not found';
    end if;
    delete from public.pain_reports where user_id=current_user_id and source_type='checkout' and source_id=p_entry_id;
    delete from public.recommendations where source_type='checkout' and source_id=p_entry_id
      and athlete_id in (select id from public.athletes where owner_user_id=current_user_id);
    update public.recovery_plans set source_checkout_id=null where user_id=current_user_id and source_checkout_id=p_entry_id;
    delete from public.training_checkouts where id=p_entry_id and user_id=current_user_id;
  else
    raise exception 'Unsupported history kind';
  end if;
end;
$function$;

grant execute on function public.delete_history_entry_complete(text, uuid) to authenticated;
revoke execute on function public.delete_history_entry_complete(text, uuid) from anon, public;
