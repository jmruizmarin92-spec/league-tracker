-- Once a session is complete, a player can no longer edit their own archetype
-- picks — they're locked in as tournament history. The one exception is a
-- participant who never recorded anything (both slots still null): they can
-- still add one after the fact. League admins are unaffected and can always
-- correct/edit any participant's archetypes, even after completion.

create or replace function public.set_participant_archetypes(
  p_session uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text; v_a1 text; v_a2 text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;

  select s.status, sp.archetype1, sp.archetype2
    into v_status, v_a1, v_a2
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
    where sp.session_id = p_session and sp.player_id = v_player;
  if not found then raise exception 'You are not in this session'; end if;

  if v_status = 'complete' and (v_a1 is not null or v_a2 is not null) then
    raise exception 'Session is complete; archetype is locked';
  end if;

  update public.session_participants
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where session_id = p_session and player_id = v_player;
end; $$;
