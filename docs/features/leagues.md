# Leagues

A League is the top-level recurring competitive container: a schedule, a points system, prizes, categories, and standings tracked over trimestres (quarters). Sessions (see `docs/features/sessions-rounds.md`) are the individual dated instances that belong to a league.

## Routes

- `app/leagues/page.tsx` — lists all leagues as cards (name, game badge, format, subtitle, month range); shows `CreateLeagueForm` to site admins.
- `app/leagues/[slug]/page.tsx` — league home: header (name/game/format/subtitle/archived badge), description, duration + weekday/time summary, links to standings/archetypes/admin, session list, and (for league admins) a create-session form.
- `app/leagues/[slug]/admin/page.tsx` — league admin console: details form, points config, duration form, weekly schedule + bulk session generation, locations picklist (add/remove/default), admins management (add/remove co-admins), archive/reactivate toggle, and (site-admin only) hard delete.
- `app/leagues/[slug]/clasificacion/page.tsx` — standings page; filters by trimestre or "general" (overall), computes `computeLeagueStandings` from all session matches, renders ranked table with points/wins/attended and prizes text.
- `app/leagues/[slug]/arquetipos/page.tsx` — league-wide archetype usage stats via `computeLeagueArchetypeStats`, rendered in `ArchetypeStatsTable`.
- `app/leagues/[slug]/sessions/[sessionSlug]/**` — belongs to the sessions sub-domain but nested under a league; see `docs/features/sessions-rounds.md`.

## Server actions (`app/actions/leagues.ts`)

- `createLeagueAction` — validates name/game/format/month range, calls RPC `create_league`, redirects to the new league.
- `updateLeagueDetailsAction` — updates name, subtitle, game, format, prizes.
- `updateLeagueDurationAction` — updates `starts_month`/`ends_month` (validates end ≥ start).
- `updateLeagueScheduleAction` — updates `session_weekday`, `session_time`, `default_cost`.
- `generateLeagueSessionsAction` — calls RPC `generate_league_sessions`, returns count created.
- `updateLeaguePointsAction` — updates `win_value`, `attendance_value`, `draw_value`.
- `addLeagueLocationAction` / `removeLeagueLocationAction` / `setDefaultLocationAction` — manage the `locations` array and `default_location`.
- `addLeagueAdminAction` / `removeLeagueAdminAction` — call RPCs `add_league_admin`/`remove_league_admin`.
- `setLeagueArchivedAction` — sets/clears `archived_at`.
- `deleteLeagueAction` — calls RPC `delete_league`, redirects to `/leagues`.

## Lib logic

- `lib/leagues.ts` — `League` type; `listLeagues`, `listActiveLeagues`, cached `getLeagueBySlug`, `listLeagueAdmins`, `isLeagueAdmin` (site-admin or league_member check), `getLeagueMatchesBySession` (matches grouped by session, feeds standings), `listAddableUsers`. Re-exports `Game`, `FORMATS_BY_GAME`, `formatLabel` from `league-format.ts`.
- `lib/league-standings.ts` — pure `computeLeagueStandings(sessions: MatchInput[][], cfg)`: aggregates wins/draws/losses/attendance across sessions; league points = wins×win + draws×draw + attended×attendance; attendance credited once per session regardless of game count; sorted by points then wins then id; ranked. Covered by `lib/league-standings.test.ts` (cross-session aggregation, bye counts as a win, attendance counted once per session even with multiple games, pending-only sessions yield no rows, configurable draw value).
- `lib/league-format.ts` — `Game` type, `GAME_ROW_TINT` (UI color), `FORMATS_BY_GAME` (tcg: standard/glc; vgc: champions), `formatLabel`.
- `lib/trimestre.ts` — defines 4 fixed quarters starting in July (1=Jul-Sep … 4=Apr-Jun); `trimestreOf(iso)`, `currentTrimestre()`, `ALL_TRIMESTRES`. Drives the standings-page quarter filter.

## Components

- `create-league-form.tsx` — new-league form (name, game→format cascading select, month range with auto +2mo end suggestion, description).
- `league-details-form.tsx` — edits name/subtitle/game/format/prizes.
- `league-duration-form.tsx` — edits start/end month inputs.
- `league-points-form.tsx` — edits win/attendance/draw point values.
- `league-schedule-form.tsx` — edits weekday/time/default cost for recurring sessions.
- `standings-table.tsx` — generic ranked table (rank/player/points/W-L-D/opponent win-rate) with archetype icons; used for per-session standings.
- `category-badge.tsx` / `category-select.tsx` — badge/select for the shared event/session category taxonomy (`lib/event-category.ts`).

## Database

`leagues` (base table, columns added across several migrations): `id, name, slug (unique), description, game (tcg|vgc), win_value (default 3), attendance_value (default 1), draw_value (default 1), created_by, created_at, archived_at, starts_month, ends_month, format (check-constrained per game), subtitle, session_weekday, session_time, default_cost, prizes`. `locations`/`default_location` columns exist in code (not confirmed in the migration set reviewed).

`league_members`: `league_id, user_id, role (owner|admin)`, PK(league_id, user_id) — RLS-gated via `is_league_admin`/`is_league_owner`.

`events`/`sessions` both carry a shared `category` column (cup/challenge/demo/others, nullable check constraint) — not league-specific but used on league sessions.

Key RPCs: `create_league` (signature grew over time to add month range + format), `add_league_admin`, `remove_league_admin`, `delete_league`, `generate_league_sessions`, `slugify`.
