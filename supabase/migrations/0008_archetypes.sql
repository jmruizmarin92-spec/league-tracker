-- Phase 6: Archetypes.
-- Pokémon come from static app data (data/pokedex.json); this table holds only
-- admin-created CUSTOM entries (e.g. a TCG deck not represented by one Pokémon).
-- A participant's picks are stored as text keys: 'pkm:<dexId>' or 'cst:<uuid>'.

create table if not exists public.archetype_customs (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('tcg', 'vgc')),
  name text not null check (length(trim(name)) > 0),
  icon_url text,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.archetype_customs enable row level security;

create policy "archetype_customs_select_all" on public.archetype_customs
  for select using (true);
create policy "archetype_customs_write_admin" on public.archetype_customs
  for all using (public.is_site_admin()) with check (public.is_site_admin());
grant select on public.archetype_customs to anon, authenticated;
grant insert, update, delete on public.archetype_customs to authenticated;

-- Per-session archetype picks + visibility.
alter table public.session_participants
  add column if not exists archetype1 text,
  add column if not exists archetype2 text,
  add column if not exists archetype_public boolean not null default true;

-- A player sets their own archetypes for a session they're in.
create or replace function public.set_participant_archetypes(
  p_session uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_player uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then raise exception 'No linked player'; end if;
  update public.session_participants
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where session_id = p_session and player_id = v_player;
  if not found then raise exception 'You are not in this session'; end if;
end; $$;

-- A league admin sets a participant's archetypes (e.g. for a managed player).
create or replace function public.admin_set_participant_archetypes(
  p_session uuid, p_player uuid, p_a1 text, p_a2 text, p_public boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  update public.session_participants
    set archetype1 = nullif(p_a1, ''),
        archetype2 = nullif(p_a2, ''),
        archetype_public = coalesce(p_public, true)
    where session_id = p_session and player_id = p_player;
  if not found then raise exception 'Participant not found'; end if;
end; $$;

grant execute on function public.set_participant_archetypes(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_set_participant_archetypes(uuid, uuid, text, text, boolean) to authenticated;
