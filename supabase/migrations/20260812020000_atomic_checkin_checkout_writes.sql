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
  current_user_id uuid := auth.uid();
  saved public.check_ins;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_check_in_id is not null and not exists (select 1 from public.check_ins where id = p_check_in_id and user_id = current_user_id) then
    raise exception 'Check-in not found';
  end if;
  if nullif(p_check_in->>'schedule_event_id', '') is not null and not exists (
    select 1 from public.schedule_events where id = (p_check_in->>'schedule_event_id')::uuid and user_id = current_user_id
  ) then raise exception 'Schedule event not found'; end if;

  if p_check_in_id is null then
    insert into public.check_ins (
      user_id, affected_movement, check_in_date, check_in_type, energy, event_time, fatigue,
      illness_symptoms, leg_heaviness, hurts_when, hydration, hydration_ml, injury_type, notes,
      pain, pain_details, pain_map, pain_trend, pain_location, pain_type, planned_intensity,
      recommendation_json, recovery_actions, schedule_event_id, score, session_title, session_type,
      sleep, sleep_quality, soreness, stress, yesterday_load, expected_difficulty
    ) values (
      current_user_id, p_check_in->>'affected_movement', (p_check_in->>'check_in_date')::date,
      p_check_in->>'check_in_type', (p_check_in->>'energy')::integer, p_check_in->>'event_time',
      (p_check_in->>'fatigue')::integer, p_check_in->>'illness_symptoms', (p_check_in->>'leg_heaviness')::integer,
      p_check_in->>'hurts_when', p_check_in->>'hydration', (p_check_in->>'hydration_ml')::numeric,
      p_check_in->>'injury_type', coalesce(p_check_in->>'notes', ''), (p_check_in->>'pain')::integer,
      coalesce(p_check_in->'pain_details', '{}'::jsonb), coalesce(p_check_in->'pain_map', '{}'::jsonb),
      p_check_in->>'pain_trend', p_check_in->>'pain_location', p_check_in->>'pain_type',
      p_check_in->>'planned_intensity', p_check_in->'recommendation_json', coalesce(p_check_in->'recovery_actions', '[]'::jsonb),
      nullif(p_check_in->>'schedule_event_id', '')::uuid, (p_check_in->>'score')::integer,
      p_check_in->>'session_title', p_check_in->>'session_type', (p_check_in->>'sleep')::numeric,
      (p_check_in->>'sleep_quality')::integer, (p_check_in->>'soreness')::integer, p_check_in->>'stress',
      p_check_in->>'yesterday_load', (p_check_in->>'expected_difficulty')::integer
    ) returning * into saved;
  else
    update public.check_ins set
      affected_movement=p_check_in->>'affected_movement', check_in_date=(p_check_in->>'check_in_date')::date,
      check_in_type=p_check_in->>'check_in_type', energy=(p_check_in->>'energy')::integer,
      event_time=p_check_in->>'event_time', fatigue=(p_check_in->>'fatigue')::integer,
      illness_symptoms=p_check_in->>'illness_symptoms', leg_heaviness=(p_check_in->>'leg_heaviness')::integer,
      hurts_when=p_check_in->>'hurts_when', hydration=p_check_in->>'hydration', hydration_ml=(p_check_in->>'hydration_ml')::numeric,
      injury_type=p_check_in->>'injury_type', notes=coalesce(p_check_in->>'notes',''), pain=(p_check_in->>'pain')::integer,
      pain_details=coalesce(p_check_in->'pain_details','{}'::jsonb), pain_map=coalesce(p_check_in->'pain_map','{}'::jsonb),
      pain_trend=p_check_in->>'pain_trend', pain_location=p_check_in->>'pain_location', pain_type=p_check_in->>'pain_type',
      planned_intensity=p_check_in->>'planned_intensity', recommendation_json=p_check_in->'recommendation_json',
      recovery_actions=coalesce(p_check_in->'recovery_actions','[]'::jsonb), schedule_event_id=nullif(p_check_in->>'schedule_event_id','')::uuid,
      score=(p_check_in->>'score')::integer, session_title=p_check_in->>'session_title', session_type=p_check_in->>'session_type',
      sleep=(p_check_in->>'sleep')::numeric, sleep_quality=(p_check_in->>'sleep_quality')::integer,
      soreness=(p_check_in->>'soreness')::integer, stress=p_check_in->>'stress', yesterday_load=p_check_in->>'yesterday_load',
      expected_difficulty=(p_check_in->>'expected_difficulty')::integer
    where id=p_check_in_id and user_id=current_user_id returning * into saved;
    delete from public.pain_reports where user_id=current_user_id and source_type='check_in' and source_id=p_check_in_id;
  end if;

  insert into public.pain_reports (user_id, source_type, source_id, report_date, body_part, side, severity, trigger_movement, notes)
  select current_user_id, 'check_in', saved.id, x.report_date, x.body_part, x.side, x.severity, x.trigger_movement, x.notes
  from jsonb_to_recordset(coalesce(p_pain_reports, '[]'::jsonb)) as x(report_date date, body_part text, side text, severity integer, trigger_movement text, notes text);
  return jsonb_build_object('record', to_jsonb(saved), 'painReports', coalesce((select jsonb_agg(to_jsonb(p)) from public.pain_reports p where p.user_id=current_user_id and p.source_type='check_in' and p.source_id=saved.id), '[]'::jsonb));
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
  current_user_id uuid := auth.uid();
  saved public.training_checkouts;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_checkout_id is not null and not exists (select 1 from public.training_checkouts where id=p_checkout_id and user_id=current_user_id) then raise exception 'Checkout not found'; end if;
  if not exists (select 1 from public.schedule_events where id=(p_checkout->>'schedule_event_id')::uuid and user_id=current_user_id) then raise exception 'Schedule event not found'; end if;

  if p_checkout_id is null then
    insert into public.training_checkouts (
      user_id, actual_minutes, completion_level, cramping, difficulty, fatigue_affected_technique,
      heat_symptoms, mental_focus, motivation, movement_changed, new_pain, notes, pain_change,
      pain_details, pain_map, participation, planned_load, planned_minutes, planned_type, post_fatigue,
      post_soreness, performance_rating, recommendation_json, schedule_event_id, session_content,
      session_date, session_load, session_title
    ) values (
      current_user_id, (p_checkout->>'actual_minutes')::integer, p_checkout->>'completion_level',
      (p_checkout->>'cramping')::boolean, (p_checkout->>'difficulty')::integer,
      (p_checkout->>'fatigue_affected_technique')::boolean, coalesce(p_checkout->'heat_symptoms','[]'::jsonb),
      (p_checkout->>'mental_focus')::integer, (p_checkout->>'motivation')::integer,
      (p_checkout->>'movement_changed')::boolean, (p_checkout->>'new_pain')::boolean, coalesce(p_checkout->>'notes',''),
      p_checkout->>'pain_change', coalesce(p_checkout->'pain_details','{}'::jsonb), coalesce(p_checkout->'pain_map','{}'::jsonb),
      p_checkout->>'participation', p_checkout->>'planned_load', (p_checkout->>'planned_minutes')::integer,
      p_checkout->>'planned_type', (p_checkout->>'post_fatigue')::integer, (p_checkout->>'post_soreness')::integer,
      p_checkout->>'performance_rating', p_checkout->'recommendation_json', (p_checkout->>'schedule_event_id')::uuid,
      coalesce(p_checkout->'session_content','[]'::jsonb), (p_checkout->>'session_date')::date,
      (p_checkout->>'session_load')::numeric, p_checkout->>'session_title'
    ) returning * into saved;
  else
    update public.training_checkouts set
      actual_minutes=(p_checkout->>'actual_minutes')::integer, completion_level=p_checkout->>'completion_level',
      cramping=(p_checkout->>'cramping')::boolean, difficulty=(p_checkout->>'difficulty')::integer,
      fatigue_affected_technique=(p_checkout->>'fatigue_affected_technique')::boolean,
      heat_symptoms=coalesce(p_checkout->'heat_symptoms','[]'::jsonb), mental_focus=(p_checkout->>'mental_focus')::integer,
      motivation=(p_checkout->>'motivation')::integer, movement_changed=(p_checkout->>'movement_changed')::boolean,
      new_pain=(p_checkout->>'new_pain')::boolean, notes=coalesce(p_checkout->>'notes',''), pain_change=p_checkout->>'pain_change',
      pain_details=coalesce(p_checkout->'pain_details','{}'::jsonb), pain_map=coalesce(p_checkout->'pain_map','{}'::jsonb),
      participation=p_checkout->>'participation', planned_load=p_checkout->>'planned_load', planned_minutes=(p_checkout->>'planned_minutes')::integer,
      planned_type=p_checkout->>'planned_type', post_fatigue=(p_checkout->>'post_fatigue')::integer,
      post_soreness=(p_checkout->>'post_soreness')::integer, performance_rating=p_checkout->>'performance_rating',
      recommendation_json=p_checkout->'recommendation_json', schedule_event_id=(p_checkout->>'schedule_event_id')::uuid,
      session_content=coalesce(p_checkout->'session_content','[]'::jsonb), session_date=(p_checkout->>'session_date')::date,
      session_load=(p_checkout->>'session_load')::numeric, session_title=p_checkout->>'session_title', updated_at=now()
    where id=p_checkout_id and user_id=current_user_id returning * into saved;
    delete from public.pain_reports where user_id=current_user_id and source_type='checkout' and source_id=p_checkout_id;
  end if;

  insert into public.pain_reports (user_id, source_type, source_id, report_date, body_part, side, severity, trigger_movement, notes)
  select current_user_id, 'checkout', saved.id, x.report_date, x.body_part, x.side, x.severity, x.trigger_movement, x.notes
  from jsonb_to_recordset(coalesce(p_pain_reports, '[]'::jsonb)) as x(report_date date, body_part text, side text, severity integer, trigger_movement text, notes text);
  return jsonb_build_object('record', to_jsonb(saved), 'painReports', coalesce((select jsonb_agg(to_jsonb(p)) from public.pain_reports p where p.user_id=current_user_id and p.source_type='checkout' and p.source_id=saved.id), '[]'::jsonb));
end;
$$;

revoke all on function public.save_checkin_with_pain_reports(jsonb,jsonb,uuid) from public;
revoke all on function public.save_checkout_with_pain_reports(jsonb,jsonb,uuid) from public;
grant execute on function public.save_checkin_with_pain_reports(jsonb,jsonb,uuid) to authenticated;
grant execute on function public.save_checkout_with_pain_reports(jsonb,jsonb,uuid) to authenticated;
