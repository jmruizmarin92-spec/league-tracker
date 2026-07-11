-- Leagues that meet on a fixed weekday/time each week (e.g. "War Lotus is
-- always Fridays at 16:30") can now record that schedule and bulk-generate
-- sessions for the league's date range in one click, instead of creating
-- each week's session by hand.
alter table public.leagues
  add column if not exists session_weekday smallint
    check (session_weekday is null or session_weekday between 0 and 6),
  add column if not exists session_time time,
  add column if not exists default_cost numeric(8, 2) not null default 0;

-- Creates one session per occurrence of the league's weekday/time between
-- today (or starts_month, whichever is later) and the end of ends_month.
-- Idempotent: re-running skips any timestamp that already has a session for
-- this league, so it's safe to click again after changing the date range.
create or replace function public.generate_league_sessions(p_league uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_league record;
  v_range_start date;
  v_range_end date;
  v_day date;
  v_starts_at timestamptz;
  v_created int := 0;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;

  select * into v_league from public.leagues where id = p_league;
  if v_league.session_weekday is null or v_league.session_time is null then
    raise exception 'Set a weekly day and time first';
  end if;
  if v_league.starts_month is null or v_league.ends_month is null then
    raise exception 'League has no date range set';
  end if;

  v_range_start := greatest(v_league.starts_month, current_date);
  v_range_end := (date_trunc('month', v_league.ends_month) + interval '1 month' - interval '1 day')::date;
  if v_range_start > v_range_end then
    return 0;
  end if;

  v_day := v_range_start + (((v_league.session_weekday - extract(dow from v_range_start)::int) + 7) % 7);

  while v_day <= v_range_end loop
    v_starts_at := (v_day + v_league.session_time) at time zone 'Europe/Madrid';
    if not exists (
      select 1 from public.sessions
      where league_id = p_league and starts_at = v_starts_at
    ) then
      insert into public.sessions (league_id, starts_at, location, cost, created_by)
      values (p_league, v_starts_at, v_league.default_location, v_league.default_cost, auth.uid());
      v_created := v_created + 1;
    end if;
    v_day := v_day + 7;
  end loop;

  return v_created;
end; $$;

grant execute on function public.generate_league_sessions(uuid) to authenticated;
