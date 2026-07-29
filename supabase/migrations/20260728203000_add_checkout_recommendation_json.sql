alter table public.training_checkouts
  add column if not exists recommendation_json jsonb;
