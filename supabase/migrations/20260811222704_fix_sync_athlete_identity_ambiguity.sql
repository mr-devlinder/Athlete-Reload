-- Avoid a PL/pgSQL variable/column collision when an athlete profile is updated.
create or replace function private.sync_athlete_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid;
begin
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) then
    raise exception 'Profile ownership mismatch';
  end if;

  insert into public.athletes (owner_user_id, display_name)
  values (new.user_id, new.display_name)
  on conflict (owner_user_id) do update
    set display_name = excluded.display_name,
        updated_at = now()
  returning id into v_athlete_id;

  insert into public.athlete_memberships (athlete_id, user_id, relationship_role)
  values (v_athlete_id, new.user_id, 'athlete')
  on conflict (athlete_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.sync_athlete_identity() from public, anon, authenticated;
