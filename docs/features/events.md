# Events

An Event is a one-off tournament, distinct from a recurring League — has its own staff, registration/waitlist, optional decklist submission, and archetype tracking. It pairs nothing itself: rounds and matchups arrive by importing the `.tdf` file the official TOM software writes (see [TOM import](#tom-tdf-import-0041) below), unlike league sessions which run their own Swiss.

## Routes

- `app/events/[slug]/page.tsx` — main event detail page, organised like the session page: pinned above the fold are the header (name, game/category badges, subtitle, status, meta line, archetypes/display links), the viewer's own pairing (`EventMyMatch`), prizes, the registration/list form (`EventRegister`) and the self-service archetype picker (locked once event is `complete`) — registration and archetypes stay out of the tabs on purpose, they're the two things a player comes here to do. Everything else sits in the `PageTabs` strip: **Emparejamientos** (`EventPairings`, only once a `.tdf` has been imported), **Clasificación** (TOM's final placings if the tournament is closed, otherwise the provisional table), **Inscritos (n)** (admin only — check-in tally, roster with `ParticipantsList`, waitlist, Pokémon-ID copy tool), **Gestión** (admin only — staff roster + add-staff/create-staff-player forms, TOM import card `TdfImport`, edit form `EditEventForm`, status toggle open/closed/complete, and the site-admin-only hard delete). Admins land on Inscritos while nothing has been imported yet (check-in and collecting IDs is the job at that point), everyone else on Emparejamientos, falling back to the first tab that exists. The staff panel is the one thing that moves: admins get it inside Gestión with its forms, non-admins get the read-only list pinned above the tabs, since who's judging is public but the forms aren't. Non-admins never see the roster: it carries player IDs and every submitted list, so it's admin-only in the UI (note the underlying `event_registrations` rows are still world-readable by RLS — only `event_lists` is actually restricted). `EventRealtimeRefresher` mounts while the event has imported rounds and isn't `complete`.
- `app/events/[slug]/arquetipos/page.tsx` — public archetype-stats sub-page; renders `computeEventArchetypeStats(event.id)` in an `ArchetypeStatsTable`. Usage (players, % of field) always shows; the win/loss/win-rate columns appear only for events whose results were imported from TOM, since an event with no import has nothing to put in them.
- `app/events/[slug]/display/page.tsx` — venue projector view, the event twin of the session display: the current round of every age division at across-the-hall size, standings beside it, realtime-refreshed, nothing to click. No round clock — TOM runs its own. A table that has reported but isn't in TOM yet shows its winner like any other, tagged "Sin confirmar" instead of "Pendiente", so the room can see which tables are still waiting on the judge. Shows TOM's official placings once the event is closed, the provisional table before that. Linked from the event header whenever imported rounds exist.
- `app/admin/events/page.tsx` — admin-only (`requireAdmin`) page hosting `CreateEventForm` to create a new standalone event.

## Server actions (`app/actions/events.ts`)

All are `"use server"`, validate/cap input then call Supabase RPCs; most `revalidatePath`.

- `createEventAction` — validates + calls `create_event` RPC, redirects to the new event.
- `updateEventAction` — direct `.update()` on the `events` table (not an RPC).
- `registerEventAction` / `submitListAction` — register (with optional list) / update submitted list via `register_event` / `submit_event_list` RPCs. Both refuse once the entry deadline has passed (`entryDeadlineError` helper, skipped for event admins) before even calling the RPC, so the user gets a Spanish message instead of the raw SQL error.
- `adminSubmitListAction` — admin bypass: writes any registrant's list via `admin_submit_event_list`, deadline or not.
- `setMyEventArchetypesAction` / `adminSetEventParticipantArchetypesAction` / `setEventArchetypeVisibilityAction` — self vs admin archetype-pick RPC wrappers.
- `unregisterEventAction` / `adminRemoveRegistrationAction` — leave / admin-kick a registrant.
- `adminSetEventCheckedInAction(slug, eventId, playerId, checkedIn)` — on-site check-in toggle via `admin_set_event_checked_in`. The page binds `slug` so the shared roster can call it with the session-style `(contextId, playerId, checkedIn)` signature.
- `setEventStatusAction` — open/closed/complete toggle.
- `addEventStaffAction` / `createEventStaffPlayerAction` / `removeEventStaffAction` — staff management, including creating a "managed" player record for staff not already in the system.
- `deleteEventAction` — hard delete via `delete_event` RPC, redirects home.

## Server actions (`app/actions/event-tdf.ts`)

- `previewTdfAction` — step 1 of the import: reads the uploaded file (2 MB cap), parses it and returns a `TdfPreview` (tournament meta, rounds per division, one row per TDF player with its suggested match, plus the full player list for the override dropdown and the raw XML echoed back). Writes nothing. Admin-gated in the action itself, not just the UI.
- `importTdfAction` — step 2: re-parses the echoed XML (nothing from the browser is trusted beyond the per-player `player_<userid>` choices, where an empty value means "create a managed player") and calls `import_event_tdf`.
- `reportEventMatchAction` — a player's own call on their match, via `report_event_match`.
- `clearEventTdfAction` — admin undo, via `clear_event_tdf`.

## Lib logic

- `lib/tdf.ts` (pure, unit-tested in `tdf.test.ts`) — the `.tdf` parser. Carries a minimal XML reader rather than a dependency (`parseXml`; tolerant, but a literal `>` inside an attribute value would confuse it — TOM escapes those). `parseTdf` returns tournament meta, players (`userid` = Pokémon ID, names, birthdate), a flat round list keyed by pod `category` (age division) + round number, and the final placings from the `<standings>` block once the tournament is closed. `TDF_OUTCOMES` maps TOM's numeric `outcome` (0 pending, 1/2 win, 3 draw, 4 double loss, 5 bye) — an unknown code falls back to pending and the raw code is kept. `pairKeyOf` builds the sorted-userid natural key that makes re-imports idempotent. `matchTdfPlayers` resolves TDF players against the player table in order: existing mapping → `pokemon_id` → unambiguous accent-insensitive full name → nothing (a name matching two players deliberately resolves to nothing).
- `lib/event-rounds.ts` — read side of the import: `getEventRounds`, `getEventMatches` (stable order: table, byes last, then created_at), `getEventStandings` (official placings), `getEventTdfMapping` (userid → player id, admin-only by RLS), `getLastTdfImport`.

### What the file format actually does (learned from a full real tournament)

Three things in the format are traps, all of them verified against every export of one real event (`lib/tdf-sequence.test.ts` replays all 13 files and asserts the end state; it skips itself when the fixtures aren't present, since they carry real names and birthdates and live outside the repo):

- **The pod's `stage` is progress, not identity.** It reads 0 while the swiss runs and flips to 1 the moment the cut is paired — under the same rounds. Keying rounds on it duplicates the entire swiss at top-8 time. Rounds are keyed on `(event, division, number)` only, and the parser pointedly does not read pod `stage`.
- **Top-cut rounds continue the swiss numbering.** A 4-round swiss plus a top 4 runs 1..6 in one pod; what marks the cut is the round's own `type` (3 = swiss, 1 = single elimination), which is what `isFinals` comes from. The UI names those rounds by how many tables are left ("Semifinales", "Final") because "Ronda 5" tells a player nothing.
- **A player's `userid` can change mid-tournament, and TOM rewrites history.** In the real data a placeholder ID (`1999999`) was corrected to the entrant's real one (`6054871`) after round 2, and every earlier round in later exports came back re-written to the new ID. This self-heals: the name match in the review step lands the new userid on the existing player, and because pairings are keyed by `pair_key`, the re-written round-1 pairing inserts under the new key and the stale one is swept by the same delete that handles a re-pair. Both userids end up mapped to one player.

Two smaller confirmed details: `<standings>` is a sibling of `<pods>`, and its per-division `<pod type="finished">` entries are placings, not rounds — the parser only walks `tournament > pods > pod`, so they can't be confused. And a **bye** is written as `outcome="5"` on a match holding a single `<player>` element (not `<player1>`) with `<tablenumber>0</tablenumber>`; the parser reads the lone element as player 1 with no opponent and discards table 0, since a bye is played at no table. Verified against a real 15-player export. Outcome code 4 (double loss) is the only mapping still unconfirmed — it has never appeared in real data.
- `lib/events.ts` — data-access layer: `EventRow`/`EventStatus` types, `listEvents`, cached `getEventBySlug`, `isEventAdmin` (site admin or row in `event_admins`), `listRegistrations`, `getMyRegistration` (joins `event_registrations` + `event_lists`), `listEventStaff`, `getEventLists` (admin-only, all submitted lists keyed by player). Also `eventEntryDeadline` / `isEventEntryLocked` (+ `DEFAULT_LIST_LOCK_MINUTES` = 60, `MAX_LIST_LOCK_MINUTES` = 10080), the TS mirror of the `event_entry_locked` SQL function used to gate the UI.
- `lib/event-category.ts` — defines the `Category` union (`cup | challenge | demo | prerelease | others`) with label/icon metadata (`CATEGORIES`), plus `categoryMeta`/`isCategory` helpers.
- `lib/agenda.ts` — powers the landing page. `getUpcoming()` fetches both `sessions` (league-linked) and `events` (standalone) from today onward (not `complete`), normalizes both into a unified `UpcomingItem[]` (kind: "session"|"event") sorted by `startsAt`, feeding the home page's today/this-week/upcoming sections.

## Components

- `create-event-form.tsx` / `edit-event-form.tsx` — client forms (`useActionState`) for all event fields (name, subtitle, category, game — create only, game is immutable after creation —, datetime, location, cost, capacity, external URL, description, prizes, list-required toggle).
- `event-register.tsx` — client component driving both registration and list submission; shows registered/waitlisted badge + unregister button, or a register form (list-required note if applicable), or a "closed" message. Past the entry deadline (`locked` prop) the forms are replaced: registrants see their submitted list read-only plus the deadline notice, non-registrants only the notice. While still open it prints the deadline under the list fields.
- `participant-list-editor.tsx` — admin-only inline view + editor for one registrant's list (collapsed `<details>` summary with an edit toggle), posting to `adminSubmitListAction`. Replaces the old read-only admin list preview on the event page and works after the deadline.
- `participants-list.tsx` (shared with sessions, documented in `docs/features/sessions-rounds.md`) — the event roster reuses it with `contextIdField="event_id"` and `extraFields={{ slug }}`, feeding each row the registrant's `pokemon_id`, the "lista enviada" badge inside the name cell, the remove form as `actions`, and `ParticipantListEditor` as `extra`. Registered and waitlisted render as two instances, the first with the "solo pendientes de check-in" filter.
- `copy-pokemon-ids.tsx` (shared with sessions) — copy-all block under the roster, fed by every registrant's `pokemon_id` (registered + waitlist); players without one are listed underneath as links to their admin player page.
- `add-staff-form.tsx` — client form to attach an existing player as event staff with a free-text role.
- `game-badge.tsx` — small presentational badge (tcg/vgc colored pill), shared with leagues.
- `tdf-import.tsx` — the two-step import (read → review → confirm). The review step is the whole point: it's where the TO says which "David Pérez" in the database is the one in the file. `useActionState` keeps its last result forever, so the component tracks preview identity to know when a success message has gone stale — otherwise the "imported" message from round 3 would swallow the review step for round 4.
- `event-pairings.tsx` — round tabs per age division (the division tab strip only appears when the file has more than one). Round selection is controlled and reconciled during render, not in an effect, so a re-import snaps the room to the new round. Rows read exactly like session pairings (`rounds-tabs.tsx`): the shown result is the official one when TOM has ruled and the players' report until then, drawn the same way either way — trophy on the winner, loser muted, the matching button active. A row standing on a report alone carries a "Sin confirmar" badge, which is what tells the TO it still has to be keyed into TOM; it disappears on the next import. Report buttons show on the viewer's own undecided pairing, and on every undecided pairing for event admins (the judge takes the call at the table as often as the players tap it).
- `event-my-match.tsx` — the pinned "your match" card: round, table, opponent, and win/draw/lose buttons, same shape as `my-match-card.tsx`. The opponent name gets the trophy/muted treatment off the report while the round is undecided. Wording is deliberately "has reportado que ganaste", never "ganaste" — TOM has the last word.
- `event-realtime-refresher.tsx` — event twin of `RealtimeRefresher`, subscribed to `event_matches`/`event_rounds` filtered by `event_id`, with the same 30s poll fallback.
- `page-tabs.tsx` (shared with sessions, documented in `docs/features/sessions-rounds.md`) — the top-level tab strip. Was `session-tabs.tsx` until the event page needed the same thing; nothing about it was session-specific, so it was renamed rather than duplicated.

## Database

- `events` (base): id, name, slug (unique), game (tcg/vgc), starts_at, location, cost, description, external_url, prizes, list_required, capacity, status (open/closed/complete), created_by, created_at.
- `event_admins` — owner/admin per user.
- `event_registrations` — (event_id, player_id) PK, status (registered/waitlisted), has_list, checked_in (on-site check-in, informational only — it gates nothing).
- `event_lists` — private list content/url, RLS restricted to submitter or admin.
- Later additions: `subtitle` (0018), `category` check constraint extended to add `prerelease` (0023), `event_staff` table + RPCs `add_event_staff`/`create_event_staff_player`/`remove_event_staff` (0024), `archetype1`/`archetype2`/`archetype_public` on `event_registrations` (0036), `list_lock_minutes` (0039), `checked_in` + `admin_set_event_checked_in` (0040, the event twin of sessions' 0037), TOM import tables + RPCs (0041, see below).
- `event_rounds` — id, event_id, division (pod category: 0 Junior / 1 Senior / 2 Master), number, is_finals, unique (event_id, division, number).
- `event_standings` — (event_id, player_id) PK, division, place. TOM's official final placings; only populated once the tournament is closed.
- `event_matches` — id, event_id, round_id, pair_key, table_number, player1_id, player2_id (null = bye), official_result (pending/p1_win/p2_win/draw/double_loss/bye), official_code (raw TOM outcome), reported_result (p1_win/p2_win/draw, player self-report), reported_by/at, unique (round_id, pair_key).
- `event_tdf_players` — (event_id, tdf_userid) PK → player_id, plus the names as the file spelled them. Admin-only by RLS.
- `event_tdf_imports` — audit row per upload (tdf_id, file_name, counts, who, when). Admin-only by RLS.

## TOM (.tdf) import (0041)

The TO drops the file TOM exports and the site shows the pairings back to the players. **TOM stays the source of truth**: `event_matches.official_result` only ever changes on import, and what a player taps on their phone lands in `reported_result` as a signal for the judge to key into TOM. The two never fight, and the next import doesn't touch what was reported.

The reporting loop is the point: players (or the judge, on any table) tap the result from their seat, the TO reads the round tab — reported tables render as decided with a "Sin confirmar" badge, unreported ones sit blank — types them into TOM, and re-drops the .tdf. The import lands `official_result`, the badge goes away, and the row now says what TOM says. Nothing marks a report as "already entered" beyond that: the import is what clears it, deliberately, so there is no second piece of state to keep honest.

The intended loop is re-dropping the same file after pairing each round — the import is idempotent. Rounds are keyed by `(event_id, division, number)` and pairings by `(round_id, pair_key)`, where `pair_key` is the sorted pair of TDF userids (or `<userid>~bye`), so it survives TOM swapping player 1 and player 2 between exports. Pairings a round no longer lists are deleted, so a re-pair in TOM propagates instead of leaving ghosts. See the format notes above for why the round key is what it is.

`import_event_tdf(p_event, p_tdf_id, p_file_name, p_players, p_rounds, p_standings)` does the whole commit in one transaction: resolves or creates each player (a created one gets `pokemon_id` = the TDF userid), upserts `event_tdf_players`, adds everyone to `event_registrations` **ignoring capacity** (whoever TOM says is playing is playing), upserts rounds and pairings, replaces the final placings wholesale if the file carries any, and records the audit row. `report_event_match(p_match, p_result)` is open to the two players or an event admin. `clear_event_tdf(p_event)` undoes an import but deliberately keeps the players it created and their registrations — by then they may carry archetypes or lists.

Tables: `event_rounds`, `event_matches`, `event_standings` (official placings), `event_tdf_players` (the userid ↔ player mapping) and `event_tdf_imports` (audit). Rounds, matches and placings are world-readable like session pairings; the mapping and the audit rows are admin-only. `event_matches`/`event_rounds` are in the realtime publication. `merge_players` was extended again (on top of 0029) to carry `event_matches` and `event_tdf_players` across a merge — both FKs cascade, so without it a merge would silently delete the source's imported history.

Standings on the page come in two flavours. While the tournament runs there is a **provisional** table computed with `lib/scoring` (the league scorer) off the official results, labelled as such: TOM's full tiebreaker chain is not reproduced, and a TOM double loss is booked as two solo losses, which drops that pair from each other's OWP. Once the TO exports a closed tournament the file carries TOM's own placings, and those replace the computed table entirely.

Known limits, all deliberate:

- **No bracket rendering.** Top-cut rounds show as extra round tabs named by size ("Semifinales", "Final"), not as a bracket.
- **Outcome codes** outside 0–5 fall back to pending; the raw code is kept in `event_matches.official_code` so an unmapped one is inspectable rather than silently scored. Codes 0–3 and 5 are confirmed against real exports; 4 (double loss) is the last unverified one.
- The import does not create the event — it attaches to an event that already exists.

## Entry deadline (0039)

`events.list_lock_minutes` (int, default 60, 0–10080) closes registration *and* list submission that many minutes before `starts_at`. `event_entry_locked(p_event)` is the SQL source of truth — `starts_at is null` or `list_lock_minutes = 0` never locks — and both `register_event` and `submit_event_list` raise once it returns true, unless `is_event_admin(p_event)`. Admins bypass the cutoff entirely and get `admin_submit_event_list(p_event, p_player, p_content, p_url)` to write someone else's list. `create_event` was dropped/recreated with a 13th arg `p_list_lock_minutes`; the value is editable in both the create and edit event forms (minutes before start, 0 = no cutoff). Unregistering is deliberately *not* blocked by the deadline.

Key RPCs: `create_event`, `register_event` (handles waitlist via capacity), `submit_event_list`, `unregister_event`/`admin_remove_registration` (promotes from waitlist), `set_event_status`, `set_event_archetypes` (self-service, locked post-complete unless never set), `admin_set_event_archetypes` (unrestricted), `set_event_archetype_visibility`.

## Landing-page integration

`app/page.tsx` consumes `getUpcoming()` from `lib/agenda.ts`; splits into `todayItems`/`thisWeekItems` sections plus a general filterable list (by `game` and `type`/category query params — events filtered via `u.kind === "event" && u.category === typeFilter`). Renders `GameBadge` and `CategoryBadge` per item, distinguishing events from league sessions in the same unified feed.
