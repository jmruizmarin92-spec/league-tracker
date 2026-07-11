-- Let a player flip only their archetype visibility (instant toggle),
-- without touching their archetype picks.
create or replace function public.set_archetype_visibility(
  p_session uuid, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;
  update public.session_participants
    set archetype_public = coalesce(p_public, true)
    where session_id = p_session and player_id = v_player;
end; $$;

grant execute on function public.set_archetype_visibility(uuid, boolean) to authenticated;
