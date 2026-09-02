# PL-8 — Decide what stays world-readable: players' Pokémon IDs and names are public via REST

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.4. `select using (true)` policies exist on `players` (including `pokemon_id`, `game_id`, `first_name`, `last_name`), `profiles`, `session_participants`, `event_registrations`, `matches`, `rounds`, `event_matches`, `event_standings`, `league_members`, `event_admins`, `event_staff`, `leagues`, `sessions`, `events`, `archetype_customs`. Restricted: `event_lists`, `event_tdf_players`, `event_tdf_imports`, `player_decks`, `admin_allowlist`, private archetype picks. The UI hides Pokémon IDs and the event roster from non-admins, but the anon key is public by design, so `GET /rest/v1/players?select=*` returns every player's Pokémon ID and real name to anyone. `docs/features/events.md` already notes the roster gap.

## WHY

Pokémon Player IDs are semi-sensitive (they identify a person across official events; Junior/Senior players are minors). The community may be fine with names + IDs being readable by whoever digs into the API; that's a decision to make consciously, not by default.

## Requirements

- Decision recorded here: either (a) accept the current exposure and note it in `docs/features/players.md` and `docs/features/auth.md`, or (b) tighten.
- If tightening: `players` select policy restricted so `pokemon_id` / `game_id` / `first_name` / `last_name` are only readable by the player themself and site/league/event admins — column-level privileges or a public view (`players_public` with `id, display_name, user_id is not null as linked`) that the public pages read from, while admin pages and the RPCs keep reading `players`. Same review for `event_registrations` (has `checked_in`, `has_list`, archetypes — probably fine) and `profiles` (`display_name`, `avatar_url`, `is_admin` — probably fine).
- Nothing the public pages show today breaks: profile page, pairings, standings, rosters as seen by non-admins already avoid the sensitive columns in the UI, but `lib/*` queries select them — audit each `select(...)` on `players`.

## Development needed

* Inventory every `from("players")` select in `lib/` and `app/` and mark which run for anonymous viewers.
* If (b): migration `0044_players_public_read.sql` with the view/policy change + grants; switch the public code paths to the view; keep `merge_players`, `approve_player_claim`, etc. untouched (security definer).
* Docs update either way.

## QA — Dev

- [ ] Decision written in this ticket.
- [ ] If tightened: anon `GET /rest/v1/players?select=pokemon_id` returns 401/403 or no column; public pages still render; admin pages still show IDs; `copy-pokemon-ids` still works for admins.
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` clean.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
