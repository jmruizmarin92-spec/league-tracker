-- Phase 3 revision: player profile fields, auto-create player on signup,
-- and claim-as-merge.

-- ---------------------------------------------------------------------------
-- New player fields. `display_name` continues to hold the Alias (the name
-- shown in pairings). The rest are optional profile details.
-- ---------------------------------------------------------------------------
alter table public.players
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists pokemon_id text,
  add column if not exists game_id text;

-- ---------------------------------------------------------------------------
-- Auto-provision BOTH a profile and a linked player when an account is created.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url, is_admin)
  values (
    new.id,
    v_name,
    new.raw_user_meta_data->>'avatar_url',
    exists (
      select 1 from public.admin_allowlist a
      where lower(a.email) = lower(new.email)
    )
  )
  on conflict (id) do nothing;

  insert into public.players (display_name, user_id, created_by)
  values (v_name, new.id, new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill: give every existing account a linked player if it lacks one.
insert into public.players (display_name, user_id, created_by)
select p.display_name, p.id, p.id
from public.profiles p
where not exists (
  select 1 from public.players pl where pl.user_id = p.id
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Claiming now means "link an admin-created managed player to me" — even though
-- I already have an auto-created player. On approval we merge my auto-player
-- into the managed one (which holds the real name/history) and link it to me.
-- ---------------------------------------------------------------------------

-- Anyone may request to claim an unclaimed (managed) player.
create or replace function public.request_player_claim(p_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.players where id = p_player_id and user_id is null
  ) then
    raise exception 'Player not available to claim';
  end if;
  insert into public.player_claims (player_id, requested_by)
  values (p_player_id, auth.uid())
  on conflict do nothing
  returning id into v_id;
  return v_id;
end; $$;

-- Approve = merge the requester's auto-player into the managed player, link it.
create or replace function public.approve_player_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_managed uuid; v_user uuid; v_own uuid;
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;

  select player_id, requested_by into v_managed, v_user
  from public.player_claims where id = p_claim_id and status = 'pending';
  if v_managed is null then raise exception 'Claim not found or already resolved'; end if;
  if exists (select 1 from public.players where id = v_managed and user_id is not null) then
    raise exception 'Player already claimed';
  end if;

  -- The requester's current auto-player (if any).
  select id into v_own from public.players where user_id = v_user;

  -- Merge the auto-player into the managed player, then link it to the user.
  -- (Extend here to reassign session/match history as those tables arrive.)
  if v_own is not null and v_own <> v_managed then
    delete from public.players where id = v_own; -- cascades its own claims; frees user_id
  end if;

  update public.players set user_id = v_user where id = v_managed;

  update public.player_claims
    set status = 'approved', resolved_by = auth.uid(), resolved_at = now()
    where id = p_claim_id;

  update public.player_claims
    set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
    where player_id = v_managed and status = 'pending' and id <> p_claim_id;
end; $$;
