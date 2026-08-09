alter table public.privacy_preferences
  add column if not exists display_preferences jsonb not null default '{"defaultView":"Home","density":"comfortable","showNutritionTargets":true,"startupMotion":"full","unitSystem":"imperial","weekStartsOn":1}'::jsonb;

alter table public.privacy_preferences
  drop constraint if exists privacy_preferences_display_preferences_object;

alter table public.privacy_preferences
  add constraint privacy_preferences_display_preferences_object
  check (jsonb_typeof(display_preferences) = 'object');
