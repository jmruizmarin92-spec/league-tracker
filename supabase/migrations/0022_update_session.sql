-- Let league admins edit a session's details (date, location, cost, capacity)
-- after creation. Mirrors create_session's validation/normalisation. Raising
-- capacity may free waitlist slots, so we re-run promote_waitlist.
create or replace function public.update_session(
  p_session uuid,
  p_starts_at timestamptz,
  p_location text,
  p_cost numeric,
  p_capacity int
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  update public.sessions set
    starts_at = p_starts_at,
    location = nullif(trim(coalesce(p_location, '')), ''),
    cost = coalesce(p_cost, 0),
    capacity = p_capacity
  where id = p_session;
  perform public.promote_waitlist(p_session);
end; $$;

grant execute on function public.update_session(uuid, timestamptz, text, numeric, int) to authenticated;
