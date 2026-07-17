-- Phase: late participants — extra entry mode. On top of filling an existing
-- bye (playing the bye-holder) or starting next round, an admin can now GIVE
-- the late player a bye (a free win) for the current round. Use this when the
-- player's absence was an admin mistake and they deserve a penalty-free free
-- win rather than a real game.
--
-- The entry option changes from a boolean (p_join_current) to a text mode
-- (p_entry): 'next' | 'current' | 'bye'. The old signature is dropped because
-- the argument types change (create-or-replace can't alter them).

drop function if exists public.admin_add_late_participant(uuid, uuid, text, boolean);

create or replace function public.admin_add_late_participant(
  p_session uuid,
  p_player uuid,
  p_missed text,
  p_entry text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_cur int;
  v_cur_round uuid;
  v_cur_status text;
  v_joined int;
  v_bye_match uuid;
  v_r record;
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if p_missed not in ('loss', 'none') then
    raise exception 'Invalid missed-round option';
  end if;
  if p_entry not in ('next', 'current', 'bye') then
    raise exception 'Invalid entry option';
  end if;

  -- Insert the participant (respects capacity/waitlist like a normal add).
  v_status := public.add_participant(p_session, p_player);

  select number, id, status into v_cur, v_cur_round, v_cur_status
  from public.rounds where session_id = p_session
  order by number desc limit 1;

  -- Waitlisted, or no rounds yet: behave exactly like a normal add.
  if v_status <> 'registered' or v_cur is null then
    return v_status;
  end if;

  -- Default: the late player starts the next round.
  v_joined := v_cur + 1;

  -- 'current': enter the current round by filling its bye. Pair the late
  -- player against the bye-holder: the free win is revoked and the match
  -- becomes a normal pending game. No bye to fill => deferred to next round.
  if p_entry = 'current' and v_cur_status = 'active' then
    select id into v_bye_match
    from public.matches
    where round_id = v_cur_round and result = 'bye'
    limit 1;

    if v_bye_match is not null then
      update public.matches
        set player2_id = p_player, result = 'pending',
            reported_by = null, reported_at = null
      where id = v_bye_match;
      v_joined := v_cur;
    end if;

  -- 'bye': hand the late player a bye (free win) for the current round. Used
  -- when their absence was an admin mistake — a penalty-free compensation.
  -- Other players' pairings are untouched.
  elsif p_entry = 'bye' and v_cur_status = 'active' then
    insert into public.matches
      (round_id, session_id, player1_id, player2_id, result, reported_at)
    values
      (v_cur_round, p_session, p_player, null, 'bye', now());
    v_joined := v_cur;
  end if;

  update public.session_participants
    set joined_round = v_joined
  where session_id = p_session and player_id = p_player;

  -- Record a loss for every round already played before they joined.
  if p_missed = 'loss' then
    for v_r in
      select id from public.rounds
      where session_id = p_session and number < v_joined
      order by number
    loop
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, result, reported_at)
      values
        (v_r.id, p_session, p_player, null, 'loss', now());
    end loop;
  end if;

  return v_status;
end; $$;

grant execute on function public.admin_add_late_participant(uuid, uuid, text, text)
  to authenticated;
