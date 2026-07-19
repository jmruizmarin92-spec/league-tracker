-- Self-join (Apuntarme) should only work while a session hasn't started yet.
-- Once an admin moves it to "active", late players must be added by an admin
-- (admin_add_participant / admin_add_late_participant, both unrestricted by
-- status besides the existing 'complete' check in add_participant). Dropping
-- out via leave_session stays available at any point before completion.

create or replace function public.join_session(p_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'You have no linked player'; end if;
  select status into v_status from public.sessions where id = p_session;
  if v_status <> 'setup' then
    raise exception 'Session has already started; ask an admin to add you';
  end if;
  return public.add_participant(p_session, v_player);
end; $$;
