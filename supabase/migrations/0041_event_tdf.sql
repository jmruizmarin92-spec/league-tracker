-- TOM (.tdf) import for standalone events: the TO drops the file the official
-- Tournament Operations Manager writes and the site shows the pairings back to
-- the players.
--
-- TOM stays the source of truth. Everything here is a mirror of what the file
-- said: `official_result` only ever changes on import, and what a player taps
-- on their phone lands in `reported_result` as a signal for the judge to key
-- into TOM. The two never fight.
--
-- Sessions keep their own `rounds`/`matches` tables (Swiss paired in-app). This
-- is a separate, imported world with its own shape (age divisions, finals
-- pods), so it gets its own tables rather than bending the session ones.

-- Which TDF `userid` (Pokémon ID) is which player, for this event. Filled by
-- the import's review step, then reused on every later re-import.
create table if not exists public.event_tdf_players (
  event_id uuid not null references public.events (id) on delete cascade,
  tdf_userid text not null,
  player_id uuid not null references public.players (id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  primary key (event_id, tdf_userid)
);
alter table public.event_tdf_players enable row level security;

-- `division` is the pod's category (0 Junior / 1 Senior / 2 Master). Round
-- numbering is continuous across the swiss and the top cut within a division
-- (a 4-round swiss plus a top 4 runs 1..6), so (event, division, number) is the
-- round's identity across re-imports. Deliberately NOT keyed on the pod's
-- `stage`: TOM flips it from 0 to 1 when the cut starts, which would make every
-- earlier round reappear as a duplicate.
create table if not exists public.event_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  division integer not null default 0,
  number integer not null,
  is_finals boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, division, number)
);
alter table public.event_rounds enable row level security;

create table if not exists public.event_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  round_id uuid not null references public.event_rounds (id) on delete cascade,
  -- Sorted pair of TDF userids ("100~200", or "100~bye"): stable even if TOM
  -- swaps player 1 and player 2 between exports, so a re-import updates the
  -- row it already created instead of duplicating the pairing.
  pair_key text not null,
  table_number integer,
  player1_id uuid not null references public.players (id) on delete cascade,
  player2_id uuid references public.players (id) on delete cascade, -- null = bye
  official_result text not null default 'pending'
    check (official_result in ('pending', 'p1_win', 'p2_win', 'draw', 'double_loss', 'bye')),
  -- Raw TOM outcome code, kept so an unmapped one is inspectable instead of
  -- lost (it shows as pending in the UI).
  official_code integer,
  -- What the players said, for the judge to key into TOM. Never authoritative.
  reported_result text check (reported_result in ('p1_win', 'p2_win', 'draw')),
  reported_by uuid references auth.users (id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, pair_key)
);
alter table public.event_matches enable row level security;

create index if not exists event_matches_event_idx on public.event_matches (event_id);

-- Final placings, as TOM computed them. Only present once the TO closes the
-- tournament (the file grows a <standings> block), and worth much more than
-- anything we could recompute: it is the official answer, full tiebreaker
-- chain included.
create table if not exists public.event_standings (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  division integer not null default 0,
  place integer not null,
  primary key (event_id, player_id)
);
alter table public.event_standings enable row level security;

-- Audit trail of the uploads themselves (admin-only).
create table if not exists public.event_tdf_imports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  tdf_id text,
  file_name text,
  players_count integer not null default 0,
  rounds_count integer not null default 0,
  matches_count integer not null default 0,
  imported_by uuid references auth.users (id) on delete set null,
  imported_at timestamptz not null default now()
);
alter table public.event_tdf_imports enable row level security;

-- Pairings are what the players came for: world-readable, like session rounds.
create policy "event_rounds_select_all" on public.event_rounds
  for select using (true);
grant select on public.event_rounds to anon, authenticated;

create policy "event_matches_select_all" on public.event_matches
  for select using (true);
grant select on public.event_matches to anon, authenticated;

create policy "event_standings_select_all" on public.event_standings
  for select using (true);
grant select on public.event_standings to anon, authenticated;

-- The ID mapping is not: it pairs a name with a Pokémon ID, which is exactly
-- what the event roster is kept admin-only to avoid. Nothing player-facing
-- reads it — the pairings already carry resolved player ids.
create policy "event_tdf_players_select_admin" on public.event_tdf_players
  for select using (public.is_event_admin(event_id));
grant select on public.event_tdf_players to authenticated;

create policy "event_tdf_imports_select_admin" on public.event_tdf_imports
  for select using (public.is_event_admin(event_id));
grant select on public.event_tdf_imports to authenticated;

-- ---------------------------------------------------------------------------
-- Import.
-- ---------------------------------------------------------------------------

-- Commit one parsed .tdf. Idempotent by design: the TO re-drops the file after
-- pairing each round and this upserts everything the file describes.
--
-- p_players:   [{ userid, first_name, last_name, player_id }] — player_id null
--   means "create a managed player for them" (the review step decided this).
-- p_rounds:    [{ division, number, is_finals, matches:
--                [{ pair_key, table, userid1, userid2, result, code }] }]
-- p_standings: [{ division, userid, place }] — only once TOM closes the event.
create or replace function public.import_event_tdf(
  p_event uuid,
  p_tdf_id text,
  p_file_name text,
  p_players jsonb,
  p_rounds jsonb,
  p_standings jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p jsonb; v_r jsonb; v_m jsonb; v_s jsonb;
  v_player uuid; v_round uuid;
  v_p1 uuid; v_p2 uuid;
  v_keys text[];
  v_name text;
  v_players int := 0; v_rounds int := 0; v_matches int := 0; v_places int := 0;
begin
  if not public.is_event_admin(p_event) then
    raise exception 'Not allowed';
  end if;

  -- 1. Resolve every TDF player to a real player row, remember the mapping and
  --    put them on the roster. Capacity is deliberately ignored: whoever TOM
  --    says is playing is playing, waitlist or not.
  for v_p in select * from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) loop
    v_player := nullif(v_p->>'player_id', '')::uuid;

    if v_player is null then
      v_name := nullif(
        trim(concat_ws(' ', nullif(v_p->>'first_name', ''), nullif(v_p->>'last_name', ''))),
        ''
      );
      insert into public.players (display_name, first_name, last_name, pokemon_id, created_by)
      values (
        coalesce(v_name, 'Jugador ' || (v_p->>'userid')),
        nullif(v_p->>'first_name', ''),
        nullif(v_p->>'last_name', ''),
        nullif(v_p->>'userid', ''),
        auth.uid()
      )
      returning id into v_player;
    end if;

    insert into public.event_tdf_players
      (event_id, tdf_userid, player_id, first_name, last_name)
    values (
      p_event, v_p->>'userid', v_player,
      nullif(v_p->>'first_name', ''), nullif(v_p->>'last_name', '')
    )
    on conflict (event_id, tdf_userid) do update
      set player_id = excluded.player_id,
          first_name = excluded.first_name,
          last_name = excluded.last_name;

    insert into public.event_registrations (event_id, player_id)
    values (p_event, v_player)
    on conflict (event_id, player_id) do nothing;

    v_players := v_players + 1;
  end loop;

  -- 2. Rounds and pairings.
  for v_r in select * from jsonb_array_elements(coalesce(p_rounds, '[]'::jsonb)) loop
    insert into public.event_rounds (event_id, division, number, is_finals)
    values (
      p_event,
      coalesce((v_r->>'division')::int, 0),
      (v_r->>'number')::int,
      coalesce((v_r->>'is_finals')::boolean, false)
    )
    on conflict (event_id, division, number) do update
      set is_finals = excluded.is_finals
    returning id into v_round;

    v_rounds := v_rounds + 1;
    v_keys := '{}';

    for v_m in select * from jsonb_array_elements(coalesce(v_r->'matches', '[]'::jsonb)) loop
      select player_id into v_p1 from public.event_tdf_players
        where event_id = p_event and tdf_userid = v_m->>'userid1';
      v_p2 := null;
      if nullif(v_m->>'userid2', '') is not null then
        select player_id into v_p2 from public.event_tdf_players
          where event_id = p_event and tdf_userid = v_m->>'userid2';
      end if;
      -- A pairing we can't resolve to players is skipped rather than guessed.
      if v_p1 is null then continue; end if;

      insert into public.event_matches (
        event_id, round_id, pair_key, table_number,
        player1_id, player2_id, official_result, official_code
      )
      values (
        p_event, v_round, v_m->>'pair_key', nullif(v_m->>'table', '')::int,
        v_p1, v_p2,
        coalesce(nullif(v_m->>'result', ''), 'pending'),
        nullif(v_m->>'code', '')::int
      )
      on conflict (round_id, pair_key) do update
        set table_number = excluded.table_number,
            player1_id = excluded.player1_id,
            player2_id = excluded.player2_id,
            official_result = excluded.official_result,
            official_code = excluded.official_code;

      v_keys := array_append(v_keys, v_m->>'pair_key');
      v_matches := v_matches + 1;
    end loop;

    -- Pairings the file no longer lists were re-paired in TOM: drop them so the
    -- round on screen is exactly the round on the judge's laptop.
    delete from public.event_matches
      where round_id = v_round and not (pair_key = any(v_keys));
  end loop;

  -- 3. Final placings, if the file carries them. Replaced wholesale rather
  --    than merged: a corrected export must be able to take a place away, and
  --    TOM always writes the block complete.
  if jsonb_array_length(coalesce(p_standings, '[]'::jsonb)) > 0 then
    delete from public.event_standings where event_id = p_event;
    for v_s in select * from jsonb_array_elements(p_standings) loop
      select player_id into v_p1 from public.event_tdf_players
        where event_id = p_event and tdf_userid = v_s->>'userid';
      if v_p1 is null then continue; end if;
      insert into public.event_standings (event_id, player_id, division, place)
      values (
        p_event, v_p1,
        coalesce((v_s->>'division')::int, 0),
        (v_s->>'place')::int
      )
      on conflict (event_id, player_id) do update
        set division = excluded.division, place = excluded.place;
      v_places := v_places + 1;
    end loop;
  end if;

  insert into public.event_tdf_imports
    (event_id, tdf_id, file_name, players_count, rounds_count, matches_count, imported_by)
  values (p_event, p_tdf_id, p_file_name, v_players, v_rounds, v_matches, auth.uid());

  return jsonb_build_object(
    'players', v_players, 'rounds', v_rounds,
    'matches', v_matches, 'places', v_places
  );
end; $$;

-- What the players said happened. Stored next to (never over) the official
-- result; the next import overwrites nothing here.
create or replace function public.report_event_match(p_match uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_p1 uuid; v_p2 uuid; v_me uuid;
begin
  if p_result not in ('p1_win', 'p2_win', 'draw') then
    raise exception 'Invalid result';
  end if;
  select event_id, player1_id, player2_id into v_event, v_p1, v_p2
  from public.event_matches where id = p_match;
  if v_event is null then raise exception 'Match not found'; end if;
  if v_p2 is null then raise exception 'Nothing to report'; end if;

  select id into v_me from public.players where user_id = auth.uid();
  if not (public.is_event_admin(v_event) or v_me = v_p1 or v_me = v_p2) then
    raise exception 'Not allowed';
  end if;

  update public.event_matches
    set reported_result = p_result, reported_by = auth.uid(), reported_at = now()
  where id = p_match;
end; $$;

-- Undo a bad import: drops the imported rounds, pairings and ID mapping. The
-- players it created and the roster entries stay — they may have archetypes or
-- lists attached by now, and dropping those would lose real work.
create or replace function public.clear_event_tdf(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then
    raise exception 'Not allowed';
  end if;
  delete from public.event_rounds where event_id = p_event;
  delete from public.event_standings where event_id = p_event;
  delete from public.event_tdf_players where event_id = p_event;
  delete from public.event_tdf_imports where event_id = p_event;
end; $$;

grant execute on function public.import_event_tdf(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.report_event_match(uuid, text) to authenticated;
grant execute on function public.clear_event_tdf(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime, so a re-import lands on every phone in the room without a reload.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'event_matches'
  ) then
    alter publication supabase_realtime add table public.event_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'event_rounds'
  ) then
    alter publication supabase_realtime add table public.event_rounds;
  end if;
end $$;

-- Carry imported pairings and ID mappings through a player merge. Same body as
-- 0029, with event_matches / event_tdf_players added — both FKs cascade, so
-- without this a merge would silently delete the source's imported history.
create or replace function public.merge_players(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_from_user uuid;
  v_into_user uuid;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if p_from = p_into then raise exception 'Cannot merge a player into itself'; end if;
  if not exists (select 1 from public.players where id = p_from) then
    raise exception 'Source player not found';
  end if;
  if not exists (select 1 from public.players where id = p_into) then
    raise exception 'Target player not found';
  end if;

  select user_id into v_from_user from public.players where id = p_from;
  select user_id into v_into_user from public.players where id = p_into;
  if v_into_user is null and v_from_user is not null then
    update public.players set user_id = null where id = p_from;
    update public.players set user_id = v_from_user where id = p_into;
  end if;

  -- No per-player uniqueness on either match table: straight repoint.
  update public.matches set player1_id = p_into where player1_id = p_from;
  update public.matches set player2_id = p_into where player2_id = p_from;
  update public.event_matches set player1_id = p_into where player1_id = p_from;
  update public.event_matches set player2_id = p_into where player2_id = p_from;

  -- event_tdf_players is keyed by (event_id, tdf_userid), so player_id moves
  -- freely; two userids pointing at the same player is legitimate (a duplicate
  -- entry in TOM that we merged here).
  update public.event_tdf_players set player_id = p_into where player_id = p_from;

  update public.session_participants sp set player_id = p_into
    where sp.player_id = p_from
      and not exists (
        select 1 from public.session_participants t
        where t.session_id = sp.session_id and t.player_id = p_into);
  delete from public.session_participants where player_id = p_from;

  update public.event_registrations er set player_id = p_into
    where er.player_id = p_from
      and not exists (
        select 1 from public.event_registrations t
        where t.event_id = er.event_id and t.player_id = p_into);
  delete from public.event_registrations where player_id = p_from;

  update public.event_lists el set player_id = p_into
    where el.player_id = p_from
      and not exists (
        select 1 from public.event_lists t
        where t.event_id = el.event_id and t.player_id = p_into);
  delete from public.event_lists where player_id = p_from;

  update public.event_staff es set player_id = p_into
    where es.player_id = p_from
      and not exists (
        select 1 from public.event_staff t
        where t.event_id = es.event_id and t.player_id = p_into);
  delete from public.event_staff where player_id = p_from;

  update public.player_claims pc set player_id = p_into
    where pc.player_id = p_from
      and not (pc.status = 'pending' and exists (
        select 1 from public.player_claims t
        where t.player_id = p_into and t.requested_by = pc.requested_by
          and t.status = 'pending'));
  delete from public.player_claims where player_id = p_from;

  delete from public.players where id = p_from;
end; $$;
