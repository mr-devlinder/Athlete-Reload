-- Optional athlete-reported values must remain unknown when they were not asked.
-- Dropping defaults does not rewrite existing rows; historical default values remain
-- untouched because their provenance cannot be inferred safely.
alter table public.training_checkouts
  alter column post_fatigue drop not null,
  alter column post_fatigue drop default,
  alter column post_soreness drop not null,
  alter column post_soreness drop default,
  alter column mental_focus drop not null,
  alter column mental_focus drop default,
  alter column motivation drop not null,
  alter column motivation drop default;

alter table public.check_ins
  alter column leg_heaviness drop not null,
  alter column leg_heaviness drop default,
  alter column stress drop not null,
  alter column expected_difficulty drop not null,
  alter column expected_difficulty drop default;

comment on column public.training_checkouts.post_fatigue is 'Optional 1-5 athlete report; NULL means not asked or unknown.';
comment on column public.training_checkouts.post_soreness is 'Optional 1-5 athlete report; NULL means not asked or unknown.';
comment on column public.training_checkouts.mental_focus is 'Optional 1-5 athlete report; NULL means not asked or unknown.';
comment on column public.training_checkouts.motivation is 'Optional 1-5 athlete report; NULL means not asked or unknown.';
comment on column public.check_ins.leg_heaviness is 'Optional 1-5 athlete report; NULL means not asked or unknown.';
comment on column public.check_ins.stress is 'Optional 0-5 athlete report stored as text for compatibility; NULL means unknown.';
comment on column public.check_ins.expected_difficulty is 'Optional 1-10 athlete expectation; NULL means unknown.';
