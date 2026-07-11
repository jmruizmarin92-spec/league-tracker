-- Optional category (Cup / Challenge / Demo / Otros) on both independent
-- events and league sessions, with matching icons in the UI (lib/event-category.ts).
alter table public.events
  add column if not exists category text
    check (category is null or category in ('cup', 'challenge', 'demo', 'others'));

alter table public.sessions
  add column if not exists category text
    check (category is null or category in ('cup', 'challenge', 'demo', 'others'));

-- create_event gains p_category; drop+recreate since CREATE OR REPLACE can't
-- add parameters to an existing signature.
drop function if exists public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int
);

create function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;
  if p_category is not null and p_category not in ('cup', 'challenge', 'demo', 'others') then
    raise exception 'Invalid category';
  end if;

  v_base := public.slugify(p_name); v_slug := v_base;
  while exists (select 1 from public.events where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.events (
    name, slug, game, starts_at, location, cost, description,
    external_url, prizes, list_required, capacity, category, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category, auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

grant execute on function public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int, text
) to authenticated;

-- create_session gains p_category.
drop function if exists public.create_session(uuid, text, timestamptz, text, numeric, int);

create function public.create_session(
  p_league uuid, p_name text, p_starts_at timestamptz,
  p_location text, p_cost numeric, p_capacity int, p_category text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;
  if p_category is not null and p_category not in ('cup', 'challenge', 'demo', 'others') then
    raise exception 'Invalid category';
  end if;
  insert into public.sessions (
    league_id, name, starts_at, location, cost, capacity, category, created_by
  )
  values (
    p_league,
    nullif(trim(coalesce(p_name, '')), ''),
    p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_cost, 0),
    p_capacity,
    p_category,
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.create_session(uuid, text, timestamptz, text, numeric, int, text) to authenticated;

-- Admin: change a session's category after creation (mirrors set_session_status).
create or replace function public.set_session_category(p_session uuid, p_category text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if p_category is not null and p_category not in ('cup', 'challenge', 'demo', 'others') then
    raise exception 'Invalid category';
  end if;
  update public.sessions set category = p_category where id = p_session;
end; $$;

grant execute on function public.set_session_category(uuid, text) to authenticated;
