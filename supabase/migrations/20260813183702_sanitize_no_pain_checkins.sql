alter table public.check_ins
  alter column pain_location drop not null,
  alter column injury_type drop not null,
  alter column pain_type drop not null,
  alter column pain_trend drop not null,
  alter column pain_trend drop default,
  alter column affected_movement drop not null,
  alter column affected_movement drop default,
  alter column hurts_when drop not null;

create or replace function public.save_checkin_with_pain_reports(
  p_check_in jsonb,
  p_pain_reports jsonb default '[]'::jsonb,
  p_check_in_id uuid default null::uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
  saved_id uuid;
  current_user_id uuid := auth.uid();
  sanitized_check_in jsonb := coalesce(p_check_in, '{}'::jsonb);
  sanitized_reports jsonb := coalesce(p_pain_reports, '[]'::jsonb);
  has_pain boolean := coalesce((p_check_in->>'pain')::numeric, 0) > 0
    or exists (
      select 1
      from jsonb_each_text(coalesce(p_check_in->'pain_map', '{}'::jsonb)) as pain_entry
      where pain_entry.value ~ '^[0-9]+([.][0-9]+)?$'
        and pain_entry.value::numeric > 0
    );
begin
  if not has_pain then
    sanitized_check_in := sanitized_check_in || jsonb_build_object(
      'pain', 0,
      'pain_map', '{}'::jsonb,
      'pain_details', '{}'::jsonb,
      'pain_location', null,
      'injury_type', null,
      'pain_type', null,
      'pain_trend', null,
      'affected_movement', null,
      'hurts_when', null
    );
    sanitized_reports := '[]'::jsonb;
  end if;

  result := public.save_checkin_with_pain_reports_base(sanitized_check_in, sanitized_reports, p_check_in_id);
  saved_id := (result->'record'->>'id')::uuid;

  delete from public.pain_reports
  where user_id = current_user_id and source_type = 'check_in' and source_id = saved_id;

  insert into public.pain_reports (
    user_id, source_type, source_id, report_date, body_part, side, severity,
    trigger_movement, notes, onset, trend, movement_effect, related_event_id
  )
  select current_user_id, 'check_in', saved_id, x.report_date, x.body_part, x.side, x.severity,
    x.trigger_movement, x.notes, x.onset, x.trend, x.movement_effect, x.related_event_id
  from jsonb_to_recordset(sanitized_reports) as x(
    report_date date, body_part text, side text, severity integer, trigger_movement text,
    notes text, onset text, trend text, movement_effect text, related_event_id uuid
  );

  return jsonb_build_object(
    'record', result->'record',
    'painReports', coalesce((
      select jsonb_agg(to_jsonb(p))
      from public.pain_reports p
      where p.user_id = current_user_id and p.source_type = 'check_in' and p.source_id = saved_id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.save_checkin_with_pain_reports(jsonb, jsonb, uuid) to authenticated;
revoke execute on function public.save_checkin_with_pain_reports(jsonb, jsonb, uuid) from anon, public;

-- Repair only the legacy placeholder combination on records that explicitly
-- contain no pain signal. Real pain records and their detail remain untouched.
update public.check_ins
set injury_type = null,
    pain_type = null,
    pain_trend = null,
    pain_location = null,
    hurts_when = null,
    affected_movement = null,
    pain_details = '{}'::jsonb
where coalesce(pain, 0) = 0
  and not exists (
    select 1
    from jsonb_each_text(coalesce(pain_map, '{}'::jsonb)) as pain_entry
    where pain_entry.value ~ '^[0-9]+([.][0-9]+)?$'
      and pain_entry.value::numeric > 0
  )
  and injury_type = 'Unknown'
  and pain_type = 'No pain'
  and pain_trend = 'New'
  and pain_location = 'Hamstring'
  and hurts_when = 'At rest'
  and affected_movement = 'None';
