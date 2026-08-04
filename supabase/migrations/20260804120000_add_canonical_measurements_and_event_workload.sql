alter table public.athlete_profiles
  add column if not exists unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;

update public.athlete_profiles
set height_cm = height_inches * 2.54
where height_cm is null and height_inches is not null;

update public.athlete_profiles
set weight_kg = weight_lbs * 0.45359237
where weight_kg is null and weight_lbs is not null;

alter table public.daily_wellness add column if not exists hydration_ml numeric;
update public.daily_wellness set hydration_ml = hydration_oz * 29.5735295625 where hydration_ml is null;
alter table public.daily_wellness alter column hydration_ml set default 0;
alter table public.daily_wellness alter column hydration_ml set not null;

alter table public.check_ins add column if not exists hydration_ml numeric;
update public.check_ins set hydration_ml = hydration_oz * 29.5735295625 where hydration_ml is null;
alter table public.check_ins alter column hydration_ml set default 0;
alter table public.check_ins alter column hydration_ml set not null;

alter table public.schedule_events add column if not exists sport_workload jsonb not null default '{}'::jsonb;

delete from public.pain_reports
where source_type = 'checkout' and source_id in (
  select id from (
    select id, row_number() over (partition by user_id, schedule_event_id order by updated_at desc nulls last, created_at desc, id desc) as duplicate_rank
    from public.training_checkouts where schedule_event_id is not null
  ) ranked where duplicate_rank > 1
);

with ranked as (
  select id, row_number() over (partition by user_id, schedule_event_id order by updated_at desc nulls last, created_at desc, id desc) as duplicate_rank
  from public.training_checkouts
  where schedule_event_id is not null
)
delete from public.training_checkouts where id in (select id from ranked where duplicate_rank > 1);

delete from public.pain_reports
where source_type = 'check_in' and source_id in (
  select id from (
    select id, row_number() over (partition by user_id, schedule_event_id order by created_at desc, id desc) as duplicate_rank
    from public.check_ins where schedule_event_id is not null
  ) ranked where duplicate_rank > 1
);

with ranked as (
  select id, row_number() over (partition by user_id, schedule_event_id order by created_at desc, id desc) as duplicate_rank
  from public.check_ins
  where schedule_event_id is not null
)
delete from public.check_ins where id in (select id from ranked where duplicate_rank > 1);

create unique index if not exists check_ins_one_per_event_idx
  on public.check_ins(user_id, schedule_event_id)
  where schedule_event_id is not null;

create unique index if not exists training_checkouts_one_per_event_idx
  on public.training_checkouts(user_id, schedule_event_id)
  where schedule_event_id is not null;
