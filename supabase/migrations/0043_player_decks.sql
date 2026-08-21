-- Saved decks (PL-3). A player usually plays a handful of archetype combos
-- (e.g. Dragapult + Dudunsparce); this table remembers them per account and
-- per game so the picker can offer them as one-tap chips and prefill the most
-- recent one. Every self-submitted pair is saved automatically from the
-- set_participant_archetypes / set_event_archetypes RPCs; the admin RPCs don't
-- touch it. Decks are a convenience list only — deleting one never changes
-- session/event history.
--
-- Keyed by auth user (not player) so a player merge / claim approval never has
-- to carry rows across: the surviving player keeps the login, and the decks
-- follow the login.

create table if not exists public.player_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('tcg', 'vgc')),
  archetype1 text not null check (archetype1 <> ''),
  archetype2 text check (archetype2 is null or archetype2 <> ''),
  -- Unordered pair: Dragapult + Dudunsparce and Dudunsparce + Dragapult are
  -- the same deck. Display keeps the order the player used.
  pair_key text generated always as (
    least(archetype1, coalesce(archetype2, '')) || '|' ||
    greatest(archetype1, coalesce(archetype2, ''))
  ) stored,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, game, pair_key)
);
alter table public.player_decks enable row level security;

create policy "player_decks_select_own" on public.player_decks
  for select using (user_id = auth.uid());
grant select on public.player_decks to authenticated;

-- Upsert a pair for the caller and bump last_used_at. Empty strings are
-- treated as "no pick"; a lone second slot is moved to the first. Returns the
-- deck id, or null when both slots are empty (nothing to save).
create or replace function public.save_player_deck(
  p_game text, p_a1 text, p_a2 text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_a1 text; v_a2 text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;

  v_a1 := nullif(trim(coalesce(p_a1, '')), '');
  v_a2 := nullif(trim(coalesce(p_a2, '')), '');
  if v_a1 is null then v_a1 := v_a2; v_a2 := null; end if;
  if v_a1 is null then return null; end if;
  if v_a1 = v_a2 then v_a2 := null; end if;

  insert into public.player_decks (user_id, game, archetype1, archetype2)
    values (auth.uid(), p_game, v_a1, v_a2)
    on conflict (user_id, game, pair_key)
    do update set last_used_at = now()
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_player_deck(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.player_decks where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Deck not found'; end if;
end; $$;

grant execute on function public.save_player_deck(text, text, text) to authenticated;
grant execute on function public.delete_player_deck(uuid) to authenticated;

-- Self RPC for sessions (0008 → 0034): same lock rules, plus auto-save of the
-- submitted pair as a deck of the league's game.
create or replace function public.set_participant_archetypes(
  p_session uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text; v_a1 text; v_a2 text; v_game text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;

  select s.status, sp.archetype1, sp.archetype2, l.game
    into v_status, v_a1, v_a2, v_game
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
    join public.leagues l on l.id = s.league_id
    where sp.session_id = p_session and sp.player_id = v_player;
  if not found then raise exception 'You are not in this session'; end if;

  if v_status = 'complete' and (v_a1 is not null or v_a2 is not null) then
    raise exception 'Session is complete; archetype is locked';
  end if;

  update public.session_participants
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where session_id = p_session and player_id = v_player;

  perform public.save_player_deck(v_game, p_a1, p_a2);
end; $$;

-- Self RPC for events (0036): same lock rules, plus auto-save of the pair as a
-- deck of the event's game.
create or replace function public.set_event_archetypes(
  p_event uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text; v_a1 text; v_a2 text; v_game text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;

  select e.status, er.archetype1, er.archetype2, e.game
    into v_status, v_a1, v_a2, v_game
    from public.event_registrations er
    join public.events e on e.id = er.event_id
    where er.event_id = p_event and er.player_id = v_player;
  if not found then raise exception 'You are not registered for this event'; end if;

  if v_status = 'complete' and (v_a1 is not null or v_a2 is not null) then
    raise exception 'Event is complete; archetype is locked';
  end if;

  update public.event_registrations
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where event_id = p_event and player_id = v_player;

  perform public.save_player_deck(v_game, p_a1, p_a2);
end; $$;