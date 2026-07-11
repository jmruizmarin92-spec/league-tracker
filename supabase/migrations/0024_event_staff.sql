-- Staff (judges, scorekeepers, general helpers) for independent events —
-- lets an organizer see at a glance who helped run a tournament, for
-- reporting to the Pokémon organized-play site. Reuses the players table
-- (same identity as competitors); role is free text since Play! Pokémon
-- titles vary (Head Judge, Judge, Scorekeeper, Staff...).
create table if not exists public.event_staff (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text not null check (length(trim(role)) > 0),
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
alter table public.event_staff enable row level security;

create policy "event_staff_select_all" on public.event_staff for select using (true);
grant select on public.event_staff to anon, authenticated;

-- Add an existing player as staff (or update their role if already staff).
create or replace function public.add_event_staff(p_event uuid, p_player uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_role), '') = '' then raise exception 'Role required'; end if;
  insert into public.event_staff (event_id, player_id, role)
  values (p_event, p_player, trim(p_role))
  on conflict (event_id, player_id) do update set role = excluded.role;
end; $$;

-- Create a managed player (for staff who aren't already in the system) and
-- add them as staff in one step, mirroring create_session_player.
create or replace function public.create_event_staff_player(p_event uuid, p_name text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if coalesce(trim(p_role), '') = '' then raise exception 'Role required'; end if;
  insert into public.players (display_name, created_by)
  values (trim(p_name), auth.uid())
  returning id into v_id;
  insert into public.event_staff (event_id, player_id, role)
  values (p_event, v_id, trim(p_role));
  return v_id;
end; $$;

create or replace function public.remove_event_staff(p_event uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event) then raise exception 'Not allowed'; end if;
  delete from public.event_staff where event_id = p_event and player_id = p_player;
end; $$;

grant execute on function public.add_event_staff(uuid, uuid, text) to authenticated;
grant execute on function public.create_event_staff_player(uuid, text, text) to authenticated;
grant execute on function public.remove_event_staff(uuid, uuid) to authenticated;
