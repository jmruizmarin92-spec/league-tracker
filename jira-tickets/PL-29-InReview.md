# PL-29 — Prize budget calculator for cups and other standalone events

Status: In Review | Type: Feature | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

Original ask (2026-09-06): auto-calculate the prizes of non-league events (cups above all). Track per player the prize money, the venue cut and the judge cut, whether everyone gets an inscription pack and what that pack costs, and work out what is left and how to split it across the top cut, in packs or in money.

Clarified: the player count is the one imported from TOM (`.tdf`), the money inputs live on the event and start prefilled from store-level defaults, the split uses presets by top-cut size and only hands out whole units (17.8 packs → 17 packs split, 135 € → whole euros, never x.5 €), prizes are packs or store cash, and the breakdown is admin-only with a button that writes a player-facing summary into the existing prizes field.

Assumptions taken: one pot for the whole event (no per-division pots — a Junior/Senior side prize goes in "otros costes"); before a `.tdf` exists the calculator previews with the registered count and says so; the entry fee is the event's existing `cost`.

## Requirements

- Store defaults (venue €/player, judge €/player, entry pack yes/no, pack value) editable on the store console, private to the store's admins.
- Per-event budget: same four fields plus fixed extra costs (+ note), prize kind (packs / cash), top-cut size and one percentage per placing. Saved on the event, admin-only.
- Player count = players imported from TOM; fallback to registered players with an explicit "estimación" line while nothing is imported.
- Breakdown: gross, venue, judge, entry packs, extra costs, remaining, pot in whole units, leftover, one amount per placing summing exactly to the pot (largest remainder), shares that don't add to 100 are treated as weights.
- "Guardar y publicar" writes "1º: 12 sobres …" into `events.prizes` (the public card) — the breakdown itself never leaves Gestión.
- Pure calculation unit-tested; docs updated.

## Development needed

* ✅ `supabase/migrations/0052_event_prize_budgets.sql`: `store_prize_defaults`, `event_prize_budgets`, RLS via `is_store_admin` / `is_event_admin`.
* ✅ `lib/event-prizes.ts` (+ test): presets, `splitWhole`, `computePrizeBudget`, `prizeSummaryText`.
* ✅ `lib/event-prize-budget.ts`: readers (`getEventPrizeBudget`, `getStorePrizeDefaults`, `countTdfPlayers`).
* ✅ `app/actions/event-prizes.ts`: `saveEventPrizeBudgetAction` (save / save+publish), `saveStorePrizeDefaultsAction`.
* ✅ `components/event-prize-budget.tsx`, `components/store-prize-defaults-form.tsx`.
* ✅ `app/events/[slug]/page.tsx` (Gestión card), `app/stores/[slug]/admin/page.tsx` (defaults card), `messages/es.json` (`eventPrizes` namespace + two `storeAdmin` keys), `docs/features/events.md`, `docs/features/admin.md`.

## QA — Dev

- [x] ✅ `vitest run` 176 green (19 new in `lib/event-prizes.test.ts`), `npx tsc --noEmit` clean, eslint clean on the eight touched code files (2026-09-06).
- [ ] Migration applied on Supabase.
- [ ] Browser, admin on a cup with a `.tdf` imported: Gestión → "Presupuesto de premios" shows the TOM player count, inputs prefilled from the store defaults, live breakdown, whole-number awards.
- [ ] Browser: "Guardar y publicar" fills the public Premios card with one line per placing.
- [ ] Browser, store console: defaults card saves and a new cup of that store starts from them.
- [ ] Non-admin cannot read `event_prize_budgets` / `store_prize_defaults` (RLS).

## Changes made

### 2026-09-06
- Created: `supabase/migrations/0052_event_prize_budgets.sql`, `lib/event-prizes.ts`, `lib/event-prizes.test.ts`, `lib/event-prize-budget.ts`, `app/actions/event-prizes.ts`, `components/event-prize-budget.tsx`, `components/store-prize-defaults-form.tsx`.
- Modified: `app/events/[slug]/page.tsx` (budget data + "Presupuesto de premios" card in Gestión), `app/stores/[slug]/admin/page.tsx` ("Premios por defecto" card), `messages/es.json`, `docs/features/events.md` ("Prize budget" section + DB bullet), `docs/features/admin.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-06 — created after the clarifying round (TOM player count, store defaults + per-event values, whole-unit presets, packs or store cash, admin-only with publish button). In Progress.
- 2026-09-06 — implemented; tests, typecheck and lint green. In Review.

Last updated: 2026-09-06
