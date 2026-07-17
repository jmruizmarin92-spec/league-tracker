-- Fix merge_players so it no longer loses data.
--
-- The previous version (0009) had three bugs:
--   1. It never carried players.user_id across, so merging a Google-linked
--      player *into* a managed (admin-created) player left the surviving row
--      with user_id = null. The auth account survived but became orphaned:
--      getMyPlayer() looks up players by user_id, found nothing, and the person
--      appeared as a brand-new user with no history.
--   2. It hard-deleted the source's session_participants instead of moving the
--      non-conflicting ones, dropping the source's registrations.
--   3. It ignored event_registrations / event_lists / event_staff entirely.
--      Those FKs are ON DELETE CASCADE, so deleting the source silently
--      deleted its rows in all three tables.
--
-- This version transfers ownership, then moves every child row using a
-- move-non-conflicting-then-delete-leftovers pattern (the child tables have
-- composite PKs, so a blind update would hit unique violations when the target
-- already has a row for the same session/event).

create or replace function public.merge_players(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_from_user uuid;
  v_into_user uuid;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if p_from = p_into then raise exception 'Cannot merge a player into itself'; end if;
  if not exists (select 1 from public.players where id = p_from) then
    raise exception 'Source player not found';
  end if;
  if not exists (select 1 from public.players where id = p_into) then
    raise exception 'Target player not found';
  end if;

  -- Carry the login across. players.user_id is unique, so if the source has a
  -- linked account and the target has none, release it from the source first
  -- (avoids a transient uniqueness clash) then assign it to the target.
  -- If both are linked, the target keeps its account and the source's auth
  -- login is left detached — merging two real accounts can only keep one.
  select user_id into v_from_user from public.players where id = p_from;
  select user_id into v_into_user from public.players where id = p_into;
  if v_into_user is null and v_from_user is not null then
    update public.players set user_id = null where id = p_from;
    update public.players set user_id = v_from_user where id = p_into;
  end if;

  -- Matches have no per-player uniqueness: straight repoint.
  update public.matches set player1_id = p_into where player1_id = p_from;
  update public.matches set player2_id = p_into where player2_id = p_from;

  -- Composite-PK / partial-unique child tables: move rows that don't collide
  -- with an existing target row, then drop whatever's left on the source (the
  -- final delete would cascade these anyway, but being explicit is clearer).

  update public.session_participants sp set player_id = p_into
    where sp.player_id = p_from
      and not exists (
        select 1 from public.session_participants t
        where t.session_id = sp.session_id and t.player_id = p_into);
  delete from public.session_participants where player_id = p_from;

  update public.event_registrations er set player_id = p_into
    where er.player_id = p_from
      and not exists (
        select 1 from public.event_registrations t
        where t.event_id = er.event_id and t.player_id = p_into);
  delete from public.event_registrations where player_id = p_from;

  update public.event_lists el set player_id = p_into
    where el.player_id = p_from
      and not exists (
        select 1 from public.event_lists t
        where t.event_id = el.event_id and t.player_id = p_into);
  delete from public.event_lists where player_id = p_from;

  update public.event_staff es set player_id = p_into
    where es.player_id = p_from
      and not exists (
        select 1 from public.event_staff t
        where t.event_id = es.event_id and t.player_id = p_into);
  delete from public.event_staff where player_id = p_from;

  -- Claims: keep history by repointing, except a pending claim that would
  -- duplicate an existing pending claim from the same requester.
  update public.player_claims pc set player_id = p_into
    where pc.player_id = p_from
      and not (pc.status = 'pending' and exists (
        select 1 from public.player_claims t
        where t.player_id = p_into and t.requested_by = pc.requested_by
          and t.status = 'pending'));
  delete from public.player_claims where player_id = p_from;

  delete from public.players where id = p_from;
end; $$;

grant execute on function public.merge_players(uuid, uuid) to authenticated;
