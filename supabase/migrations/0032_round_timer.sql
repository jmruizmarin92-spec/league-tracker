-- Per-round countdown timer, customizable by the admin, visible to players on
-- the session page and the live display. State lives entirely on `rounds` so
-- it rides the existing realtime subscription (0013_realtime_display.sql)
-- without any new publication wiring.
--
-- timer_duration_seconds: last length the admin set (kept after pause/resume
--   so the UI can show what was configured; cleared on reset).
-- timer_ends_at: absolute end time while running; null when paused or idle.
-- timer_remaining_seconds: seconds left, captured at the moment of pause;
--   null while running or idle.
-- Exactly one of timer_ends_at / timer_remaining_seconds is non-null while a
-- timer is active; both are null when idle.

alter table public.rounds add column if not exists timer_duration_seconds integer;
alter table public.rounds add column if not exists timer_ends_at timestamptz;
alter table public.rounds add column if not exists timer_remaining_seconds integer;

-- Start (or restart with a new length) the round's timer.
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
    timer_duration_seconds = p_duration_seconds,
    timer_ends_at = now() + make_interval(secs => p_duration_seconds),
    timer_remaining_seconds = null
  where id = p_round;
end; $$;

-- Freeze the countdown where it stands.
create or replace function public.pause_round_timer(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_ends_at timestamptz;
begin
  select session_id, timer_ends_at into v_session, v_ends_at
  from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;
  if v_ends_at is null then return; end if;

  update public.rounds set
    timer_remaining_seconds = greatest(0, extract(epoch from (v_ends_at - now()))::int),
    timer_ends_at = null
  where id = p_round;
end; $$;

-- Resume a paused countdown from where it was frozen.
create or replace function public.resume_round_timer(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_remaining int;
begin
  select session_id, timer_remaining_seconds into v_session, v_remaining
  from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;
  if v_remaining is null then return; end if;

  update public.rounds set
    timer_ends_at = now() + make_interval(secs => v_remaining),
    timer_remaining_seconds = null
  where id = p_round;
end; $$;

-- Stop and clear the timer entirely.
create or replace function public.clear_round_timer(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  select session_id into v_session from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;

  update public.rounds set
    timer_duration_seconds = null,
    timer_ends_at = null,
    timer_remaining_seconds = null
  where id = p_round;
end; $$;

grant execute on function public.start_round_timer(uuid, int) to authenticated;
grant execute on function public.pause_round_timer(uuid) to authenticated;
grant execute on function public.resume_round_timer(uuid) to authenticated;
grant execute on function public.clear_round_timer(uuid) to authenticated;
