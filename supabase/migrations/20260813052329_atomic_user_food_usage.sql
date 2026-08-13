create or replace function public.record_user_food_usage(
  p_source_key text,
  p_food_json jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_source_key), '') is null then
    raise exception 'A food source key is required';
  end if;

  insert into public.user_food_usage (
    user_id,
    source_key,
    food_json,
    selection_count,
    first_selected_at,
    last_selected_at
  ) values (
    (select auth.uid()),
    trim(p_source_key),
    coalesce(p_food_json, '{}'::jsonb),
    1,
    now(),
    now()
  )
  on conflict (user_id, source_key) do update
    set food_json = excluded.food_json,
        selection_count = public.user_food_usage.selection_count + 1,
        last_selected_at = now();
end;
$$;

revoke all on function public.record_user_food_usage(text, jsonb) from public, anon;
grant execute on function public.record_user_food_usage(text, jsonb) to authenticated;

comment on function public.record_user_food_usage(text, jsonb) is
  'Atomically records private per-athlete food selection frequency using caller RLS.';
