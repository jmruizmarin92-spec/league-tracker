-- Revert: category (Cup/Challenge/Demo/Otros) is for independent events
-- only, not league sessions. Drop the column and the session-category RPCs
-- added in 0016, and restore create_session to its pre-category signature.
drop function if exists public.set_session_category(uuid, text);

drop function if exists public.create_session(uuid, text, timestamptz, text, numeric, int, text);

create function public.create_session(
  p_league uuid, p_name text, p_starts_at timestamptz,
  p_location text, p_cost numeric, p_capacity int
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_admin(p_league) then raise exception 'Not allowed'; end if;
  insert into public.sessions (league_id, name, starts_at, location, cost, capacity, created_by)
  values (
    p_league,
    nullif(trim(coalesce(p_name, '')), ''),
    p_starts_at,
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_cost, 0),
    p_capacity,
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.create_session(uuid, text, timestamptz, text, numeric, int) to authenticated;

alter table public.sessions drop column if exists category;
