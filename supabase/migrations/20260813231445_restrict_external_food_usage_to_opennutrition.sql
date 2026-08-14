alter table public.external_food_usage
  drop constraint if exists external_food_usage_source_type_check;

alter table public.external_food_usage
  add constraint external_food_usage_source_type_opennutrition_check
  check (source_type = 'opennutrition') not valid;
