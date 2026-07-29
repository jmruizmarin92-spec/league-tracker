-- Tracks which quarterly/yearly prize pools have been marked as handed out.
-- The pool size and leader are still computed live from session attendance
-- (lib/prize-pool.ts, lib/league-standings.ts) — this table only snapshots
-- what was awarded and to whom once an admin confirms it. Admin-only
-- bookkeeping, not shown to players.
create table if not exists public.league_prize_awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  scope text not null check (scope in ('q1', 'q2', 'q3', 'q4', 'year')),
  winner_player_id uuid references public.players (id) on delete set null,
  packs integer not null check (packs >= 0),
  awarded_by uuid references auth.users (id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (league_id, scope)
);

alter table public.league_prize_awards enable row level security;

create policy "league_prize_awards_select_admin" on public.league_prize_awards
  for select using (public.is_league_admin(league_id));
create policy "league_prize_awards_insert_admin" on public.league_prize_awards
  for insert with check (public.is_league_admin(league_id));
create policy "league_prize_awards_delete_admin" on public.league_prize_awards
  for delete using (public.is_league_admin(league_id));

grant select, insert, delete on public.league_prize_awards to authenticated;
