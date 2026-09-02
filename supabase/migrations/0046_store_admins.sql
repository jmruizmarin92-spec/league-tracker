-- Store admins (PL-17). A store (0045) gets its own roster, separate from
-- the site-wide `profiles.is_admin` flag and from the per-league
-- `league_members`: a store admin runs every league of the store and can
-- create events and new seasons under it, without being added to each
-- league's roster.
--
-- * store_admins — (store_id, user_id, role owner|admin), same shape as
--   league_members. Owners manage the store's admins; only site admins add
--   or remove owners.
-- * is_store_admin / is_store_owner — site admins always pass.
-- * is_league_admin / is_league_owner / is_event_admin / is_event_owner are
--   redefined to also accept admins of the league's / event's store. Every
--   RLS policy and RPC built on them (league details, sessions, rounds,
--   league admin roster, event status, registrations, staff, TDF import...)
--   opens to store admins through this one change. Hard deletes
--   (delete_league, delete_event, delete_player) stay site-admin only.
-- * create_league / create_event accept an admin of p_store_id. Without a
--   store they stay site-admin only.
-- * stores update policy opens to the store's admins; insert/delete stay
--   site-admin.

create table if not exists public.store_admins (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_admins_user_id_idx on public.store_admins (user_id);

alter table public.store_admins enable row level security;
create policy "store_admins_select_all" on public.store_admins for select using (true);
grant select on public.store_admins to anon, authenticated;
-- No insert/update/delete grants: the roster only moves through the RPCs.

create or replace function public.is_store_admin(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.store_admins
    where store_id = p_store and user_id = auth.uid()
  );
$$;
grant execute on function public.is_store_admin(uuid) to anon, authenticated;

create or replace function public.is_store_owner(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.store_admins
    where store_id = p_store and user_id = auth.uid() and role = 'owner'
  );
$$;
grant execute on function public.is_store_owner(uuid) to anon, authenticated;

-- Owners add admins; owners themselves are a site-admin decision. Re-adding
-- an existing member updates the role, except that an owner cannot be
-- demoted by another owner.
create or replace function public.add_store_admin(
  p_store uuid, p_user uuid, p_role text default 'admin'
)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_existing text;
begin
  v_role := coalesce(nullif(trim(p_role), ''), 'admin');
  if v_role not in ('owner', 'admin') then raise exception 'Invalid role'; end if;
  if not exists (select 1 from public.stores where id = p_store) then
    raise exception 'Unknown store';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Unknown user';
  end if;
  if v_role = 'owner' then
    if not public.is_site_admin() then raise exception 'Not allowed'; end if;
  elsif not public.is_store_owner(p_store) then
    raise exception 'Not allowed';
  end if;

  select role into v_existing from public.store_admins
  where store_id = p_store and user_id = p_user;
  if v_existing = 'owner' and not public.is_site_admin() then
    raise exception 'Not allowed';
  end if;

  insert into public.store_admins (store_id, user_id, role)
  values (p_store, p_user, v_role)
  on conflict (store_id, user_id) do update set role = excluded.role;
end; $$;
grant execute on function public.add_store_admin(uuid, uuid, text) to authenticated;

create or replace function public.remove_store_admin(p_store uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing text;
begin
  select role into v_existing from public.store_admins
  where store_id = p_store and user_id = p_user;
  if v_existing is null then return; end if;
  if v_existing = 'owner' then
    if not public.is_site_admin() then raise exception 'Not allowed'; end if;
  elsif not public.is_store_owner(p_store) then
    raise exception 'Not allowed';
  end if;
  delete from public.store_admins where store_id = p_store and user_id = p_user;
end; $$;
grant execute on function public.remove_store_admin(uuid, uuid) to authenticated;

-- Store admins are admins (and owners, so they can manage rosters) of every
-- league of the store. Same signatures as 0005, so the policies and RPCs
-- referencing these keep working.
create or replace function public.is_league_admin(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin()
    or exists (
      select 1 from public.league_members
      where league_id = p_league and user_id = auth.uid()
    )
    or exists (
      select 1 from public.leagues l
      join public.store_admins sa on sa.store_id = l.store_id
      where l.id = p_league and sa.user_id = auth.uid()
    );
$$;

create or replace function public.is_league_owner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin()
    or exists (
      select 1 from public.league_members
      where league_id = p_league and user_id = auth.uid() and role = 'owner'
    )
    or exists (
      select 1 from public.leagues l
      join public.store_admins sa on sa.store_id = l.store_id
      where l.id = p_league and sa.user_id = auth.uid()
    );
$$;

-- Same for the store's events (0010 signatures).
create or replace function public.is_event_admin(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin()
    or exists (
      select 1 from public.event_admins
      where event_id = p_event and user_id = auth.uid()
    )
    or exists (
      select 1 from public.events e
      join public.store_admins sa on sa.store_id = e.store_id
      where e.id = p_event and sa.user_id = auth.uid()
    );
$$;

create or replace function public.is_event_owner(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin()
    or exists (
      select 1 from public.event_admins
      where event_id = p_event and user_id = auth.uid() and role = 'owner'
    )
    or exists (
      select 1 from public.events e
      join public.store_admins sa on sa.store_id = e.store_id
      where e.id = p_event and sa.user_id = auth.uid()
    );
$$;

-- Store admins edit their store's name / Play! id. Insert and delete keep
-- 0045's site-admin policies.
drop policy if exists "stores_update_admin" on public.stores;
create policy "stores_update_admin" on public.stores for update
  using (public.is_store_admin(id)) with check (public.is_store_admin(id));

-- create_league: same 7-arg signature as 0045; the gate now also accepts an
-- admin of the target store. Body otherwise identical.
create or replace function public.create_league(
  p_name text, p_game text, p_description text,
  p_starts_month date default null, p_ends_month date default null,
  p_format text default null, p_store_id uuid default null
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not (
    public.is_site_admin()
    or (p_store_id is not null and public.is_store_admin(p_store_id))
  ) then raise exception 'Admins only'; end if;
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

-- create_event: same 17-arg signature as 0045; gate opened the same way.
create or replace function public.create_event(
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
