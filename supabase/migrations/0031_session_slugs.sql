-- Human-friendly per-league slugs for session URLs, so links look like
-- /leagues/<league-slug>/sessions/<session-slug> instead of a raw UUID.
--
-- Base is the session date (YYYY-MM-DD) when known, falling back to the
-- session name (sessions created through the UI never have one today, but
-- the RPC still accepts p_name), then a generic label. Uniqueness is scoped
-- to the league (mirrors public.slugify()'s use for leagues/events, which
-- dedupe globally instead).

alter table public.sessions add column if not exists slug text;

create or replace function public.session_base_slug(p_name text, p_starts_at timestamptz)
returns text language plpgsql immutable as $$
begin
  if p_starts_at is not null then
    return to_char(p_starts_at, 'YYYY-MM-DD');
  elsif coalesce(trim(p_name), '') <> '' then
    return public.slugify(p_name);
  else
    return 'sesion';
  end if;
end; $$;

-- Backfill existing sessions, oldest first, unique per league.
do $$
declare r record; v_base text; v_slug text; v_n int;
begin
  for r in
    select id, league_id, name, starts_at from public.sessions order by created_at
  loop
    v_base := public.session_base_slug(r.name, r.starts_at);
    v_slug := v_base;
    v_n := 1;
    while exists (
      select 1 from public.sessions
      where league_id = r.league_id and slug = v_slug and id <> r.id
    ) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    update public.sessions set slug = v_slug where id = r.id;
  end loop;
end $$;

alter table public.sessions alter column slug set not null;
alter table public.sessions add constraint sessions_league_slug_key unique (league_id, slug);

-- Recreate create_session so it assigns a slug at creation time (fixed for
-- the session's lifetime, same as league/event slugs).
create or replace function public.create_session(
  p_league uuid, p_name text, p_starts_at timestamptz,
  p_location text, p_cost numeric, p_capacity int
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;

  v_base := public.session_base_slug(p_name, p_starts_at);
  v_slug := v_base;
  while exists (select 1 from public.sessions where league_id = p_league and slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.sessions (league_id, name, starts_at, location, cost, capacity, created_by, slug)
  values (
    p_league,
    nullif(trim(coalesce(p_name, '')), ''),
    p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_cost, 0),
    p_capacity,
    auth.uid(),
    v_slug
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.create_session(uuid, text, timestamptz, text, numeric, int) to authenticated;
