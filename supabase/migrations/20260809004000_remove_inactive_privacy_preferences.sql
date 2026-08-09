alter table public.privacy_preferences
  drop column if exists analytics_allowed,
  drop column if exists cloud_sync,
  drop column if exists coach_include_notes,
  drop column if exists coach_include_pain,
  drop column if exists coach_include_nutrition,
  drop column if exists local_copy;
