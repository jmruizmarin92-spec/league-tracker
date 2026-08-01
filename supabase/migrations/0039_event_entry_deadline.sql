-- Standalone events stop accepting registrations and list submissions a fixed
-- number of minutes before starts_at (60 by default, i.e. one hour). Event
-- admins are exempt so they can still add someone or fix a list at the venue.
-- 0 disables the cutoff, and an event with no starts_at never locks.
alter table public.events
  add column if not exists list_lock_minutes integer not null default 60;
alter table public.events drop constraint if exists events_list_lock_minutes_check;
alter table public.events
  add constraint events_list_lock_minutes_check
    check (list_lock_minutes between 0 and 10080);

-- True once the cutoff has passed. Mirrored in TS by isEventEntryLocked()
-- (lib/events.ts), which gates the UI; this is the enforcement point.
create or replace function public.event_entry_locked(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.starts_at is not null
       and e.list_lock_minutes > 0
       and now() >= e.starts_at - make_interval(mins => e.list_lock_minutes)
      from public.events e
     where e.id = p_event
  ), false);
$$;
grant execute on function public.event_entry_locked(uuid) to anon, authenticated;

-- create_event gains p_list_lock_minutes; drop+recreate since CREATE OR
-- REPLACE can't add parameters (builds on 0023's 12-arg version).
drop function if exists public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int, text, text
);

create function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int, p_category text default null,
  p_subtitle text default null, p_list_lock_minutes int default 60
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
    external_url, prizes, list_required, capacity, category, subtitle,
    list_lock_minutes, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, p_category,
    nullif(trim(coalesce(p_subtitle, '')), ''),
    coalesce(p_list_lock_minutes, 60), auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

grant execute on function public.create_event(
  text, text, timestamptz, text, numeric, text, text, text, boolean, int, text, text, int
) to authenticated;

-- Same as 0010's register_event, plus the cutoff check.
create or replace function public.register_event(
  p_event uuid, p_content text, p_url text
)
returns text language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_cap int; v_count int; v_status text;
  v_required boolean; v_has_list boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'You have no linked player'; end if;
  if exists (select 1 from public.events where id = p_event and status <> 'open') then
    raise exception 'Registration is closed';
  end if;
  if public.event_entry_locked(p_event) and not public.is_event_admin(p_event) then
    raise exception 'The entry deadline has passed';
  end if;

  select list_required, capacity into v_required, v_cap
    from public.events where id = p_event;
  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';
  if v_required and not v_has_list then
    raise exception 'A list is required to register';
  end if;

  if v_cap is null then
    v_status := 'registered';
  else
    select count(*) into v_count from public.event_registrations
      where event_id = p_event and status = 'registered';
    v_status := case when v_count < v_cap then 'registered' else 'waitlisted' end;
  end if;

  insert into public.event_registrations (event_id, player_id, status, has_list)
  values (p_event, v_player, v_status, v_has_list)
  on conflict (event_id, player_id) do update set status = excluded.status;

  if v_has_list then
    insert into public.event_lists (event_id, player_id, content, url)
    values (p_event, v_player, nullif(trim(coalesce(p_content, '')), ''),
            nullif(trim(coalesce(p_url, '')), ''))
    on conflict (event_id, player_id)
    do update set content = excluded.content, url = excluded.url, submitted_at = now();
  end if;

  return v_status;
end; $$;

-- Same as 0010's submit_event_list, plus the cutoff check.
create or replace function public.submit_event_list(
  p_event uuid, p_content text, p_url text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_has_list boolean;
begin
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;
  if not exists (
    select 1 from public.event_registrations
    where event_id = p_event and player_id = v_player
  ) then raise exception 'You are not registered'; end if;
  if public.event_entry_locked(p_event) and not public.is_event_admin(p_event) then
    raise exception 'The list deadline has passed';
  end if;

  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';

  insert into public.event_lists (event_id, player_id, content, url)
  values (p_event, v_player, nullif(trim(coalesce(p_content, '')), ''),
          nullif(trim(coalesce(p_url, '')), ''))
  on conflict (event_id, player_id)
  do update set content = excluded.content, url = excluded.url, submitted_at = now();

  update public.event_registrations set has_list = v_has_list
    where event_id = p_event and player_id = v_player;
end; $$;

-- Admin bypass: write any registrant's list, before or after the cutoff.
create or replace function public.admin_submit_event_list(
  p_event uuid, p_player uuid, p_content text, p_url text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_has_list boolean;
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  if not exists (
    select 1 from public.event_registrations
    where event_id = p_event and player_id = p_player
  ) then raise exception 'That player is not registered'; end if;

  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';

  insert into public.event_lists (event_id, player_id, content, url)
  values (p_event, p_player, nullif(trim(coalesce(p_content, '')), ''),
          nullif(trim(coalesce(p_url, '')), ''))
  on conflict (event_id, player_id)
  do update set content = excluded.content, url = excluded.url, submitted_at = now();

  update public.event_registrations set has_list = v_has_list
    where event_id = p_event and player_id = p_player;
end; $$;
grant execute on function public.admin_submit_event_list(uuid, uuid, text, text) to authenticated;
