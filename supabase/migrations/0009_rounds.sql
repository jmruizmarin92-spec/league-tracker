-- Phase 7: Rounds and matches (Swiss). Pairing/scoring run in TypeScript
-- (lib/pairing.ts, lib/scoring.ts); these tables just persist the results.

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  number integer not null,
  status text not null default 'active' check (status in ('active', 'complete')),
  created_at timestamptz not null default now(),
  unique (session_id, number)
);
alter table public.rounds enable row level security;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  player1_id uuid not null references public.players (id) on delete cascade,
  player2_id uuid references public.players (id) on delete cascade, -- null = bye
  result text not null default 'pending'
    check (result in ('pending', 'p1_win', 'p2_win', 'draw', 'bye')),
  reported_by uuid references auth.users (id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.matches enable row level security;

create policy "rounds_select_all" on public.rounds for select using (true);
grant select on public.rounds to anon, authenticated;

create policy "matches_select_all" on public.matches for select using (true);
grant select on public.matches to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs.
-- ---------------------------------------------------------------------------

-- Create the next round from a computed pairing list.
-- p_pairings: jsonb array of { "player1": uuid, "player2": uuid|null }.
create or replace function public.create_round(p_session uuid, p_pairings jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_round uuid; v_num int; v_pair jsonb;
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.matches where session_id = p_session and result = 'pending'
  ) then
    raise exception 'Hay partidas sin resultado en la ronda actual';
  end if;

  select coalesce(max(number), 0) + 1 into v_num
  from public.rounds where session_id = p_session;

  insert into public.rounds (session_id, number)
  values (p_session, v_num) returning id into v_round;

  for v_pair in select * from jsonb_array_elements(p_pairings) loop
    if v_pair->>'player2' is null then
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, result, reported_at)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, null, 'bye', now());
    else
      insert into public.matches
        (round_id, session_id, player1_id, player2_id)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, (v_pair->>'player2')::uuid);
    end if;
  end loop;

  update public.sessions set status = 'active'
  where id = p_session and status = 'setup';

  return v_round;
end; $$;

-- Report a match result. Allowed for the two participants or a league admin.
create or replace function public.report_match(p_match uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_p1 uuid; v_p2 uuid; v_me uuid;
begin
  if p_result not in ('p1_win', 'p2_win', 'draw') then
    raise exception 'Invalid result';
  end if;
  select session_id, player1_id, player2_id into v_session, v_p1, v_p2
  from public.matches where id = p_match;
  if v_session is null then raise exception 'Match not found'; end if;

  select id into v_me from public.players where user_id = auth.uid();
  if not (
    public.is_league_admin(public.session_league(v_session))
    or v_me = v_p1 or v_me = v_p2
  ) then
    raise exception 'Not allowed';
  end if;

  update public.matches
    set result = p_result, reported_by = auth.uid(), reported_at = now()
  where id = p_match;
end; $$;

-- Delete a round (admin) — used to regenerate pairings.
create or replace function public.delete_round(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  select session_id into v_session from public.rounds where id = p_round;
  if v_session is null then raise exception 'Round not found'; end if;
  if not public.is_league_admin(public.session_league(v_session)) then
    raise exception 'Not allowed';
  end if;
  delete from public.rounds where id = p_round;
end; $$;

grant execute on function public.create_round(uuid, jsonb) to authenticated;
grant execute on function public.report_match(uuid, text) to authenticated;
grant execute on function public.delete_round(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend player merge to carry match history (now that matches exist).
-- ---------------------------------------------------------------------------
create or replace function public.merge_players(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if p_from = p_into then raise exception 'Cannot merge a player into itself'; end if;
  if not exists (select 1 from public.players where id = p_from) then
    raise exception 'Source player not found';
  end if;
  if not exists (select 1 from public.players where id = p_into) then
    raise exception 'Target player not found';
  end if;

  update public.player_claims set player_id = p_into where player_id = p_from;
  update public.matches set player1_id = p_into where player1_id = p_from;
  update public.matches set player2_id = p_into where player2_id = p_from;
  -- Keep the target's session rows; drop the source's to avoid PK clashes.
  delete from public.session_participants where player_id = p_from;

  delete from public.players where id = p_from;
end; $$;
