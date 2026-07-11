-- Phase 5 refinements: league locations (venue picklist + default),
-- and create-a-player-directly-into-a-session.

-- League venue list + default venue. Sessions pick their location from these.
alter table public.leagues
  add column if not exists locations text[] not null default '{}',
  add column if not exists default_location text;

-- Create a managed player and add it to a session in one step.
-- Allowed for LEAGUE admins (not only site admins), for convenience when
-- running a session. The player is global, like any other.
create or replace function public.create_session_player(p_session uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  insert into public.players (display_name, created_by)
  values (trim(p_name), auth.uid())
  returning id into v_id;
  return public.add_participant(p_session, v_id);
end; $$;

grant execute on function public.create_session_player(uuid, text) to authenticated;
