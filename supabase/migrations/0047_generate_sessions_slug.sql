-- Fix: "Generar sesiones" (generate_league_sessions, 0025) still inserted
-- sessions without a slug. 0031 made sessions.slug not null and taught
-- create_session to assign one, but never touched the bulk generator, so
-- every click since then failed with:
--   null value in column "slug" of relation "sessions" violates not-null constraint
--
-- Same slug rule as create_session (0031/0033): base is the session date
-- via session_base_slug(), deduped per league with a -2, -3... suffix.
-- Body is otherwise identical to 0025 (idempotent on starts_at, range =
-- max(starts_month, today) .. end of ends_month, Europe/Madrid).

create or replace function public.generate_league_sessions(p_league uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_league record;
  v_range_start date;
  v_range_end date;
  v_day date;
  v_starts_at timestamptz;
  v_base text;
  v_slug text;
  v_n int;
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
      v_base := public.session_base_slug(null, v_starts_at);
      v_slug := v_base;
      v_n := 1;
      while exists (
        select 1 from public.sessions where league_id = p_league and slug = v_slug
      ) loop
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
      end loop;

      insert into public.sessions (league_id, starts_at, location, cost, created_by, slug)
      values (p_league, v_starts_at, v_league.default_location, v_league.default_cost, auth.uid(), v_slug);
      v_created := v_created + 1;
    end if;
    v_day := v_day + 7;
  end loop;

  return v_created;
end; $$;

grant execute on function public.generate_league_sessions(uuid) to authenticated;
