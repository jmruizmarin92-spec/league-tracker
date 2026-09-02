-- Guest decklists on standalone events (PL-19). A visitor without an account
-- can hand in a list for an event that opts in (`events.allow_guest_lists`),
-- giving their full name and Pokémon Player ID. Nothing new is invented for
-- the roster: the guest becomes (or reuses) an unclaimed managed player,
-- gets a normal event_registrations row and a normal event_lists row, so the
-- TO sees them like anyone else, capacity/waitlist applies, the .tdf import
-- matches them by ID/name (0041) and the person can claim the player later.
--
-- What is new is the edit handle. A guest has no auth.uid(), so the submit
-- RPC returns a random token; only its sha256 is kept in event_guest_entries,
-- a table nobody can read through PostgREST (RLS on, no policies, no grants).
-- Presenting the token lets that browser (cookie) or that link read and
-- rewrite its own list until the entry deadline. Typing the same name/ID
-- again does NOT overwrite anything: a second submission for an ID that is
-- already registered is refused, and an ID that belongs to a player with an
-- account is refused too (they log in and use the normal form).

alter table public.events
  add column if not exists allow_guest_lists boolean not null default false;

create table if not exists public.event_guest_entries (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
alter table public.event_guest_entries enable row level security;
-- Deliberately no policies and no grants: reachable only through the
-- security definer functions below.

-- ---------------------------------------------------------------------------
-- create_event gains p_allow_guest_lists; drop+recreate (builds on 0046's
-- 17-arg version, body identical plus the flag).
-- ---------------------------------------------------------------------------
drop function if exists public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int,
  text, text, int, uuid, text, text, uuid
);

create function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null,
  p_subtitle text default null, p_list_lock_minutes int default 60,
  p_league_id uuid default null, p_tournament_id text default null,
  p_status text default 'open', p_store_id uuid default null,
  p_allow_guest_lists boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
  v_tournament text; v_status text;
begin
  if not (
    public.is_site_admin()
    or (p_store_id is not null and public.is_store_admin(p_store_id))
  ) then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;
  if p_category is not null and p_category not in ('cup', 'challenge', 'demo', 'prerelease', 'others') then
    raise exception 'Invalid category';
  end if;
  v_status := coalesce(p_status, 'open');
  if v_status not in ('open', 'closed', 'complete') then
    raise exception 'Invalid status';
  end if;
  if p_league_id is not null
     and not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'Unknown league';
  end if;
  if p_store_id is not null
     and not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Unknown store';
  end if;
  v_tournament := nullif(trim(coalesce(p_tournament_id, '')), '');
  if v_tournament is not null
     and exists (select 1 from public.events where tournament_id = v_tournament) then
    raise exception 'An event with tournament id % already exists', v_tournament;
  end if;

  v_base := public.slugify(p_name); v_slug := v_base;
  while exists (select 1 from public.events where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.events (
    name, slug, game, starts_at, location, cost, description,
    external_url, prizes, list_required, capacity, category, subtitle,
    list_lock_minutes, league_id, tournament_id, status, store_id,
    allow_guest_lists, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category,
    nullif(trim(coalesce(p_subtitle, '')), ''),
    coalesce(p_list_lock_minutes, 60), p_league_id, v_tournament, v_status,
    p_store_id, coalesce(p_allow_guest_lists, false), auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

grant execute on function public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int,
  text, text, int, uuid, text, text, uuid, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- Guest RPCs. All callable by anon.
-- ---------------------------------------------------------------------------

-- sha256 hex of the presented token; the only thing ever stored.
create or replace function public.guest_token_hash(p_token text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_token, 'utf8')), 'hex');
$$;

-- Hand in a list as a guest. Returns the edit token (shown once, kept by the
-- caller in a cookie / link).
create or replace function public.guest_submit_event_list(
  p_event uuid, p_name text, p_pokemon_id text, p_content text, p_url text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_event record;
  v_name text;
  v_pid text;
  v_player uuid;
  v_player_user uuid;
  v_has_list boolean;
  v_count int;
  v_status text;
  v_token text;
begin
  select * into v_event from public.events where id = p_event;
  if not found then raise exception 'Unknown event'; end if;
  if not v_event.allow_guest_lists then
    raise exception 'Guest lists are not enabled for this event';
  end if;
  if v_event.status <> 'open' then raise exception 'Registration is closed'; end if;
  if public.event_entry_locked(p_event) then
    raise exception 'The entry deadline has passed';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then raise exception 'Name required'; end if;
  v_pid := regexp_replace(coalesce(p_pokemon_id, ''), '\s', '', 'g');
  if v_pid !~ '^[0-9]{1,10}$' then raise exception 'Invalid Pokémon ID'; end if;

  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';
  if not v_has_list then raise exception 'A list is required'; end if;

  -- One person per Pokémon ID. Oldest row wins if the ID was ever duplicated.
  select id, user_id into v_player, v_player_user
    from public.players where pokemon_id = v_pid
    order by created_at asc limit 1;
  if v_player is not null then
    if v_player_user is not null then
      raise exception 'This Pokémon ID belongs to a registered user';
    end if;
    if exists (
      select 1 from public.event_registrations
      where event_id = p_event and player_id = v_player
    ) then
      raise exception 'This Pokémon ID is already registered for this event';
    end if;
  else
    insert into public.players (display_name, pokemon_id)
    values (v_name, v_pid)
    returning id into v_player;
  end if;

  if v_event.capacity is null then
    v_status := 'registered';
  else
    select count(*) into v_count from public.event_registrations
      where event_id = p_event and status = 'registered';
    v_status := case when v_count < v_event.capacity then 'registered' else 'waitlisted' end;
  end if;

  insert into public.event_registrations (event_id, player_id, status, has_list)
  values (p_event, v_player, v_status, true);

  insert into public.event_lists (event_id, player_id, content, url)
  values (p_event, v_player, nullif(trim(coalesce(p_content, '')), ''),
          nullif(trim(coalesce(p_url, '')), ''))
  on conflict (event_id, player_id)
  do update set content = excluded.content, url = excluded.url, submitted_at = now();

  -- Two v4 UUIDs = 64 hex chars / ~244 random bits, core Postgres only (no
  -- pgcrypto dependency under this search_path).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.event_guest_entries (event_id, player_id, token_hash)
  values (p_event, v_player, public.guest_token_hash(v_token))
  on conflict (event_id, player_id)
  do update set token_hash = excluded.token_hash, created_at = now();

  return v_token;
end; $$;

grant execute on function public.guest_submit_event_list(uuid, text, text, text, text)
  to anon, authenticated;

-- What the holder of a token submitted. Empty when the token is unknown or
-- the TO has since removed the registration.
create or replace function public.guest_get_event_entry(p_event uuid, p_token text)
returns table (
  player_id uuid, display_name text, pokemon_id text, status text,
  content text, url text
)
language sql stable security definer set search_path = public as $$
  select r.player_id, p.display_name, p.pokemon_id, r.status, l.content, l.url
    from public.event_guest_entries g
    join public.event_registrations r
      on r.event_id = g.event_id and r.player_id = g.player_id
    join public.players p on p.id = g.player_id
    left join public.event_lists l
      on l.event_id = g.event_id and l.player_id = g.player_id
   where g.event_id = p_event
     and g.token_hash = public.guest_token_hash(coalesce(p_token, ''));
$$;

grant execute on function public.guest_get_event_entry(uuid, text) to anon, authenticated;

-- Rewrite the list behind a token, until the deadline.
create or replace function public.guest_update_event_list(
  p_event uuid, p_token text, p_content text, p_url text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_has_list boolean;
begin
  select g.player_id into v_player
    from public.event_guest_entries g
    join public.event_registrations r
      on r.event_id = g.event_id and r.player_id = g.player_id
   where g.event_id = p_event
     and g.token_hash = public.guest_token_hash(coalesce(p_token, ''));
  if v_player is null then raise exception 'Unknown guest entry'; end if;
  if public.event_entry_locked(p_event) then
    raise exception 'The list deadline has passed';
  end if;

  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';
  if not v_has_list then raise exception 'A list is required'; end if;

  insert into public.event_lists (event_id, player_id, content, url)
  values (p_event, v_player, nullif(trim(coalesce(p_content, '')), ''),
          nullif(trim(coalesce(p_url, '')), ''))
  on conflict (event_id, player_id)
  do update set content = excluded.content, url = excluded.url, submitted_at = now();

  update public.event_registrations set has_list = true
    where event_id = p_event and player_id = v_player;
end; $$;

grant execute on function public.guest_update_event_list(uuid, text, text, text)
  to anon, authenticated;
