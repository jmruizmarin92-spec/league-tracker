-- On-site check-in: admins tick a participant off once they're present and
-- have collected their participation prize. Purely informational — it does
-- not gate round generation or anything else, just a roster tally for the TO.

alter table public.session_participants
  add column if not exists checked_in boolean not null default false;

create or replace function public.admin_set_checked_in(
  p_session uuid, p_player uuid, p_checked_in boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  update public.session_participants
    set checked_in = p_checked_in
    where session_id = p_session and player_id = p_player;
end; $$;

grant execute on function public.admin_set_checked_in(uuid, uuid, boolean) to authenticated;
