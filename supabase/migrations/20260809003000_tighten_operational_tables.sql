create index if not exists operational_events_user_id_idx
  on public.operational_events (user_id);

drop policy if exists "Operational events are RPC-only" on public.operational_events;
create policy "Operational events are RPC-only"
on public.operational_events as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "External food usage is service-only" on public.external_food_usage;
create policy "External food usage is service-only"
on public.external_food_usage as restrictive for all to authenticated
using (false) with check (false);
