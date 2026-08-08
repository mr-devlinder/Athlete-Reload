create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  terms_version text not null,
  privacy_version text not null,
  categories text[] not null,
  age_16_or_older_confirmed boolean not null,
  accepted_at timestamptz not null default now(),
  source text not null check (source in ('password_signup', 'oauth_signup')),
  unique (user_id, policy_version)
);

alter table public.legal_consents enable row level security;

create policy "Users can read own legal consents"
on public.legal_consents for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.legal_consents to authenticated;
revoke insert, update, delete on public.legal_consents from anon, authenticated;

create or replace function public.record_legal_consent(
  p_policy_version text,
  p_terms_version text,
  p_privacy_version text,
  p_categories text[],
  p_age_16_or_older_confirmed boolean,
  p_source text
)
returns public.legal_consents
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent public.legal_consents;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_age_16_or_older_confirmed is not true then raise exception 'Age confirmation required'; end if;
  if p_policy_version = '' or p_terms_version = '' or p_privacy_version = '' then
    raise exception 'Policy versions are required';
  end if;
  if p_source not in ('password_signup', 'oauth_signup') then raise exception 'Invalid consent source'; end if;
  if not (p_categories @> array['terms', 'privacy', 'sensitive_wellness_data']) then
    raise exception 'Required consent categories are missing';
  end if;

  insert into public.legal_consents (
    user_id, policy_version, terms_version, privacy_version, categories,
    age_16_or_older_confirmed, source
  ) values (
    auth.uid(), p_policy_version, p_terms_version, p_privacy_version, p_categories,
    true, p_source
  )
  on conflict (user_id, policy_version) do nothing
  returning * into consent;

  if consent.id is null then
    select * into consent from public.legal_consents
    where user_id = auth.uid() and policy_version = p_policy_version;
  end if;
  return consent;
end;
$$;

revoke all on function public.record_legal_consent(text, text, text, text[], boolean, text) from public, anon;
grant execute on function public.record_legal_consent(text, text, text, text[], boolean, text) to authenticated;

create or replace function public.save_tournament_with_games(p_tournament jsonb, p_games jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  tournament_row public.tournaments;
  game jsonb;
  game_row public.schedule_events;
  saved_games jsonb := '[]'::jsonb;
  incoming_ids uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if nullif(p_tournament->>'id', '') is null then
    insert into public.tournaments (user_id, name, association, start_date, end_date, location, notes, updated_at)
    values (auth.uid(), p_tournament->>'name', coalesce(p_tournament->>'association', 'Personal'),
      (p_tournament->>'start_date')::date, (p_tournament->>'end_date')::date,
      coalesce(p_tournament->>'location', ''), coalesce(p_tournament->>'notes', ''), now())
    returning * into tournament_row;
  else
    update public.tournaments set
      name = p_tournament->>'name', association = coalesce(p_tournament->>'association', 'Personal'),
      start_date = (p_tournament->>'start_date')::date, end_date = (p_tournament->>'end_date')::date,
      location = coalesce(p_tournament->>'location', ''), notes = coalesce(p_tournament->>'notes', ''), updated_at = now()
    where id = (p_tournament->>'id')::uuid and user_id = auth.uid()
    returning * into tournament_row;
    if tournament_row.id is null then raise exception 'Tournament not found'; end if;
  end if;

  for game in select value from jsonb_array_elements(coalesce(p_games, '[]'::jsonb)) loop
    if nullif(game->>'id', '') is not null then
      incoming_ids := array_append(incoming_ids, (game->>'id')::uuid);
      update public.schedule_events set
        event_date = (game->>'event_date')::date, title = coalesce(game->>'title', 'Game'), event_type = 'Game',
        load_level = coalesce(game->>'load_level', 'High'), event_time = coalesce(game->>'event_time', ''),
        note = coalesce(game->>'note', ''), availability = coalesce(game->>'availability', 'Required'),
        opponent = coalesce(game->>'opponent', ''), venue = coalesce(game->>'venue', ''),
        association = coalesce(game->>'association', 'Personal'), expected_duration = coalesce((game->>'expected_duration')::integer, 60),
        surface = coalesce(game->>'surface', 'Grass'), environment = coalesce(game->>'environment', 'Outdoor'),
        location = coalesce(game->>'location', ''), planned_minutes = nullif(game->>'planned_minutes', '')::integer,
        tournament_id = tournament_row.id, sport_workload = coalesce(game->'sport_workload', '{}'::jsonb), updated_at = now()
      where id = (game->>'id')::uuid and user_id = auth.uid() and tournament_id = tournament_row.id
      returning * into game_row;
      if game_row.id is null then raise exception 'Tournament game not found'; end if;
    else
      insert into public.schedule_events (
        user_id, event_date, title, event_type, load_level, event_time, note, availability, opponent, venue,
        association, expected_duration, surface, environment, location, planned_minutes, tournament_id, sport_workload, updated_at
      ) values (
        auth.uid(), (game->>'event_date')::date, coalesce(game->>'title', 'Game'), 'Game', coalesce(game->>'load_level', 'High'),
        coalesce(game->>'event_time', ''), coalesce(game->>'note', ''), coalesce(game->>'availability', 'Required'),
        coalesce(game->>'opponent', ''), coalesce(game->>'venue', ''), coalesce(game->>'association', 'Personal'),
        coalesce((game->>'expected_duration')::integer, 60), coalesce(game->>'surface', 'Grass'),
        coalesce(game->>'environment', 'Outdoor'), coalesce(game->>'location', ''), nullif(game->>'planned_minutes', '')::integer,
        tournament_row.id, coalesce(game->'sport_workload', '{}'::jsonb), now()
      ) returning * into game_row;
      incoming_ids := array_append(incoming_ids, game_row.id);
    end if;
    saved_games := saved_games || to_jsonb(game_row);
  end loop;

  delete from public.pain_reports where user_id = auth.uid() and (
    (source_type = 'check_in' and source_id in (
      select id from public.check_ins where user_id = auth.uid() and schedule_event_id in (
        select id from public.schedule_events where user_id = auth.uid() and tournament_id = tournament_row.id and not (id = any(incoming_ids))
      )
    )) or
    (source_type = 'checkout' and source_id in (
      select id from public.training_checkouts where user_id = auth.uid() and schedule_event_id in (
        select id from public.schedule_events where user_id = auth.uid() and tournament_id = tournament_row.id and not (id = any(incoming_ids))
      )
    ))
  );
  delete from public.check_ins where user_id = auth.uid() and schedule_event_id in (
    select id from public.schedule_events where user_id = auth.uid() and tournament_id = tournament_row.id and not (id = any(incoming_ids))
  );
  delete from public.training_checkouts where user_id = auth.uid() and schedule_event_id in (
    select id from public.schedule_events where user_id = auth.uid() and tournament_id = tournament_row.id and not (id = any(incoming_ids))
  );
  delete from public.schedule_events
  where user_id = auth.uid() and tournament_id = tournament_row.id
    and not (id = any(incoming_ids));

  return jsonb_build_object('tournament', to_jsonb(tournament_row), 'games', saved_games);
end;
$$;

create or replace function public.delete_tournament_with_games(p_tournament_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.pain_reports where user_id = auth.uid() and (
    (source_type = 'check_in' and source_id in (
      select id from public.check_ins where user_id = auth.uid() and schedule_event_id in (
        select id from public.schedule_events where tournament_id = p_tournament_id and user_id = auth.uid()
      )
    )) or
    (source_type = 'checkout' and source_id in (
      select id from public.training_checkouts where user_id = auth.uid() and schedule_event_id in (
        select id from public.schedule_events where tournament_id = p_tournament_id and user_id = auth.uid()
      )
    ))
  );
  delete from public.check_ins where user_id = auth.uid() and schedule_event_id in (
    select id from public.schedule_events where tournament_id = p_tournament_id and user_id = auth.uid()
  );
  delete from public.training_checkouts where user_id = auth.uid() and schedule_event_id in (
    select id from public.schedule_events where tournament_id = p_tournament_id and user_id = auth.uid()
  );
  delete from public.schedule_events where tournament_id = p_tournament_id and user_id = auth.uid();
  delete from public.tournaments where id = p_tournament_id and user_id = auth.uid();
end;
$$;

revoke all on function public.save_tournament_with_games(jsonb, jsonb) from public, anon;
revoke all on function public.delete_tournament_with_games(uuid) from public, anon;
grant execute on function public.save_tournament_with_games(jsonb, jsonb) to authenticated;
grant execute on function public.delete_tournament_with_games(uuid) to authenticated;

create table if not exists public.ai_request_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_request_windows enable row level security;
revoke all on public.ai_request_windows from anon, authenticated;
create policy "AI request windows are RPC-only"
on public.ai_request_windows as restrictive for all to authenticated
using (false) with check (false);

create or replace function public.consume_ai_request(p_limit integer default 3, p_window_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_limit < 1 or p_limit > 20 or p_window_seconds < 10 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.ai_request_windows (user_id, window_started_at, request_count, updated_at)
  values (auth.uid(), now(), 1, now())
  on conflict (user_id) do update set
    window_started_at = case
      when public.ai_request_windows.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.ai_request_windows.window_started_at
    end,
    request_count = case
      when public.ai_request_windows.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.ai_request_windows.request_count + 1
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_ai_request(integer, integer) from public, anon;
grant execute on function public.consume_ai_request(integer, integer) to authenticated;

create or replace function public.clear_complete_health_data()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.recovery_routine_completions where user_id = auth.uid();
  delete from public.saved_recovery_routines where user_id = auth.uid();
  delete from public.pain_reports where user_id = auth.uid();
  delete from public.pain_issues where user_id = auth.uid();
  delete from public.training_checkouts where user_id = auth.uid();
  delete from public.check_ins where user_id = auth.uid();
  delete from public.daily_wellness where user_id = auth.uid();
  delete from public.voice_logs where user_id = auth.uid();
end;
$$;

revoke all on function public.clear_complete_health_data() from public, anon;
grant execute on function public.clear_complete_health_data() to authenticated;

create or replace function public.prevent_legal_consent_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Legal consent records are append-only';
end;
$$;

create trigger legal_consents_append_only
before update or delete on public.legal_consents
for each row execute function public.prevent_legal_consent_changes();
