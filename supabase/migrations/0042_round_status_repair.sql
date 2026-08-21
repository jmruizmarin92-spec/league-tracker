-- Round lifecycle, drops and re-pairing (PL-2).
--
-- 1. rounds.status becomes a real lifecycle:
--      pairing  -> pairings are published, the round has not started; results
--                  cannot be reported and the admin may re-pair the round.
--      playing  -> the round is in progress (set by start_round, or by starting
--                  the timer); results can be reported.
--      complete -> kept in the check for compatibility, unused by the app.
--    The old 'active' value maps to 'playing' (those rounds could already
--    take results, so nothing changes for them).
-- 2. start_round(p_round, p_duration_seconds): pairing -> playing, and starts
--    the round timer in the same call when a duration is given.
-- 3. report_match refuses while the round is 'pairing'.
-- 4. repair_round(p_round, p_pairings): replaces the pairings of a 'pairing'
--    round with a list computed in TypeScript (lib/pairing.ts
--    repairSwissPairings), table numbers included.
-- 5. admin_set_dropped(p_session, p_player, p_dropped): a real drop that keeps
--    the player's matches and standings (dropped_round was in the schema since
--    0006 but nothing set it). leave_session becomes a drop once rounds exist.
-- 6. admin_add_late_participant treats 'pairing'/'playing' as the current
--    round (it used to look for 'active').

-- ---------------------------------------------------------------------------
-- 1. Status values.
-- ---------------------------------------------------------------------------
alter table public.rounds drop constraint if exists rounds_status_check;
update public.rounds set status = 'playing' where status = 'active';
alter table public.rounds
  add constraint rounds_status_check
  check (status in ('pairing', 'playing', 'complete'));
alter table public.rounds alter column status set default 'pairing';

-- create_round: identical to 0030 except the round is created as 'pairing'.
create or replace function public.create_round(p_session uuid, p_pairings jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_round uuid; v_num int; v_pair jsonb; v_table int := 0;
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.matches where session_id = p_session and result = 'pending'
  ) then
    raise exception 'Hay partidas sin resultado en la ronda actual';
  end if;

  select coalesce(max(number), 0) + 1 into v_num
  from public.rounds where session_id = p_session;

  insert into public.rounds (session_id, number, status)
  values (p_session, v_num, 'pairing') returning id into v_round;

  for v_pair in select * from jsonb_array_elements(p_pairings) loop
    if v_pair->>'player2' is null then
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, result, reported_at, table_number)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, null, 'bye', now(), null);
    else
      v_table := v_table + 1;
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, table_number)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, (v_pair->>'player2')::uuid, v_table);
    end if;
  end loop;

  update public.sessions set status = 'active'
  where id = p_session and status = 'setup';

  return v_round;
end; $$;

-- ---------------------------------------------------------------------------
-- 2. Start the round (pairing -> playing), optionally starting the timer.
-- ---------------------------------------------------------------------------
create or replace function public.start_round(p_round uuid, p_duration_seconds int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_status text;
begin
  select session_id, status into v_session, v_status
  from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;
  if v_status <> 'pairing' then
    raise exception 'La ronda ya ha empezado';
  end if;

  update public.rounds set status = 'playing' where id = p_round;

  if p_duration_seconds is not null and p_duration_seconds > 0 then
    update public.rounds set
      timer_duration_seconds = p_duration_seconds,
      timer_ends_at = now() + make_interval(secs => p_duration_seconds),
      timer_remaining_seconds = null
    where id = p_round;
  end if;
end; $$;

-- Starting the timer on its own also counts as starting the round: a clock
-- running over published pairings would be a contradiction.
create or replace function public.start_round_timer(p_round uuid, p_duration_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Invalid duration';
  end if;
  select session_id into v_session from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;

  update public.rounds set
    status = case when status = 'pairing' then 'playing' else status end,
    timer_duration_seconds = p_duration_seconds,
    timer_ends_at = now() + make_interval(secs => p_duration_seconds),
    timer_remaining_seconds = null
  where id = p_round;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. No results before the round starts.
-- ---------------------------------------------------------------------------
create or replace function public.report_match(p_match uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_p1 uuid; v_p2 uuid; v_me uuid; v_round_status text;
begin
  if p_result not in ('p1_win', 'p2_win', 'draw') then
    raise exception 'Invalid result';
  end if;
  select m.session_id, m.player1_id, m.player2_id, r.status
    into v_session, v_p1, v_p2, v_round_status
  from public.matches m join public.rounds r on r.id = m.round_id
  where m.id = p_match;
  if v_session is null then raise exception 'Match not found'; end if;
  if v_round_status = 'pairing' then
    raise exception 'La ronda aún no ha empezado';
  end if;

  select id into v_me from public.players where user_id = auth.uid();
  if not (
    public.is_league_admin(public.session_league(v_session))
    or v_me = v_p1 or v_me = v_p2
  ) then
    raise exception 'Not allowed';
  end if;

  update public.matches
    set result = p_result, reported_by = auth.uid(), reported_at = now()
  where id = p_match;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Re-pair a round that has not started.
-- p_pairings: jsonb array of { "player1": uuid, "player2": uuid|null,
--             "table": int|null }, already seated by the caller. The round's
--             pending and bye matches are replaced wholesale; anything else
--             (a 'loss' row, a reported result — neither should exist while
--             pairing, but be safe) is left alone.
-- ---------------------------------------------------------------------------
create or replace function public.repair_round(p_round uuid, p_pairings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_status text; v_pair jsonb;
begin
  select session_id, status into v_session, v_status
  from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;
  if v_status <> 'pairing' then
    raise exception 'Solo se puede reemparejar una ronda que no ha empezado';
  end if;

  delete from public.matches
  where round_id = p_round and result in ('pending', 'bye');

  for v_pair in select * from jsonb_array_elements(p_pairings) loop
    if v_pair->>'player2' is null then
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, result, reported_at, table_number)
      values
        (p_round, v_session, (v_pair->>'player1')::uuid, null, 'bye', now(), null);
    else
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, table_number)
      values
        (p_round, v_session, (v_pair->>'player1')::uuid, (v_pair->>'player2')::uuid,
         (v_pair->>'table')::int);
    end if;
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- 5. Drop / undrop. dropped_round = number of the current round at the time
--    of the drop (0 before any round). A dropped player keeps every match and
--    stays in the standings; they just leave the active roster, so the next
--    round (or a re-pair of the current one) no longer seats them.
-- ---------------------------------------------------------------------------
create or replace function public.drop_participant(p_session uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cur int;
begin
  select coalesce(max(number), 0) into v_cur
  from public.rounds where session_id = p_session;
  update public.session_participants
    set dropped_round = v_cur
  where session_id = p_session and player_id = p_player and dropped_round is null;
end; $$;

-- Internal helper: no admin check of its own, so it must not be reachable
-- through the API (Supabase grants execute to the API roles by default).
revoke execute on function public.drop_participant(uuid, uuid) from public, anon, authenticated;

create or replace function public.admin_set_dropped(p_session uuid, p_player uuid, p_dropped boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if p_dropped then
    perform public.drop_participant(p_session, p_player);
  else
    update public.session_participants
      set dropped_round = null
    where session_id = p_session and player_id = p_player;
  end if;
end; $$;

-- Leaving on your own once rounds exist is a drop (history kept), not a delete.
create or replace function public.leave_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text;
begin
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then return; end if;
  select status into v_status from public.session_participants
    where session_id = p_session and player_id = v_player;
  if v_status = 'registered'
     and exists (select 1 from public.rounds where session_id = p_session) then
    perform public.drop_participant(p_session, v_player);
    return;
  end if;
  delete from public.session_participants
    where session_id = p_session and player_id = v_player;
  perform public.promote_waitlist(p_session);
end; $$;

-- ---------------------------------------------------------------------------
-- 6. Late participants: the "current round" is any round that is not complete.
-- ---------------------------------------------------------------------------
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
  if p_entry = 'current' and v_cur_status in ('pairing', 'playing') then
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
  elsif p_entry = 'bye' and v_cur_status in ('pairing', 'playing') then
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

grant execute on function public.create_round(uuid, jsonb) to authenticated;
grant execute on function public.start_round(uuid, int) to authenticated;
grant execute on function public.start_round_timer(uuid, int) to authenticated;
grant execute on function public.report_match(uuid, text) to authenticated;
grant execute on function public.repair_round(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_dropped(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.admin_add_late_participant(uuid, uuid, text, text)
  to authenticated;
