alter table public.training_checkouts
  add column if not exists completion_reason text not null default '';

comment on column public.training_checkouts.completion_reason is
  'Athlete-provided reason when a session was shortened, modified, stopped early, or not started.';

do $$
begin
  if to_regprocedure('public.save_checkin_with_pain_reports_base(jsonb,jsonb,uuid)') is null then
    alter function public.save_checkin_with_pain_reports(jsonb,jsonb,uuid) rename to save_checkin_with_pain_reports_base;
  end if;
  if to_regprocedure('public.save_checkout_with_pain_reports_base(jsonb,jsonb,uuid)') is null then
    alter function public.save_checkout_with_pain_reports(jsonb,jsonb,uuid) rename to save_checkout_with_pain_reports_base;
  end if;
end $$;

create or replace function public.save_checkin_with_pain_reports(
  p_check_in jsonb,
  p_pain_reports jsonb default '[]'::jsonb,
  p_check_in_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  saved_id uuid;
  current_user_id uuid := auth.uid();
begin
  result := public.save_checkin_with_pain_reports_base(p_check_in, p_pain_reports, p_check_in_id);
  saved_id := (result->'record'->>'id')::uuid;
  delete from public.pain_reports where user_id=current_user_id and source_type='check_in' and source_id=saved_id;
  insert into public.pain_reports (
    user_id, source_type, source_id, report_date, body_part, side, severity,
    trigger_movement, notes, onset, trend, movement_effect, related_event_id
  )
  select current_user_id, 'check_in', saved_id, x.report_date, x.body_part, x.side, x.severity,
    x.trigger_movement, x.notes, x.onset, x.trend, x.movement_effect, x.related_event_id
  from jsonb_to_recordset(coalesce(p_pain_reports, '[]'::jsonb)) as x(
    report_date date, body_part text, side text, severity integer, trigger_movement text,
    notes text, onset text, trend text, movement_effect text, related_event_id uuid
  );
  return jsonb_build_object(
    'record', result->'record',
    'painReports', coalesce((select jsonb_agg(to_jsonb(p)) from public.pain_reports p where p.user_id=current_user_id and p.source_type='check_in' and p.source_id=saved_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_checkout_with_pain_reports(
  p_checkout jsonb,
  p_pain_reports jsonb default '[]'::jsonb,
  p_checkout_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  saved_id uuid;
  saved_record jsonb;
  current_user_id uuid := auth.uid();
begin
  result := public.save_checkout_with_pain_reports_base(p_checkout, p_pain_reports, p_checkout_id);
  saved_id := (result->'record'->>'id')::uuid;
  update public.training_checkouts
    set completion_reason=coalesce(p_checkout->>'completion_reason','')
    where id=saved_id and user_id=current_user_id;
  delete from public.pain_reports where user_id=current_user_id and source_type='checkout' and source_id=saved_id;
  insert into public.pain_reports (
    user_id, source_type, source_id, report_date, body_part, side, severity,
    trigger_movement, notes, onset, trend, movement_effect, related_event_id
  )
  select current_user_id, 'checkout', saved_id, x.report_date, x.body_part, x.side, x.severity,
    x.trigger_movement, x.notes, x.onset, x.trend, x.movement_effect, x.related_event_id
  from jsonb_to_recordset(coalesce(p_pain_reports, '[]'::jsonb)) as x(
    report_date date, body_part text, side text, severity integer, trigger_movement text,
    notes text, onset text, trend text, movement_effect text, related_event_id uuid
  );
  select to_jsonb(c) into saved_record from public.training_checkouts c where c.id=saved_id and c.user_id=current_user_id;
  return jsonb_build_object(
    'record', saved_record,
    'painReports', coalesce((select jsonb_agg(to_jsonb(p)) from public.pain_reports p where p.user_id=current_user_id and p.source_type='checkout' and p.source_id=saved_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.save_checkin_with_pain_reports_base(jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.save_checkout_with_pain_reports_base(jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.save_checkin_with_pain_reports(jsonb,jsonb,uuid) from public, anon;
revoke all on function public.save_checkout_with_pain_reports(jsonb,jsonb,uuid) from public, anon;
grant execute on function public.save_checkin_with_pain_reports(jsonb,jsonb,uuid) to authenticated;
grant execute on function public.save_checkout_with_pain_reports(jsonb,jsonb,uuid) to authenticated;
