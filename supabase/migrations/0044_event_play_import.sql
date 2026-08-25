-- Play! Pokémon paste import (PL-16). A standalone event can now be created by
-- pasting the tournament's page from the organiser site. Three things needed
-- storing for that:
--
-- * leagues.play_league_id — the League ID the Play! site prints for the
--   store's league (e.g. 6236068). It is how a pasted event finds its league.
-- * events.league_id — the link itself. Optional: events created by hand stay
--   standalone exactly as before. The league going away leaves the event.
-- * events.tournament_id — TOM's tournament id (26-08-001970). Unique when
--   set, so pasting the same page twice is refused instead of duplicated.
--
-- create_event also learns an initial status: a page whose "Status" already
-- reads Complete is a historic record and is created straight into complete.

alter table public.leagues
  add column if not exists play_league_id text
    check (play_league_id is null or play_league_id ~ '^[0-9]+$');

create unique index if not exists leagues_play_league_id_key
  on public.leagues (play_league_id)
  where play_league_id is not null;

alter table public.events
  add column if not exists league_id uuid
    references public.leagues (id) on delete set null,
  add column if not exists tournament_id text
    check (tournament_id is null or tournament_id <> '');

create index if not exists events_league_id_idx on public.events (league_id);

create unique index if not exists events_tournament_id_key
  on public.events (tournament_id)
  where tournament_id is not null;

-- create_event gains p_league_id, p_tournament_id and p_status; drop+recreate
-- since CREATE OR REPLACE can't add parameters (builds on 0039's 13-arg
-- version). Body is 0039's plus the three new columns.
drop function if exists public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int, text, text, int
);

create function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null,
  p_subtitle text default null, p_list_lock_minutes int default 60,
  p_league_id uuid default null, p_tournament_id text default null,
  p_status text default 'open'
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
  v_tournament text; v_status text;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
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
    list_lock_minutes, league_id, tournament_id, status, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category,
    nullif(trim(coalesce(p_subtitle, '')), ''),
    coalesce(p_list_lock_minutes, 60), p_league_id, v_tournament, v_status,
    auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

grant execute on function public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int,
  text, text, int, uuid, text, text
) to authenticated;
