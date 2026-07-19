-- Archetype picks for independent events, mirroring league sessions
-- (0008_archetypes.sql, 0012_archetype_visibility.sql, 0034_lock_archetypes.sql)
-- but scoped to event_registrations instead of session_participants.

alter table public.event_registrations
  add column if not exists archetype1 text,
  add column if not exists archetype2 text,
  add column if not exists archetype_public boolean not null default true;

-- A player sets their own archetypes for an event they're registered in.
-- Once the event is complete, a pick they already recorded is locked in as
-- history; the one exception is a registration that never recorded anything
-- (both slots still null) — they can still add one after the fact. Event
-- admins are unaffected and can always correct/edit any participant's picks.
create or replace function public.set_event_archetypes(
  p_event uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text; v_a1 text; v_a2 text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;

  select e.status, er.archetype1, er.archetype2
    into v_status, v_a1, v_a2
    from public.event_registrations er
    join public.events e on e.id = er.event_id
    where er.event_id = p_event and er.player_id = v_player;
  if not found then raise exception 'You are not registered for this event'; end if;

  if v_status = 'complete' and (v_a1 is not null or v_a2 is not null) then
    raise exception 'Event is complete; archetype is locked';
  end if;

  update public.event_registrations
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where event_id = p_event and player_id = v_player;
end; $$;

-- An event admin sets a participant's archetypes (e.g. for a managed player,
-- or correcting one on someone's behalf), unrestricted by the lock above.
create or replace function public.admin_set_event_archetypes(
  p_event uuid, p_player uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  update public.event_registrations
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where event_id = p_event and player_id = p_player;
  if not found then raise exception 'Registration not found'; end if;
end; $$;

create or replace function public.set_event_archetype_visibility(
  p_event uuid, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;
  update public.event_registrations
    set archetype_public = coalesce(p_public, true)
    where event_id = p_event and player_id = v_player;
end; $$;

grant execute on function public.set_event_archetypes(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_set_event_archetypes(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.set_event_archetype_visibility(uuid, boolean) to authenticated;
