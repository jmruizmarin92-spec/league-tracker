# PL-1 — Never repeat a matchup within a session (Swiss pairing with lookahead)

Status: In Review | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Original ask: the Swiss pairing generator should never pair two players who already met in the same session. Before this, `generateSwissPairings` was a plain greedy top-down pass that fell back to a rematch whenever the remaining options were exhausted, which meant a bad early pick (A–B) could force a rematch at the bottom (C–D again) even though a rematch-free pairing existed (A–C, B–D).

## WHY

A rematch inside a single session is wrong by Play! Pokémon Swiss rules and players notice it immediately — it makes the tracker look untrustworthy. The old greedy pass only avoided rematches when it got lucky with the order; with small fields (6–10 players, 4+ rounds) it hit forced rematches regularly. The fix has to guarantee no rematch whenever one is mathematically possible, and refuse to generate the round (with a visible reason) when it isn't, instead of silently pairing a repeat.

## Requirements

- A matchup never repeats within a session. If any rematch-free pairing of the active field exists, the generator must find it.
- Preference order stays Swiss-style: pair from the top, each player with the nearest-ranked opponent they haven't met; only deviate when the bottom of the field would otherwise be forced into a rematch.
- Odd field: the bye still goes to the lowest-ranked player without a prior bye by default, but it may climb the standings (first among players without a bye, then among those who already had one) if that is the only way to pair everyone else fresh. Bye stays last in the returned list (highest table number).
- When no rematch-free pairing exists at all, the round is refused and the admin sees an error on the session page instead of a silently generated round.
- Existing behaviour kept: table ordering, `create_round` RPC, pending-match blocking.

## Development needed

* ✅ `lib/pairing.ts`: `generateSwissPairings` returns `Pairing[] | null`. Even field → `matchFresh`; odd field → try bye candidates bottom-up (bye-eligible first, then players who already had a bye) and return the first whose remaining field can be paired fresh.
* ✅ `matchFresh`: greedy with lookahead — a pick is only committed if the leftover players still admit a perfect rematch-free matching.
* ✅ `hasPerfectMatching`: Edmonds' blossom algorithm (general graph — the "fresh opponents" graph isn't bipartite). O(V³), fine at league size.
* ✅ `app/actions/rounds.ts`: `generateRoundAction` becomes a `useActionState`-shaped action `(prev, formData) => Promise<GenerateRoundState>`; returns `{ error }` when pairings are `null` or the RPC fails, `{}` otherwise.
* ✅ `components/generate-round-button.tsx` (new, client): `useActionState` wrapper around the generate-round form, shows `state.error` next to the button, disables while pending. _(Generalised into `components/action-state-button.tsx` by PL-2 before this was committed, so the re-pair button could share it — the old file no longer exists.)_
* ✅ `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx`: swap the inline form for `GenerateRoundButton`.
* ✅ `lib/pairing.test.ts`: cover backtracking, full round-robin with no repeats, bye climbing, bye-to-someone-who-had-one before rematch, `null` on exhausted even/odd fields, 40-player × 8-round run.
* ✅ Update `docs/features/sessions-rounds.md` (`generateRoundAction`, `lib/pairing.ts` and new `generate-round-button.tsx` entries describe the lookahead + refusal behaviour).
* ✅ Decide whether the error string in `rounds.ts` ("No se puede generar la ronda: …") moves into `messages/es.json` or stays hardcoded — kept hardcoded, same as the Spanish literals `app/actions/sessions.ts` already returns ("Coste no válido.", …); actions don't go through `next-intl` anywhere in the codebase.
* ✅ Commit — `071bc92` "Never repeat a matchup within a session", pushed to `origin/main`.
* ✅ Deploy to prod — Vercel git integration built `071bc92` (GitHub commit status `Vercel: success`, 2026-08-21 12:57Z). No DB migration in this change.

## QA — Dev

- [x] ✅ `npx vitest run lib/pairing.test.ts` — 17/17 passing (2026-08-21).
- [x] ✅ `npx tsc --noEmit` clean after the action signature change (2026-08-21).
- [x] ✅ Full suite `npx vitest run` — 81/81 across 8 files; `eslint` clean on every touched file (2026-08-21).
- [x] ✅ `npm run build` (production build) passes locally before pushing (2026-08-21).
- [x] ✅ Prod deploy verified: Vercel commit status `success` for `071bc92`, homepage bundle fingerprint changed; `/`, `/leagues`, `/leagues/tcg-war-lotus-verano`, `/leagues/tcg-war-lotus-verano/sessions/2026-07-31`, its `/display` and `/clasificacion` all return 200 with no error page (2026-08-21).
- [ ] In the browser, on a 4-player session with c–d already played, generate the next round and confirm pairings are a–c / b–d (not a–b / c–d).
- [ ] On a 3-player session where all three pairs have been played, click "Generar ronda N" and confirm the red error text appears next to the button and no round is created (check the Rondas tab and the `rounds` table).
- [ ] On a 5-player session, force the bye-climb case (a has played b, c, d) and confirm d gets the bye, not e.
- [ ] Confirm the button disables while pending and re-enables afterwards; confirm the error clears on a later successful generation.
- [ ] Confirm the public display page and `MyMatchCard` still render the new round normally (regression check, no change expected).
- [ ] Confirm a `create_round` RPC failure (e.g. pending matches) now surfaces its message instead of failing silently.

The unchecked browser items need an admin Google login on prod — login is Google OAuth only and there is no browser driver in the dev environment, so they are pending manual verification by José María. The pairing logic itself is covered by the unit tests above; what's unverified end-to-end is the button's inline error rendering and the `useActionState` wiring on the live session page.

## Changes made

### 2026-08-21
**lib**
- `lib/pairing.ts` (modified) — `generateSwissPairings` now returns `null` instead of a rematch; added `matchFresh` (greedy + lookahead) and `hasPerfectMatching` (blossom).
- `lib/pairing.test.ts` (modified) — helpers `playedKeys`/`expectNoRematch`/`expectEveryoneOnce`, 7 new cases, old "falls back to a rematch" case replaced by "returns null".

**app / actions**
- `app/actions/rounds.ts` (modified) — `GenerateRoundState` type, action returns `{ error? }`, RPC error propagated.

**components**
- `components/generate-round-button.tsx` (new) — client `useActionState` form showing the action error. Superseded by `components/action-state-button.tsx` (PL-2) in the same uncommitted batch.
- `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx` (modified) — uses `GenerateRoundButton`.

**docs**
- `docs/features/sessions-rounds.md` (modified) — `generateRoundAction` error state, `lib/pairing.ts` lookahead/blossom/null description, `generate-round-button.tsx` component entry.

## Activity

- 2026-08-21 — PL-2 replaced `generate-round-button.tsx` with the generic `action-state-button.tsx` (same behaviour, also used by re-pair) and renamed `GenerateRoundState` to `RoundActionState`; docs entry moved accordingly.

- 2026-08-21 — Ticket created retroactively for the uncommitted work in the working tree (pairing rewrite + error surfacing). Status set to In Progress.
- 2026-08-21 — Full test suite, lint and `next build` green. Committed `071bc92` and pushed to `origin/main`.
- 2026-08-21 — Vercel deployment of `071bc92` completed (12:57Z); public session/display/standings pages smoke-tested on prod. Status → In Review pending the manual admin browser checks in QA — Dev.

Last updated: 2026-08-21
