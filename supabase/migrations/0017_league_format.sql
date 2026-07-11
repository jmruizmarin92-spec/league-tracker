-- League format: TCG leagues choose Standard or GLC; VGC leagues are always
-- Champions. Nullable so existing leagues (created before this field
-- existed) remain valid without a value.
alter table public.leagues
  add column if not exists format text;

alter table public.leagues
  add constraint leagues_format_valid check (
    (game = 'tcg' and format in ('standard', 'glc'))
    or (game = 'vgc' and format = 'champions')
  );

-- create_league gains p_format; drop+recreate since CREATE OR REPLACE can't
-- add parameters to an existing signature (builds on 0015's 5-arg version).
drop function if exists public.create_league(text, text, text, date, date);

create function public.create_league(
  p_name text, p_game text, p_description text,
  p_starts_month date default null, p_ends_month date default null,
  p_format text default null
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

  v_base := public.slugify(p_name);
  v_slug := v_base;
  while exists (select 1 from public.leagues where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.leagues (
    name, slug, description, game, starts_month, ends_month, format, created_by
  )
  values (
    trim(p_name), v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    p_game, p_starts_month, p_ends_month, p_format, auth.uid()
  )
  returning id into v_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_slug;
end; $$;

grant execute on function public.create_league(text, text, text, date, date, text) to authenticated;
