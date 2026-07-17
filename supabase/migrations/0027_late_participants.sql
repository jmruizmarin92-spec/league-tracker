-- Phase: late participants. An admin adds a player after rounds have started
-- and chooses, per add: (a) whether the player takes a LOSS for each already
-- played round or joins with NO penalty, and (b) whether they enter the CURRENT
-- round (by filling an existing bye) or START next round.
--
-- `session_participants.joined_round` (defined in 0006 but never written until
-- now) is finally stamped so standings/history reflect when a player entered.

-- ---------------------------------------------------------------------------
-- 1. Allow a solo 'loss' match record — the mirror image of a 'bye'.
--    (player2_id null, result 'loss' => player1 played a round and lost 0-pts.)
-- ---------------------------------------------------------------------------
alter table public.matches drop constraint if exists matches_result_check;
alter table public.matches add constraint matches_result_check
  check (result in ('pending', 'p1_win', 'p2_win', 'draw', 'bye', 'loss'));

-- ---------------------------------------------------------------------------
-- 2. Late-add RPC.
--    p_missed:       'loss' | 'none'
--    p_join_current: true  => try to enter the current active round by filling
--                             its bye; if there is no bye, fall back to next
--                             round. false => always start next round.
--    Returns the participant status ('registered' | 'waitlisted'). Late
--    treatment is only applied to a registered player once rounds exist.
-- ---------------------------------------------------------------------------
create or replace function public.admin_add_late_participant(
  p_session uuid,
  p_player uuid,
  p_missed text,
  p_join_current boolean
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

  -- Join the current round only if asked AND there is a bye to fill.
  if p_join_current and v_cur_status = 'active' then
    select id into v_bye_match
    from public.matches
    where round_id = v_cur_round and result = 'bye'
    limit 1;

    if v_bye_match is not null then
      -- Pair the late player against the bye-holder: the free win is revoked
      -- and the match becomes a normal pending game.
      update public.matches
        set player2_id = p_player, result = 'pending',
            reported_by = null, reported_at = null
      where id = v_bye_match;
      v_joined := v_cur;
    end if;
    -- No bye to fill => leave v_joined at v_cur + 1 (deferred to next round).
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

grant execute on function public.admin_add_late_participant(uuid, uuid, text, boolean)
  to authenticated;
