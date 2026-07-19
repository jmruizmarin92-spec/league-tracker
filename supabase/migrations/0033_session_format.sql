-- Session format info: best-of, planned round count, and round timer length.
-- Purely informational/config, shown at the top of the session page so
-- players know the rules going in. Independent of the per-round runtime
-- timer added in 0032_round_timer.sql (that one tracks the live countdown
-- for a single round; this is the session-wide default admins configure
-- up front, e.g. to know what to punch into that timer each round).

alter table public.sessions
  add column if not exists best_of smallint not null default 3
    check (best_of in (1, 3)),
  add column if not exists rounds_planned integer
    check (rounds_planned is null or rounds_planned > 0),
  add column if not exists round_timer_minutes integer
    check (round_timer_minutes is null or round_timer_minutes > 0);

drop function if exists public.create_session(uuid, text, timestamptz, text, numeric, int);
drop function if exists public.update_session(uuid, timestamptz, text, numeric, int);

create or replace function public.create_session(
  p_league uuid, p_name text, p_starts_at timestamptz,
  p_location text, p_cost numeric, p_capacity int,
  p_best_of smallint, p_rounds_planned int, p_round_timer_minutes int
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_base text; v_slug text; v_n int := 1;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;
  if coalesce(p_best_of, 3) not in (1, 3) then raise exception 'Invalid best_of'; end if;

  v_base := public.session_base_slug(p_name, p_starts_at);
  v_slug := v_base;
  while exists (select 1 from public.sessions where league_id = p_league and slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.sessions (
    league_id, name, starts_at, location, cost, capacity, created_by, slug,
    best_of, rounds_planned, round_timer_minutes
  )
  values (
    p_league,
    nullif(trim(coalesce(p_name, '')), ''),
    p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_cost, 0),
    p_capacity,
    auth.uid(),
    v_slug,
    coalesce(p_best_of, 3),
    p_rounds_planned,
    p_round_timer_minutes
  )
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.update_session(
  p_session uuid,
  p_starts_at timestamptz,
  p_location text,
  p_cost numeric,
  p_capacity int,
  p_best_of smallint,
  p_rounds_planned int,
  p_round_timer_minutes int
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if coalesce(p_best_of, 3) not in (1, 3) then raise exception 'Invalid best_of'; end if;
  update public.sessions set
    starts_at = p_starts_at,
    location = nullif(trim(coalesce(p_location, '')), ''),
    cost = coalesce(p_cost, 0),
    capacity = p_capacity,
    best_of = coalesce(p_best_of, 3),
    rounds_planned = p_rounds_planned,
    round_timer_minutes = p_round_timer_minutes
  where id = p_session;
  perform public.promote_waitlist(p_session);
end; $$;

grant execute on function public.create_session(uuid, text, timestamptz, text, numeric, int, smallint, int, int) to authenticated;
grant execute on function public.update_session(uuid, timestamptz, text, numeric, int, smallint, int, int) to authenticated;
