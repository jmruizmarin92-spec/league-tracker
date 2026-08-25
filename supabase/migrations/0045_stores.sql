-- Stores (PL-16, second pass). What the Play! Pokémon site calls a "League"
-- (League ID 6236068 = WAR LOTUS STORE) is the store/organiser, and it keeps
-- that id forever. Our leagues are seasons of one game/format under it (War
-- Lotus 26/27 TCG, VGC Lotus 26/27, next year's 27/28...), so the Play! id
-- cannot live on a league: 0044 put it there with a unique index, which
-- would not even let the TCG and VGC leagues of the same store share it.
--
-- This moves it one layer up:
--
-- * stores — name + play_league_id (unique here, where it belongs).
-- * leagues.store_id — which store a season belongs to.
-- * events.store_id — a pasted event always finds its store through the
--   League ID; events.league_id (0044) stays as the optional season link,
--   picked by game + format + date among the store's leagues.
--
-- leagues.play_league_id and its index are dropped; nothing had been set yet.

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  play_league_id text
    check (play_league_id is null or play_league_id ~ '^[0-9]+$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists stores_play_league_id_key
  on public.stores (play_league_id)
  where play_league_id is not null;

alter table public.stores enable row level security;

create policy "stores_select_all" on public.stores for select using (true);
create policy "stores_insert_admin" on public.stores for insert
  with check (public.is_site_admin());
create policy "stores_update_admin" on public.stores for update
  using (public.is_site_admin()) with check (public.is_site_admin());
create policy "stores_delete_admin" on public.stores for delete
  using (public.is_site_admin());
grant select on public.stores to anon, authenticated;
grant insert, update, delete on public.stores to authenticated;

-- Slug from the name, unique; used as a stable handle even though there is
-- no public store page yet.
create or replace function public.create_store(p_name text, p_play_league_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1; v_play text;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  v_play := nullif(trim(coalesce(p_play_league_id, '')), '');
  if v_play is not null and v_play !~ '^[0-9]+$' then
    raise exception 'Play! league id must be numeric';
  end if;
  if v_play is not null
     and exists (select 1 from public.stores where play_league_id = v_play) then
    raise exception 'Another store already has Play! league id %', v_play;
  end if;

  v_base := public.slugify(p_name); v_slug := v_base;
  while exists (select 1 from public.stores where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.stores (name, slug, play_league_id, created_by)
  values (trim(p_name), v_slug, v_play, auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.create_store(text, text) to authenticated;

-- Season link on leagues; the Play! id moves off them.
alter table public.leagues
  add column if not exists store_id uuid
    references public.stores (id) on delete set null;
create index if not exists leagues_store_id_idx on public.leagues (store_id);

drop index if exists public.leagues_play_league_id_key;
alter table public.leagues drop column if exists play_league_id;

-- Store link on events, next to 0044's league_id.
alter table public.events
  add column if not exists store_id uuid
    references public.stores (id) on delete set null;
create index if not exists events_store_id_idx on public.events (store_id);

-- create_league gains p_store_id; drop+recreate (builds on 0017's 6-arg
-- version). Body is 0017's plus the store.
drop function if exists public.create_league(text, text, text, date, date, text);

create function public.create_league(
  p_name text, p_game text, p_description text,
  p_starts_month date default null, p_ends_month date default null,
  p_format text default null, p_store_id uuid default null
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;
  if p_game = 'tcg' and p_format not in ('standard', 'glc') then
    raise exception 'Invalid format for TCG (standard or glc)';
  end if;
  if p_game = 'vgc' and p_format is distinct from 'champions' then
    raise exception 'Invalid format for VGC (must be champions)';
  end if;
  if p_store_id is not null
     and not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Unknown store';
  end if;

  v_base := public.slugify(p_name);
  v_slug := v_base;
  while exists (select 1 from public.leagues where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.leagues (
    name, slug, description, game, starts_month, ends_month, format, store_id,
    created_by
  )
  values (
    trim(p_name), v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    p_game, p_starts_month, p_ends_month, p_format, p_store_id, auth.uid()
  )
  returning id into v_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_slug;
end; $$;

grant execute on function public.create_league(text, text, text, date, date, text, uuid)
  to authenticated;

-- create_event gains p_store_id; drop+recreate (builds on 0044's 16-arg
-- version). Body is 0044's plus the store.
drop function if exists public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int,
  text, text, int, uuid, text, text
);

create function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null,
  p_subtitle text default null, p_list_lock_minutes int default 60,
  p_league_id uuid default null, p_tournament_id text default null,
  p_status text default 'open', p_store_id uuid default null
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
    list_lock_minutes, league_id, tournament_id, status, store_id, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category,
    nullif(trim(coalesce(p_subtitle, '')), ''),
    coalesce(p_list_lock_minutes, 60), p_league_id, v_tournament, v_status,
    p_store_id, auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

grant execute on function public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int,
  text, text, int, uuid, text, text, uuid
) to authenticated;
