-- Phase 5: Sessions and participants.

-- ---------------------------------------------------------------------------
-- Sessions: one event day within a league. Game is inherited from the league.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text,
  starts_at timestamptz,
  location text,
  cost numeric(8, 2) not null default 0,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'setup' check (status in ('setup', 'active', 'complete')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'waitlisted')),
  joined_round integer not null default 1,
  dropped_round integer,
  created_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
alter table public.session_participants enable row level security;

-- Public reads; writes go through SECURITY DEFINER RPCs.
create policy "sessions_select_all" on public.sessions for select using (true);
grant select on public.sessions to anon, authenticated;

create policy "session_participants_select_all" on public.session_participants
  for select using (true);
grant select on public.session_participants to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to API roles; only called by definer RPCs).
-- ---------------------------------------------------------------------------
create or replace function public.session_league(p_session uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select league_id from public.sessions where id = p_session;
$$;

create or replace function public.promote_waitlist(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int; v_next uuid;
begin
  select capacity into v_cap from public.sessions where id = p_session;
  if v_cap is null then return; end if;
  loop
    select count(*) into v_count from public.session_participants
      where session_id = p_session and status = 'registered';
    exit when v_count >= v_cap;
    select player_id into v_next from public.session_participants
      where session_id = p_session and status = 'waitlisted'
      order by created_at asc limit 1;
    exit when v_next is null;
    update public.session_participants set status = 'registered'
      where session_id = p_session and player_id = v_next;
  end loop;
end; $$;

create or replace function public.add_participant(p_session uuid, p_player uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int; v_status text;
begin
  if exists (select 1 from public.sessions where id = p_session and status = 'complete') then
    raise exception 'Session is complete';
  end if;
  select capacity into v_cap from public.sessions where id = p_session;
  if v_cap is null then
    v_status := 'registered';
  else
    select count(*) into v_count from public.session_participants
      where session_id = p_session and status = 'registered';
    v_status := case when v_count < v_cap then 'registered' else 'waitlisted' end;
  end if;
  insert into public.session_participants (session_id, player_id, status)
  values (p_session, p_player, v_status)
  on conflict (session_id, player_id) do nothing;
  return v_status;
end; $$;

-- ---------------------------------------------------------------------------
-- Public RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.create_session(
  p_league uuid, p_name text, p_starts_at timestamptz,
  p_location text, p_cost numeric, p_capacity int
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;
  insert into public.sessions (league_id, name, starts_at, location, cost, capacity, created_by)
  values (
    p_league,
    nullif(trim(coalesce(p_name, '')), ''),
    p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_cost, 0),
    p_capacity,
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.join_session(p_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'You have no linked player'; end if;
  return public.add_participant(p_session, v_player);
end; $$;

create or replace function public.leave_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then return; end if;
  delete from public.session_participants
    where session_id = p_session and player_id = v_player;
  perform public.promote_waitlist(p_session);
end; $$;

create or replace function public.admin_add_participant(p_session uuid, p_player uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  return public.add_participant(p_session, p_player);
end; $$;

create or replace function public.admin_remove_participant(p_session uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  delete from public.session_participants
    where session_id = p_session and player_id = p_player;
  perform public.promote_waitlist(p_session);
end; $$;

create or replace function public.set_session_status(p_session uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('setup', 'active', 'complete') then
    raise exception 'Invalid status';
  end if;
  update public.sessions set status = p_status where id = p_session;
end; $$;

grant execute on function public.create_session(uuid, text, timestamptz, text, numeric, int) to authenticated;
grant execute on function public.join_session(uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.admin_add_participant(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_participant(uuid, uuid) to authenticated;
grant execute on function public.set_session_status(uuid, text) to authenticated;
