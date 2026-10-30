# PL-32 — Pairings repeat across sessions: tied players are ordered by player id, never shuffled

Status: In Review | Type: Bug | Assignee: José María Ruiz Marín | Created: 2026-10-30 | Done: —

## Description

Players report that they get the same opponents session after session (player A meets player B in round 1 of every session). The pairing path has no randomness at all: `computeStandings` (`lib/scoring.ts`) sorts by points, OWP, wins and then by `playerId` (a UUID) as the final tiebreak; `pairingContext` (`app/actions/rounds.ts`) feeds that order straight into `generateSwissPairings`, which pairs top-down. In round 1 everybody is tied, so the roster order is the UUID order and the same roster always produces the same round 1. Later rounds have the same problem inside every tie group.

Fix: shuffle players within tie groups (same points, OWP and wins) before pairing, every round. The displayed standings keep the stable id tiebreak. No seed is stored.

## Requirements

- Round 1 pairings differ between sessions with the same roster (random order of the tied field).
- In later rounds, players tied on points, OWP and wins are paired in random order among themselves; the relative order of the tie groups (and therefore Swiss bracket structure) is unchanged.
- Displayed standings are untouched (stable order, id tiebreak).
- Rematch and bye rules unchanged.
- Re-pairing a posted round (`repairRoundAction`) uses the same shuffled context.

## Development needed

- ✅ `lib/pairing.ts`: pure `shuffleWithinTies(items, tied, rng)` helper (Fisher–Yates per run of adjacent tied items, injectable rng).
- ✅ `app/actions/rounds.ts`: `pairingContext` shuffles the standings within tie groups before taking the roster order.
- ✅ `lib/pairing.test.ts`: tests for the helper (groups stay in place, members permute, deterministic with a fixed rng, all-tied field actually varies).
- ✅ `docs/features/sessions-rounds.md`: document the shuffle.

## QA — Dev

- [x] ✅ `npm test` green (vitest + migration lint): 18 files, 198 tests.
- [ ] `npm run lint` — 2 pre-existing `react-hooks/set-state-in-effect` errors in `components/round-timer.tsx` and `components/theme-toggle.tsx`, present on a clean checkout, unrelated to this change. Nothing new from PL-32.
- [ ] Browser: generate round 1 twice on sessions with the same roster and see different pairings.
- [ ] Browser: generate round 2 and check the tie groups still pair by bracket (no 3-0 vs 0-3 in a 2-round field).

## Changes made

### 2026-10-30

- Modified `lib/pairing.ts` — new exported `shuffleWithinTies(items, tied, rng = Math.random)`.
- Modified `app/actions/rounds.ts` — `pairingContext` shuffles the standings within tie groups (points, OWP, wins) before taking the roster order; `generateRoundAction` and `repairRoundAction` both go through it.
- Modified `lib/pairing.test.ts` — 5 new tests under `describe("shuffleWithinTies")`.
- Modified `docs/features/sessions-rounds.md` — action and lib entries describe the shuffle.

## Activity

- 2026-10-30 — Created, status To Do → In Progress.
- 2026-10-30 — Fix implemented, unit tests green. Browser QA pending.
- 2026-10-30 — Status In Progress → In Review, committed as d71e24c and pushed to main.
- 2026-10-30 — Vercel production deployment of d71e24c reported success (GitHub deployments API); prod host answers 200. No migration involved. Browser check of a freshly generated round still pending.

Last updated: 2026-10-30
