-- Phase 3: Players, claims, and admin helpers.

-- ---------------------------------------------------------------------------
-- Helper: is the current user a site admin? Used across RLS policies + RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  );
$$;

grant execute on function public.is_site_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Players: global competitor identity across leagues.
-- Managed players (created by an admin for people without accounts) have
-- user_id = null. A user claims/links a managed player, or creates their own.
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) > 0),
  user_id uuid unique references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;

-- Players are public (names appear in standings/schedules).
create policy "players_select_all" on public.players for select using (true);

-- Admins may create managed players; a user may create their own player.
create policy "players_insert" on public.players for insert
  with check (public.is_site_admin() or user_id = auth.uid());

-- Admins may update any player; a user may update their own player.
create policy "players_update" on public.players for update
  using (public.is_site_admin() or user_id = auth.uid())
  with check (public.is_site_admin() or user_id = auth.uid());

grant select on public.players to anon, authenticated;
grant insert, update on public.players to authenticated;

-- Non-admins cannot change ownership fields (prevents claiming without approval).
create or replace function public.players_guard_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then
    if new.user_id is distinct from old.user_id
       or new.created_by is distinct from old.created_by then
      new.user_id := old.user_id;
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger players_guard_ownership
  before update on public.players
  for each row execute function public.players_guard_ownership();

-- ---------------------------------------------------------------------------
-- Player claims: a user requests to link an existing managed player; an admin
-- approves. Inserts/updates go through the SECURITY DEFINER RPCs below.
-- ---------------------------------------------------------------------------
create table if not exists public.player_claims (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one pending claim per (player, requester).
create unique index if not exists player_claims_one_pending
  on public.player_claims (player_id, requested_by)
  where status = 'pending';

alter table public.player_claims enable row level security;

-- A user sees their own claims; admins see all.
create policy "player_claims_select" on public.player_claims for select
  using (requested_by = auth.uid() or public.is_site_admin());

grant select on public.player_claims to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER) for the sensitive flows.
-- ---------------------------------------------------------------------------

-- First-login "create new": link a brand-new player to the caller.
create or replace function public.create_own_player(p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_display_name), '') = '' then raise exception 'Name required'; end if;
  if exists (select 1 from public.players where user_id = auth.uid()) then
    raise exception 'You already have a linked player';
  end if;
  insert into public.players (display_name, user_id, created_by)
  values (trim(p_display_name), auth.uid(), auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

-- Admin: create a managed player (no account attached yet).
create or replace function public.create_managed_player(p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_display_name), '') = '' then raise exception 'Name required'; end if;
  insert into public.players (display_name, user_id, created_by)
  values (trim(p_display_name), null, auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

-- User requests to claim a managed (unclaimed) player.
create or replace function public.request_player_claim(p_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.players where user_id = auth.uid()) then
    raise exception 'You already have a linked player';
  end if;
  if not exists (select 1 from public.players where id = p_player_id and user_id is null) then
    raise exception 'Player not available to claim';
  end if;
  insert into public.player_claims (player_id, requested_by)
  values (p_player_id, auth.uid())
  on conflict do nothing
  returning id into v_id;
  return v_id;
end; $$;

-- Admin: approve a pending claim (links the player, rejects rival claims).
create or replace function public.approve_player_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_requester uuid;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  select player_id, requested_by into v_player, v_requester
  from public.player_claims where id = p_claim_id and status = 'pending';
  if v_player is null then raise exception 'Claim not found or already resolved'; end if;
  if exists (select 1 from public.players where id = v_player and user_id is not null) then
    raise exception 'Player already claimed';
  end if;
  if exists (select 1 from public.players where user_id = v_requester) then
    raise exception 'Requester already has a linked player';
  end if;
  update public.players set user_id = v_requester where id = v_player;
  update public.player_claims
    set status = 'approved', resolved_by = auth.uid(), resolved_at = now()
    where id = p_claim_id;
  update public.player_claims
    set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
    where player_id = v_player and status = 'pending' and id <> p_claim_id;
end; $$;

-- Admin: reject a pending claim.
create or replace function public.reject_player_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  update public.player_claims
    set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
    where id = p_claim_id and status = 'pending';
end; $$;

-- Admin: merge player p_from into p_into, then delete p_from.
-- NOTE: extend this to reassign session_participants / matches / event
-- registrations as those tables are introduced in later phases.
create or replace function public.merge_players(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if p_from = p_into then raise exception 'Cannot merge a player into itself'; end if;
  if not exists (select 1 from public.players where id = p_from) then
    raise exception 'Source player not found';
  end if;
  if not exists (select 1 from public.players where id = p_into) then
    raise exception 'Target player not found';
  end if;
  update public.player_claims set player_id = p_into where player_id = p_from;
  delete from public.players where id = p_from;
end; $$;

grant execute on function public.create_own_player(text) to authenticated;
grant execute on function public.create_managed_player(text) to authenticated;
grant execute on function public.request_player_claim(uuid) to authenticated;
grant execute on function public.approve_player_claim(uuid) to authenticated;
grant execute on function public.reject_player_claim(uuid) to authenticated;
grant execute on function public.merge_players(uuid, uuid) to authenticated;
