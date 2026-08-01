-- Correct only legacy records whose map maximum is exactly ten times the
-- separately stored 0-10 primary pain score.
update public.training_checkouts
set pain_map = (
  select jsonb_object_agg(
    entry.key,
    case
      when jsonb_typeof(entry.value) = 'number'
        then to_jsonb(round((entry.value #>> '{}')::numeric / 10))
      else entry.value
    end
  )
  from jsonb_each(pain_map) as entry
)
where schedule_event_id in (
  select ci.schedule_event_id
  from public.check_ins ci
  where ci.pain > 0
    and ci.pain_map is not null
    and (
      select max((entry.value #>> '{}')::numeric)
      from jsonb_each(ci.pain_map) as entry
    ) = ci.pain * 10
);

update public.pain_reports
set severity = round(severity::numeric / 10)::integer
where severity > 0
  and source_id in (
    select ci.id
    from public.check_ins ci
    where ci.pain > 0
      and ci.pain_map is not null
      and (
        select max((entry.value #>> '{}')::numeric)
        from jsonb_each(ci.pain_map) as entry
      ) = ci.pain * 10
    union
    select tc.id
    from public.training_checkouts tc
    join public.check_ins ci on ci.schedule_event_id = tc.schedule_event_id
    where ci.pain > 0
      and ci.pain_map is not null
      and (
        select max((entry.value #>> '{}')::numeric)
        from jsonb_each(ci.pain_map) as entry
      ) = ci.pain * 10
  );

update public.check_ins
set pain_map = (
  select jsonb_object_agg(
    entry.key,
    case
      when jsonb_typeof(entry.value) = 'number'
        then to_jsonb(round((entry.value #>> '{}')::numeric / 10))
      else entry.value
    end
  )
  from jsonb_each(pain_map) as entry
)
where pain > 0
  and pain_map is not null
  and (
    select max((entry.value #>> '{}')::numeric)
    from jsonb_each(pain_map) as entry
  ) = pain * 10;
