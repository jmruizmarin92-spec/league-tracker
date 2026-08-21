# PL-2 — Round statuses (pairings posted / playing), drop participants and re-pair the current round

Status: In Review | Type: Story | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Original ask: rounds need two explicit statuses — one for when the pairings have been published and one for when the round is being played. While the round is in the "pairings posted" stage the admin needs a re-pair button, so that if anyone drops (or is dropped) the round can be fixed without regenerating it from scratch: the re-pair must respect the pairing rules (no rematch inside the session, Swiss order, bye rules) and keep as much of the published pairing as possible.

Clarified in chat (2026-08-21):
- Pairings → playing happens through an explicit "Empezar ronda" button; that button also starts the round timer (with the minutes typed next to it).
- While pairings are posted but the round hasn't started, results cannot be reported by anyone (players or admins).
- "Dropped" gets a real admin action that sets `session_participants.dropped_round` and keeps the player's history/standings, instead of only the existing remove (which deletes the roster row). Re-pair treats both as "no longer active".
- When the affected players alone can't be paired fresh, the re-pair widens minimally from the bottom: dissolve the lowest intact table, retry, and so on; the last resort is a full re-pair of the round.

## Requirements

- `rounds.status` is `pairing` (pairings posted, not started) → `playing` (in progress); `complete` stays allowed in the check but is not used by the app. New rounds are created as `pairing`. Existing `active` rounds become `playing`.
- Admin sees the round status on the session page; the public display and the player's own match card show it too ("Emparejamientos" / "En juego").
- "Empezar ronda" (admin, only while `pairing`): flips the round to `playing` and starts the round timer with the minutes in the input (default: session `round_timer_minutes`, else 40; 0 = no clock). Pause/resume/reset keep working as before once playing. Starting the timer directly also flips a `pairing` round to `playing` (defensive).
- `report_match` refuses while the round is `pairing`; the UI hides the win/draw buttons in that stage (rounds tab and my-match card) and shows a "la ronda aún no ha empezado" note.
- Drop: admin "Retirar" / "Readmitir" on the roster (only once rounds exist; before that, remove is the right tool). Dropping sets `dropped_round` to the current round number (0 when no rounds); undrop clears it. A dropped player keeps their matches and stays in the standings; they are simply not in the active roster for pairing/re-pairing. Dropping does not auto-report the pending match of a `playing` round — the admin reports it (usually a loss), and the pending match keeps blocking the next round as today. A player leaving on their own (`leave_session`) once rounds exist is now a drop, not a delete.
- Re-pair ("Reemparejar", admin, only while the latest round is `pairing`): keeps every table whose two players are both still active; the pool to re-pair is everyone active who is not in such a table (orphaned opponents of dropped players, the bye holder, players added since the pairings went up). The pool is paired with the same Swiss rules as a fresh round (standings before this round, no rematch, bye rules); if no rematch-free pairing of the pool exists, the lowest intact table is dissolved into the pool and it retries, down to a full re-pair. If even that is impossible the action refuses with a visible error and the round is untouched. Kept tables keep their table numbers; new pairings take the freed numbers first, then continue after the highest.
- The Rondas tab hints when the roster changed since the pairings were posted (someone in the round is no longer active, or an active player has no match in the round).
- Next-round generation still requires every match of the current round to have a result (unchanged).

## Development needed

* ✅ `supabase/migrations/0042_round_status_repair.sql`: rounds status check → (`pairing`,`playing`,`complete`), backfill `active`→`playing`, default `pairing`; recreate `create_round` (explicit `pairing`); `start_round(p_round, p_duration_seconds)`; `start_round_timer` flips `pairing`→`playing`; `report_match` blocks on `pairing`; `repair_round(p_round, p_pairings jsonb)` (deletes the round's pending/bye matches and re-inserts the given list with explicit `table_number`); `drop_participant` (internal, execute revoked from API roles) + `admin_set_dropped(p_session, p_player, p_dropped)`; `leave_session` drops instead of deleting once rounds exist; `admin_add_late_participant` accepts `pairing`/`playing` as the current round.
* ✅ `lib/pairing.ts`: `repairSwissPairings(ordered, existing, played, hadBye)` (pure) — intact/pool split, widen-from-the-bottom loop, table number assignment; `SeatedPairing` type.
* ✅ `lib/pairing.test.ts`: 11 repair cases (unchanged roster, orphan→bye, orphan↔bye holder, late joiner vs bye holder / new bye, widening on rematch, full re-pair fallback, intact rematch not second-guessed, `null` when impossible, prior bye kept over dissolving a table, numbering a kept null-table pair).
* ✅ `lib/rounds.ts`: `RoundStatus` type; `DbRound.status` typed.
* ✅ `lib/sessions.ts`: `SessionParticipant.dropped_round`, `Session.round_timer_minutes`.
* ✅ `app/actions/rounds.ts`: `startRoundAction`, `repairRoundAction` (`useActionState` shape, standings/played/hadBye computed from previous rounds only), shared `pairingContext`, `GenerateRoundState` → `RoundActionState`, every round action revalidates session + display pages.
* ✅ `app/actions/sessions.ts`: `adminSetDroppedAction`.
* ✅ `components/action-state-button.tsx` (new, generic `useActionState` form button with inline error) replaces `components/generate-round-button.tsx` (PL-1) so the generate and re-pair buttons share one component.
* ✅ `components/start-round-form.tsx` (new): minutes input + "Empezar ronda".
* ✅ `components/rounds-tabs.tsx`: `RoundView.status`, status badge, pairing-stage controls (start form + re-pair button + hint) vs playing-stage timer controls; `canInput` requires `playing`. Also moved the "snap to latest round" from an effect to render-time state adjustment (pre-existing `react-hooks/set-state-in-effect` lint error in this file).
* ✅ `components/my-match-card.tsx`: `MyMatch.roundStarted`, hide report buttons while `pairing`.
* ✅ `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx` and `display/page.tsx`: wire status, drop/undrop buttons and "Retirado" badge in the roster, `needsRepair` hint, recommended rounds from the active (non-dropped) count, display status badge.
* ✅ `messages/es.json`: new `session` keys (`roundStatusPairing/Playing`, `roundNotStarted`, `startRound`, `repairRound`, `repairHint`, `drop`, `undrop`, `dropped`) and `display` keys (`roundStatusPairing/Playing`).
* ✅ `docs/features/sessions-rounds.md`: round lifecycle, drop, re-pair, components, RPCs, migration list.
* ✅ Apply the migration in Supabase before deploying (see DEPLOYMENT.md) — applied by José María, verified via REST.
* Commit.

## QA — Dev

- [x] ✅ `npx vitest run` — 92/92 passing (28 in `lib/pairing.test.ts`) (2026-08-21).
- [x] ✅ `npx tsc --noEmit` clean (2026-08-21).
- [x] ✅ `eslint` clean on every file touched by this ticket; the remaining project lint problems (`round-timer.tsx`, `theme-toggle.tsx`, `app/admin/events/page.tsx`) are pre-existing and untouched (2026-08-21).
- [x] ✅ Migration applied on Supabase and verified via REST with the publishable key (2026-08-21): `start_round`/`repair_round`/`start_round_timer` answer `Round not found` for a fake id, `admin_set_dropped` answers `Not allowed`, `drop_participant` is `permission denied` (42501), `session_participants.dropped_round` selectable, all 23 existing rounds read `playing`.
- [x] ✅ `npm run build` clean (2026-08-21).
- [ ] Browser: generate a round → status "Emparejamientos publicados", no win/draw buttons for players or admin; my-match card shows the not-started note; display shows "Emparejamientos".
- [ ] Browser: "Empezar ronda" with 30 min → status "En juego", timer running, report buttons appear; display shows "En juego".
- [ ] Browser: "Empezar ronda" with 0 min → playing, no clock, timer "Iniciar" still available in the admin timer block.
- [ ] Browser: during pairings, drop a player whose opponent is not the bye → hint appears, re-pair pairs the orphan with the bye holder (fresh) and all other tables keep their numbers.
- [ ] Browser: during pairings, drop a player on an even field (no bye) → re-pair gives the orphan the bye.
- [ ] Browser: during pairings, add a late participant ("next round") then re-pair → they get paired (bye holder or new bye).
- [ ] Browser: force the rematch case (orphan already played the bye holder) → the lowest intact table is dissolved and the four are re-paired fresh.
- [ ] Browser: "Readmitir" a dropped player and re-pair → they are back in the round.
- [ ] Browser: re-pair on a `playing` round is not offered; RPC refuses if called directly.
- [ ] Browser: leave session as a player once rounds exist → roster shows "Retirado", standings keep the player; before any round it still removes the row.
- [ ] Regression: timer pause/resume/reset, generate next round blocked on pending, delete round, late-join "current"/"bye" on a pairing round.

## Changes made

### 2026-08-21
**supabase**
- `supabase/migrations/0042_round_status_repair.sql` (new) — status lifecycle + backfill, `create_round`, `start_round`, `start_round_timer`, `report_match`, `repair_round`, `drop_participant`, `admin_set_dropped`, `leave_session`, `admin_add_late_participant`, grants.

**lib**
- `lib/pairing.ts` (modified) — `SeatedPairing`, `repairSwissPairings`, `byTable`.
- `lib/pairing.test.ts` (modified) — `repairSwissPairings` describe block.
- `lib/rounds.ts` (modified) — `RoundStatus`.
- `lib/sessions.ts` (modified) — `dropped_round` on participants, `round_timer_minutes` on `Session`.

**app / actions**
- `app/actions/rounds.ts` (modified) — `RoundActionState`, `pairingContext`, `repairRoundAction`, `startRoundAction`, revalidation of both pages.
- `app/actions/sessions.ts` (modified) — `adminSetDroppedAction`.
- `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx` (modified) — status/needsRepair wiring, drop/undrop, active roster count, `ActionStateButton`.
- `app/leagues/[slug]/sessions/[sessionSlug]/display/page.tsx` (modified) — round status badge.

**components**
- `components/action-state-button.tsx` (new); `components/generate-round-button.tsx` (deleted).
- `components/start-round-form.tsx` (new).
- `components/rounds-tabs.tsx` (modified); `components/my-match-card.tsx` (modified).

**i18n / docs**
- `messages/es.json` (modified); `docs/features/sessions-rounds.md` (modified); `jira-tickets/PL-1.md` (note on the component rename).

## Activity

- 2026-08-21 — Ticket created after clarifying questions (transition button, reporting lock, real drop, widen-from-bottom repair). Status set to In Progress.
- 2026-08-21 — Implementation done locally: migration, pure repair + tests, actions, components, pages, i18n, docs. vitest 92/92, tsc clean. Pending: apply migration, browser QA, commit.

- 2026-08-21 — Migration 0042 applied to the live project and verified; build clean; committed and pushed to main (Vercel auto-deploy). Status → In Review pending browser QA.

Last updated: 2026-08-21
