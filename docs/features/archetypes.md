# Archetypes

An "archetype" is the deck type/strategy a player plays (e.g. "Charizard ex Box"). The app tracks which archetype each participant plays per session/event, locks it after completion, and computes usage stats/standings sitewide, per-league, and per-event.

## Routes

- `app/arquetipos/page.tsx` — sitewide stats page. Filters by `game` (tcg/vgc) query param; renders two `ArchetypeStatsTable`s ("Leagues" and "Events") via `computeGameLeagueArchetypeStats` / `computeGameEventArchetypeStats` (aggregates across all leagues/events of that game).
- `app/admin/arquetipos/page.tsx` — not a stats page; admin CRUD console for `archetype_customs` (custom deck entries beyond the static Pokédex), split by game, with show/hide and delete actions plus `CustomArchetypeForm` to add new ones.
- `app/events/[slug]/arquetipos/page.tsx` — per-event usage stats via `computeEventArchetypeStats(event.id)`; table has no win/loss columns (`showRecord={false}`) since events don't run on-site matches.
- `app/leagues/[slug]/arquetipos/page.tsx` — per-league stats via `computeLeagueArchetypeStats(league.id)`; full table with games/record/winRate since league sessions have match results.

The sitewide page aggregates over every league/event of a game; the league/event pages scope the same computation to one entity's sessions/registrations; the admin page is unrelated management UI, not stats.

## Server actions (`app/actions/archetypes.ts`)

- `createCustomArchetypeAction` — validates game/name/icon URL, inserts into `archetype_customs`, revalidates `/admin/arquetipos`.
- `deleteCustomArchetypeAction` — deletes a custom by id.
- `toggleCustomArchetypeAction` — flips the `active` boolean (soft hide/show).

Participant-level archetype edits live in `app/actions/sessions.ts` (`set_participant_archetypes`, `admin_set_participant_archetypes`, `set_archetype_visibility` RPC wrappers) and `app/actions/events.ts` (`set_event_archetypes`, `admin_set_event_archetypes`, `set_event_archetype_visibility`).

## Lib logic

- `lib/archetypes.ts` — `listCustoms(game?)` fetches custom archetypes; `resolveArchetypes(keys)` resolves picker keys (`pkm:<dexId>` or `cst:<uuid>`) into display chips `{key, name, icon}`, batching custom lookups and using static Pokédex data for `pkm:` keys.
- `lib/archetype-standings.ts` — computes usage/win-rate stats.
  - `computeArchetypeStatsForSessions` (internal) — pulls non-pending `matches` + public archetype picks from `session_participants` for given session IDs; credits each declared archetype key with game/win/draw/loss per match (dual-archetype picks credit both slots; byes/no-opponent count as a win); sorted by games desc, winRate desc, name.
  - `computeLeagueArchetypeStats(leagueId)` / `computeGameLeagueArchetypeStats(game)` — scope the session set to one league or all leagues of a game.
  - `computeArchetypeStatsForEvents` (internal) — usage-only (no matches): counts distinct players per declared archetype among `registered` + `archetype_public` event registrations, as a percentage of field size.
  - `computeEventArchetypeStats(eventId)` / `computeGameEventArchetypeStats(game)` — same, scoped to one event or all events of a game.

## Components

- `archetype-picker.tsx` — form with two `ArchetypeCombobox` slots (searchable Pokédex + customs) and a public/private `Switch`; supports self-mode (`action`) or admin-mode (`playerId` + `adminAction`) — self mode's visibility switch fires instantly via `onVisibilityChange`/transition, admin mode only applies on save.
- `archetype-stats-table.tsx` — renders `ArchetypeStatRow[]` (with games/record/winRate) or `EventArchetypeStatRow[]` (with percentage), discriminated by the `showRecord` prop.
- `custom-archetype-form.tsx` — small name+icon_url form calling `createCustomArchetypeAction`, used on the admin page.
- `participant-archetype-editor.tsx` — admin-only collapsible wrapper around `ArchetypePicker`: shows current chips as a summary line, toggles the full picker open to edit another participant's picks.

## Database and locking

- `0008_archetypes.sql` — creates `archetype_customs` (game/name/icon_url/active, RLS: public select, admin write). Adds `archetype1`, `archetype2`, `archetype_public` to `session_participants`. Adds RPCs `set_participant_archetypes` (self) and `admin_set_participant_archetypes` (league admin, unrestricted).
- `0012_archetype_visibility.sql` — adds `set_archetype_visibility` RPC for instant public/private toggle without touching picks.
- `0034_lock_archetypes.sql` — redefines `set_participant_archetypes` to check session status: if `sessions.status = 'complete'` AND the participant already has a non-null `archetype1`/`archetype2`, the update raises "Session is complete; archetype is locked." Exception: a participant with both slots still null can still add a pick after completion. The admin RPC is untouched, so admins can always edit/correct post-completion.
- `0036_event_archetypes.sql` — mirrors the whole pattern for events: adds `archetype1/2`, `archetype_public` to `event_registrations`, and `set_event_archetypes` (self, locked once `events.status = 'complete'` with the same null-slot exception), `admin_set_event_archetypes` (event admin, unrestricted), `set_event_archetype_visibility` (instant toggle).

Locking mechanism: archetype picks lock automatically once the parent session/event transitions to `status = 'complete'`, enforced in the security-definer RPC itself (not just the UI) — the only escape hatch for a self-editing player is if they never recorded anything (both slots null); admins always bypass the lock via the separate `admin_set_*` RPCs.
