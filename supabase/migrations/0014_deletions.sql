-- Phase 14: hard-delete capabilities. All target tables already cascade
-- correctly on delete (session_participants/matches/rounds -> sessions;
-- sessions/league_members -> leagues; event_registrations/event_lists/
-- event_admins -> events; matches/session_participants/player_claims/
-- event_registrations/event_lists -> players), so each RPC below only needs
-- to authorize the action and issue the delete.

-- Delete a never-claimed (unsynced) managed player. Deliberately refuses to
-- delete a player linked to a real account, so this can't wipe someone's
-- match history by mistake — use merge_players for that case instead.
create or replace function public.delete_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if exists (
    select 1 from public.players where id = p_player and user_id is not null
  ) then
    raise exception 'Cannot delete a player linked to an account';
  end if;
  delete from public.players where id = p_player;
end; $$;

-- Delete a session (cascades to its rounds, matches, participants).
create or replace function public.delete_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  select league_id into v_league from public.sessions where id = p_session;
  if v_league is null then raise exception 'Session not found'; end if;
  if not public.is_league_admin(v_league) then raise exception 'Not allowed'; end if;
  delete from public.sessions where id = p_session;
end; $$;

-- Delete a league (cascades to its sessions/rounds/matches/participants and
-- membership). Site-admin only, matching who may create a league.
create or replace function public.delete_league(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  delete from public.leagues where id = p_league;
end; $$;

-- Delete an independent event (cascades to registrations/lists/admins).
-- Site-admin only, matching who may create an event.
create or replace function public.delete_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  delete from public.events where id = p_event;
end; $$;

grant execute on function public.delete_player(uuid) to authenticated;
grant execute on function public.delete_session(uuid) to authenticated;
grant execute on function public.delete_league(uuid) to authenticated;
grant execute on function public.delete_event(uuid) to authenticated;
