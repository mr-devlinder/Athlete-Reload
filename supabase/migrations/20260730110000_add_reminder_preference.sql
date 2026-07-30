alter table public.privacy_preferences
  add column if not exists reminders_enabled boolean not null default false;
