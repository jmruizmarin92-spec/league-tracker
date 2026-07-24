# Sessions & Rounds

A Session is a single dated instance of a league where players show up, get paired into rounds (Swiss pairing), report match results, and see live standings/scoring. This is the most complex domain in the app.

## Routes (`app/leagues/[slug]/sessions/[sessionSlug]/**`)

- `page.tsx` — main session page. Breadcrumbs, status badge, join/leave controls (self-service, only while `status === "setup"`), the logged-in player's "my match" card (`MyMatchCard`), standings table, rounds tabs with per-round timer and "generate round N" button, my-archetypes editor (locked once session is `complete`), admin-only participant roster (registered + waitlist) with per-participant archetype editor, Pokémon-ID copy tool for tournament software upload, admin controls (add participant/late-join options, create a managed player, edit session details, status toggle setup/active/complete, delete session).
- `display/page.tsx` — public "big screen" live display. Renders the current round's pairings + a live `RoundTimer` (read-only) and a standings table, refreshed via `RealtimeRefresher` (Supabase Realtime + 30s poll fallback). No admin actions.

## Server actions

**`app/actions/sessions.ts`**: `createSessionAction` (RPC `create_session`, redirects to new session), `updateSessionAction` (RPC `update_session`), `joinSessionAction`/`leaveSessionAction` (self join/leave), `setMyArchetypesAction`/`adminSetParticipantArchetypesAction`/`setArchetypeVisibilityAction` (archetype picks, public/private — see `docs/features/archetypes.md`), `createSessionPlayerAction` (create a managed player + add to session), `adminAddParticipantAction` (wraps `admin_add_late_participant` RPC, forwarding late-join options `missed`: none/loss and `entry`: next/current/bye), `adminRemoveParticipantAction`, `setSessionStatusAction`, `deleteSessionAction`.

Note: `createSessionAction`/`updateSessionAction` call the underlying RPCs with 6 args (league/name/starts_at/location/cost/capacity), while migration `0033_session_format.sql` redefined `create_session`/`update_session` to require 9 args (adding `best_of`, `rounds_planned`, `round_timer_minutes`) — worth double-checking the action call sites are passing the newer signature.

**`app/actions/rounds.ts`**: `generateRoundAction` — computes standings via `lib/scoring`, orders the active roster by standings, builds "already played" and "already had bye" sets from existing matches, calls pure `generateSwissPairings` (`lib/pairing`), persists via RPC `create_round`. `reportMatchAction` (RPC `report_match`), `deleteRoundAction` (RPC `delete_round`), `startRoundTimerAction`/`pauseRoundTimerAction`/`resumeRoundTimerAction`/`clearRoundTimerAction` (round countdown timer RPCs).

## Lib logic

- `lib/sessions.ts` — `listSessions`, `getSessionBySlug` (cached, joins league), `listParticipants` (with `is_me` flag), `getMyParticipation`.
- `lib/rounds.ts` — `getRounds`, `getSessionMatches` (stable order: table_number, nulls/byes last, then created_at), `getActiveParticipantIds` (registered, not dropped).
- `lib/pairing.ts` (pure, unit-tested) — `recommendedRoundCount(n)`: official Play! Pokémon Swiss round table (8→3 … 2506→12), falls back to round-robin below 4 players, log2 extrapolation above. `generateSwissPairings(ordered, played, hadBye)`: greedy Swiss — on odd count, gives a bye to the lowest-ranked player without a prior bye (bye always placed last → highest table number); pairs top-down, each player against the nearest lower-ranked opponent not yet played, falling back to a rematch only if forced. Covered by `lib/pairing.test.ts`.
- `lib/scoring.ts` (pure, unit-tested) — Win=3, Draw=1, Loss=0, bye=win. Standings sorted by points → OWP (opponents' win %, averaged over real opponents faced, each opponent's rate floored at 25% and excluding their own byes) → wins → player id. A `loss` result (solo, player2 null) is a 0-point played round with no opponent, used for late-joiners who missed earlier rounds. Covered by `lib/scoring.test.ts`.

## Components

- `create-session-form.tsx` / `edit-session-form.tsx` — session create/edit forms (datetime-local, venue select or free text, cost, capacity).
- `generate-sessions-button.tsx` — league-level bulk session generator (calls `app/actions/leagues`, not session-scoped).
- `rounds-tabs.tsx` — tabbed round view, always snapping to the latest round, win/draw buttons per match, admin delete-round, per-round `RoundTimer`.
- `round-timer.tsx` — countdown derived from server `endsAt`; admin can start/pause/resume/reset.
- `my-match-card.tsx` — pinned "your match" widget with win/draw/lose report buttons.
- Player names in pairings (`rounds-tabs.tsx`, `display/page.tsx`, `my-match-card.tsx`) are truncated with an ellipsis (`title` attribute holds the full name) so a long name never wraps onto a second line and breaks the pairing layout.
- `add-participant-form.tsx` — participant picker plus late-join fieldset (missed: none/loss; entry: next/current/bye) shown once rounds exist.
- `realtime-refresher.tsx` — subscribes to `matches`/`rounds`/`session_participants` changes filtered by `session_id`, triggers `router.refresh()`.

## Database

- `sessions`: id, league_id, name, slug (unique per league, date/name-derived), starts_at, location, cost, capacity, status (setup/active/complete), best_of (1|3), rounds_planned, round_timer_minutes, created_by/at.
- `session_participants`: (session_id, player_id) PK, status (registered/waitlisted), joined_round, dropped_round, archetype1/2, archetype_public.
- `rounds`: id, session_id, number, status, timer_duration_seconds, timer_ends_at, timer_remaining_seconds.
- `matches`: id, round_id, session_id, player1_id, player2_id (null=bye), result (pending/p1_win/p2_win/draw/bye/loss), table_number (stable per-round seating, null for byes/losses), reported_by/at.

Key RPCs (security-definer): `create_session`/`update_session`/`delete_session`, `join_session` (setup-only)/`leave_session`, `admin_add_participant`/`admin_add_late_participant` (bye-fill/loss backfill logic)/`admin_remove_participant`, `set_session_status`, `create_round` (assigns table numbers, blocks if pending matches exist)/`delete_round`, `report_match`, `set_participant_archetypes` (locked post-complete)/`admin_set_participant_archetypes`, timer RPCs. Realtime publication is enabled for `matches`/`rounds`/`session_participants`.

Relevant migrations: `0006_sessions.sql`, `0007_session_refinements.sql`, `0009_rounds.sql`, `0013_realtime_display.sql`, `0020_remove_session_category.sql`, `0022_update_session.sql`, `0027_late_participants.sql`, `0028_late_participant_bye.sql`, `0030_match_tables.sql`, `0031_session_slugs.sql`, `0032_round_timer.sql`, `0033_session_format.sql`, `0034_lock_archetypes.sql`, `0035_join_setup_only.sql`.
