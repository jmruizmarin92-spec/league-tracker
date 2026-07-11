-- Phase 10: Independent events / tournaments (standalone, not tied to a league).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  game text not null check (game in ('tcg', 'vgc')),
  starts_at timestamptz,
  location text,
  cost numeric(8, 2) not null default 0,
  description text,
  external_url text,
  prizes text,
  list_required boolean not null default false,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'complete')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

create table if not exists public.event_admins (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  primary key (event_id, user_id)
);
alter table public.event_admins enable row level security;

-- Who is registered (public). Decklists live in event_lists (private).
create table if not exists public.event_registrations (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'waitlisted')),
  has_list boolean not null default false,
  registered_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
alter table public.event_registrations enable row level security;

-- Submitted lists — PRIVATE: readable only by the submitter and event admins.
create table if not exists public.event_lists (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  content text,
  url text,
  submitted_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
alter table public.event_lists enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers.
-- ---------------------------------------------------------------------------
create or replace function public.is_event_admin(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.event_admins
    where event_id = p_event and user_id = auth.uid()
  );
$$;
grant execute on function public.is_event_admin(uuid) to anon, authenticated;

create or replace function public.is_event_owner(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.event_admins
    where event_id = p_event and user_id = auth.uid() and role = 'owner'
  );
$$;
grant execute on function public.is_event_owner(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS + grants.
-- ---------------------------------------------------------------------------
create policy "events_select_all" on public.events for select using (true);
create policy "events_insert_admin" on public.events for insert
  with check (public.is_site_admin());
create policy "events_update_admin" on public.events for update
  using (public.is_event_admin(id)) with check (public.is_event_admin(id));
grant select on public.events to anon, authenticated;
grant insert, update on public.events to authenticated;

create policy "event_admins_select_all" on public.event_admins for select using (true);
grant select on public.event_admins to anon, authenticated;

create policy "event_registrations_select_all" on public.event_registrations
  for select using (true);
grant select on public.event_registrations to anon, authenticated;

-- Lists are private.
create policy "event_lists_select_own_or_admin" on public.event_lists
  for select using (
    public.is_event_admin(event_id)
    or exists (
      select 1 from public.players p
      where p.id = event_lists.player_id and p.user_id = auth.uid()
    )
  );
grant select on public.event_lists to authenticated;

-- ---------------------------------------------------------------------------
-- Internal registration helpers.
-- ---------------------------------------------------------------------------
create or replace function public.promote_event_waitlist(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int; v_next uuid;
begin
  select capacity into v_cap from public.events where id = p_event;
  if v_cap is null then return; end if;
  loop
    select count(*) into v_count from public.event_registrations
      where event_id = p_event and status = 'registered';
    exit when v_count >= v_cap;
    select player_id into v_next from public.event_registrations
      where event_id = p_event and status = 'waitlisted'
      order by registered_at asc limit 1;
    exit when v_next is null;
    update public.event_registrations set status = 'registered'
      where event_id = p_event and player_id = v_next;
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- Public RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.create_event(
  p_name text, p_game text, p_starts_at timestamptz, p_location text,
  p_cost numeric, p_description text, p_external_url text, p_prizes text,
  p_list_required boolean, p_capacity int
)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if p_game not in ('tcg', 'vgc') then raise exception 'Invalid game'; end if;

  v_base := public.slugify(p_name); v_slug := v_base;
  while exists (select 1 from public.events where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.events (
    name, slug, game, starts_at, location, cost, description,
    external_url, prizes, list_required, capacity, created_by
  ) values (
    trim(p_name), v_slug, p_game, p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''), coalesce(p_cost, 0),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_prizes, '')), ''),
    coalesce(p_list_required, false), p_capacity, auth.uid()
  ) returning id into v_id;

  insert into public.event_admins (event_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_slug;
end; $$;

-- Register the caller's player, optionally with a list.
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

-- Submit / update the caller's list for an event they're registered in.
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

create or replace function public.unregister_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then return; end if;
  delete from public.event_registrations
    where event_id = p_event and player_id = v_player;
  perform public.promote_event_waitlist(p_event);
end; $$;

create or replace function public.admin_remove_registration(p_event uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  delete from public.event_registrations
    where event_id = p_event and player_id = p_player;
  perform public.promote_event_waitlist(p_event);
end; $$;

create or replace function public.set_event_status(p_event uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  if p_status not in ('open', 'closed', 'complete') then
    raise exception 'Invalid status';
  end if;
  update public.events set status = p_status where id = p_event;
end; $$;

grant execute on function public.create_event(text, text, timestamptz, text, numeric, text, text, text, boolean, int) to authenticated;
grant execute on function public.register_event(uuid, text, text) to authenticated;
grant execute on function public.submit_event_list(uuid, text, text) to authenticated;
grant execute on function public.unregister_event(uuid) to authenticated;
grant execute on function public.admin_remove_registration(uuid, uuid) to authenticated;
grant execute on function public.set_event_status(uuid, text) to authenticated;
