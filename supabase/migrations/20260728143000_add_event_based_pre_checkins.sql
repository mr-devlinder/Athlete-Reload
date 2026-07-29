alter table public.check_ins
  add column if not exists schedule_event_id uuid references public.schedule_events(id) on delete set null,
  add column if not exists check_in_type text not null default 'pre_event',
  add column if not exists planned_intensity text not null default 'Medium',
  add column if not exists session_title text not null default 'Training',
  add column if not exists event_time text not null default '',
  add column if not exists recommendation_json jsonb;

create index if not exists check_ins_event_idx
  on public.check_ins(schedule_event_id);

create index if not exists check_ins_user_event_idx
  on public.check_ins(user_id, schedule_event_id, created_at desc);

drop policy if exists "Users can update own check ins" on public.check_ins;
create policy "Users can update own check ins"
on public.check_ins for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
