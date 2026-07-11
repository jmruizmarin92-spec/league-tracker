-- Add "Prelanzamiento" (prerelease) as a fourth event category, alongside
-- Cup/Challenge/Demo/Otros (lib/event-category.ts).
alter table public.events drop constraint if exists events_category_check;
alter table public.events
  add constraint events_category_check
    check (category is null or category in ('cup', 'challenge', 'demo', 'prerelease', 'others'));

-- Same signature as 0018's create_event; only the category validation list changes.
create or replace function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null,
  p_subtitle text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;
  if p_category is not null and p_category not in ('cup', 'challenge', 'demo', 'prerelease', 'others') then
    raise exception 'Invalid category';
  end if;

  v_base := public.slugify(p_name); v_slug := v_base;
  while exists (select 1 from public.events where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.events (
    name, slug, game, starts_at, location, cost, description,
    external_url, prizes, list_required, capacity, category, subtitle, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category,
    nullif(trim(coalesce(p_subtitle, '')), ''), auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;
