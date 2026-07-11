-- Phase: league season duration (which months a league runs, e.g. a typical
-- 3-month season). Stored as the 1st of the start month / 1st of the end
-- month; both optional.
alter table public.leagues
  add column if not exists starts_month date,
  add column if not exists ends_month date;

-- create_league gains two new optional params, so the existing 3-arg
-- signature must be dropped first (CREATE OR REPLACE can't add parameters).
drop function if exists public.create_league(text, text, text);

create function public.create_league(
  p_name text, p_game text, p_description text,
  p_starts_month date default null, p_ends_month date default null
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

  insert into public.leagues (
    name, slug, description, game, starts_month, ends_month, created_by
  )
  values (
    trim(p_name), v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    p_game, p_starts_month, p_ends_month, auth.uid()
  )
  returning id into v_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_slug;
end; $$;

grant execute on function public.create_league(text, text, text, date, date) to authenticated;
