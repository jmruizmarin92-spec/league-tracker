-- Phase 4: Leagues and roles.

-- ---------------------------------------------------------------------------
-- Leagues: an ongoing competition for a single game (TCG or VGC).
-- ---------------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  description text,
  game text not null check (game in ('tcg', 'vgc')),
  win_value integer not null default 1,
  attendance_value integer not null default 1,
  draw_value integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;

-- League admins (owner + co-admins).
create table if not exists public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.league_members enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers.
-- ---------------------------------------------------------------------------
create or replace function public.is_league_admin(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid()
  );
$$;
grant execute on function public.is_league_admin(uuid) to anon, authenticated;

create or replace function public.is_league_owner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid() and role = 'owner'
  );
$$;
grant execute on function public.is_league_owner(uuid) to anon, authenticated;

create or replace function public.slugify(p_text text)
returns text language plpgsql immutable as $$
declare v text;
begin
  v := lower(trim(coalesce(p_text, '')));
  v := translate(v, 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from v);
  if v = '' then v := 'liga'; end if;
  return v;
end; $$;

-- ---------------------------------------------------------------------------
-- RLS + grants.
-- ---------------------------------------------------------------------------
create policy "leagues_select_all" on public.leagues for select using (true);
create policy "leagues_insert_admin" on public.leagues for insert
  with check (public.is_site_admin());
create policy "leagues_update_admin" on public.leagues for update
  using (public.is_league_admin(id)) with check (public.is_league_admin(id));
grant select on public.leagues to anon, authenticated;
grant insert, update on public.leagues to authenticated;

create policy "league_members_select_all" on public.league_members for select
  using (true);
grant select on public.league_members to anon, authenticated;
-- Writes go through the SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.create_league(
  p_name text, p_game text, p_description text
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;

  v_base := public.slugify(p_name);
  v_slug := v_base;
  while exists (select 1 from public.leagues where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.leagues (name, slug, description, game, created_by)
  values (
    trim(p_name), v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    p_game, auth.uid()
  )
  returning id into v_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_slug;
end; $$;

create or replace function public.add_league_admin(p_league uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_owner(p_league) then raise exception 'Not allowed'; end if;
  insert into public.league_members (league_id, user_id, role)
  values (p_league, p_user, 'admin')
  on conflict (league_id, user_id) do nothing;
end; $$;

create or replace function public.remove_league_admin(p_league uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_owner(p_league) then raise exception 'Not allowed'; end if;
  delete from public.league_members
  where league_id = p_league and user_id = p_user and role <> 'owner';
end; $$;

grant execute on function public.create_league(text, text, text) to authenticated;
grant execute on function public.add_league_admin(uuid, uuid) to authenticated;
grant execute on function public.remove_league_admin(uuid, uuid) to authenticated;
