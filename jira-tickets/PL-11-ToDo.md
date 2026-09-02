# PL-11 — Docs cleanup: README, prize pool, stale notes, PLAN.md status

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.6. The feature docs are good; the edges around them are not:

- `README.md` is still create-next-app boilerplate.
- The prize pool (`lib/prize-pool.ts`, `lib/prize-awards.ts`, `league_prize_awards` from `0038_league_prize_awards.sql`, `awardLeaguePrizeAction` / `revokeLeaguePrizeAction`, the league home pool block and the admin awards view) is not documented anywhere in `docs/features/`.
- `docs/features/leagues.md` says `locations` / `default_location` are "not confirmed in the migration set"; they are in `0007_session_refinements.sql` and `0025_league_weekly_schedule.sql`.
- `docs/features/archetypes.md` lists `participant-archetype-editor.tsx`, which does not exist (the admin editor lives inside `participants-list.tsx`).
- `PLAN.md` is the July v1 plan and diverges from what shipped (no `lib/merge.ts` / `lib/waitlist.ts` — both in SQL; no `/agenda` or `/events` routes; sessions nested under leagues; events gained TOM import + on-site reporting; `win_value` default 3; archetypes from Pokédex + customs instead of icon uploads).

## Requirements

- `README.md` (≈15–25 lines): what the project is, stack in one line, `npm run dev/test/build/lint`, pointer to `DEPLOYMENT.md`, `docs/features/`, `jira-tickets/INDEX.md`, `docs/AUDIT-2026-08-21.md`.
- New section "Prize pool" in `docs/features/leagues.md`: `QUARTER_POOL_SIZE` / `YEAR_POOL_SIZE`, `computePrizePool`, `PrizeScope`, `league_prize_awards` table + RPCs, the two actions, where it renders.
- Fix the two stale notes.
- `PLAN.md`: either a one-paragraph header "Historical — v1 plan from July 2026; see docs/features/ for what shipped" or delete the file (keep it; git has it either way, but a header costs nothing).

## Development needed

* Edit the five files above.

## QA — Dev

- [ ] Every file/function/table name mentioned in the new text exists (grep each one).
- [ ] No other doc references `participant-archetype-editor`.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
