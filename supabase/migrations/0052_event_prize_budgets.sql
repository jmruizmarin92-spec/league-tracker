-- PL-29: prize budget for standalone events (cups above all).
--
-- Two private tables: what a store usually keeps per player (venue cut,
-- judge cut, entry pack) so a new cup starts prefilled, and the budget the
-- TO settles on for one event (same per-player figures, fixed extra costs,
-- prize kind, top cut and the percentage per placing). The maths itself is
-- pure TypeScript (lib/event-prizes.ts); the player count comes from the
-- players imported from TOM (event_tdf_players), nothing is snapshotted.
--
-- Both tables are admin-only through RLS: `events` and `stores` are
-- world-readable, and the venue/judge cuts are nobody else's business. The
-- public outcome is the summary the TO chooses to publish into events.prizes.

create table if not exists public.store_prize_defaults (
  store_id uuid primary key references public.stores (id) on delete cascade,
  venue_fee numeric not null default 0 check (venue_fee >= 0),
  judge_fee numeric not null default 0 check (judge_fee >= 0),
  entry_pack boolean not null default false,
  pack_value numeric not null default 0 check (pack_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.store_prize_defaults enable row level security;

create policy "store_prize_defaults_select_admin" on public.store_prize_defaults
  for select using (public.is_store_admin(store_id));
create policy "store_prize_defaults_insert_admin" on public.store_prize_defaults
  for insert with check (public.is_store_admin(store_id));
create policy "store_prize_defaults_update_admin" on public.store_prize_defaults
  for update using (public.is_store_admin(store_id))
  with check (public.is_store_admin(store_id));
create policy "store_prize_defaults_delete_admin" on public.store_prize_defaults
  for delete using (public.is_store_admin(store_id));

grant select, insert, update, delete on public.store_prize_defaults to authenticated;

create table if not exists public.event_prize_budgets (
  event_id uuid primary key references public.events (id) on delete cascade,
  venue_fee numeric not null default 0 check (venue_fee >= 0),
  judge_fee numeric not null default 0 check (judge_fee >= 0),
  entry_pack boolean not null default false,
  pack_value numeric not null default 0 check (pack_value >= 0),
  extra_costs numeric not null default 0 check (extra_costs >= 0),
  extra_costs_note text,
  prize_kind text not null default 'packs' check (prize_kind in ('packs', 'cash')),
  top_cut integer not null default 8 check (top_cut between 1 and 64),
  -- One integer percentage (or weight) per placing, top_cut entries.
  shares integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.event_prize_budgets enable row level security;

create policy "event_prize_budgets_select_admin" on public.event_prize_budgets
  for select using (public.is_event_admin(event_id));
create policy "event_prize_budgets_insert_admin" on public.event_prize_budgets
  for insert with check (public.is_event_admin(event_id));
create policy "event_prize_budgets_update_admin" on public.event_prize_budgets
  for update using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));
create policy "event_prize_budgets_delete_admin" on public.event_prize_budgets
  for delete using (public.is_event_admin(event_id));

grant select, insert, update, delete on public.event_prize_budgets to authenticated;
