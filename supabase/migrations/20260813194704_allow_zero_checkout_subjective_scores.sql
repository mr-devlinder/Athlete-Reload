alter table public.training_checkouts
  drop constraint if exists training_checkouts_post_fatigue_check,
  drop constraint if exists training_checkouts_post_soreness_check;

alter table public.training_checkouts
  add constraint training_checkouts_post_fatigue_check
    check (post_fatigue between 0 and 5),
  add constraint training_checkouts_post_soreness_check
    check (post_soreness between 0 and 5);

comment on column public.training_checkouts.post_fatigue is
  'Optional 0-5 athlete report; NULL means not asked or unknown.';

comment on column public.training_checkouts.post_soreness is
  'Optional 0-5 athlete report; NULL means not asked or unknown.';
