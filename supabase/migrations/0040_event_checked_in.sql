-- On-site check-in for standalone events, mirroring 0037 for sessions: admins
-- tick a registrant off once they're present. Purely informational — nothing
-- is gated on it, it's just a roster tally for the TO.

alter table public.event_registrations
  add column if not exists checked_in boolean not null default false;

create or replace function public.admin_set_event_checked_in(
  p_event uuid, p_player uuid, p_checked_in boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then
    raise exception 'Not allowed';
  end if;
  update public.event_registrations
    set checked_in = p_checked_in
    where event_id = p_event and player_id = p_player;
end; $$;

grant execute on function public.admin_set_event_checked_in(uuid, uuid, boolean) to authenticated;
