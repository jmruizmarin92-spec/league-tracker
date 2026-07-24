# Players

Player profiles, Pokémon Player ID / game ID, unclaimed ("managed") player records, claim/merge workflow, per-player match history and career stats.

## Routes

- `app/players/[id]/page.tsx` — public player profile: header (alias, Pokémon/game ID, managed badge), game filter (TCG/VGC), career totals, per-league history, archetype history (respects private/public + owner/admin visibility), head-to-head table.
- `app/me/page.tsx` — the logged-in user's own profile page: edit own fields via `PlayerFieldsForm`, or (if no linked player yet) browse/request-claim unclaimed managed players.
- `app/admin/players/page.tsx` — admin console, tabbed: pending claims (approve/reject), create managed player, full player list with inline quick-edit of Pokémon/game ID (`PlayerQuickEditRow`) and delete, merge-duplicates form (only from unlinked → into linked players).
- `app/admin/players/[id]/page.tsx` — admin edit page for one player's full field set (alias, first/last name, Pokémon ID, game ID) via `PlayerFieldsForm`.

## Server actions (`app/actions/players.ts`)

All return `ActionState = { error?, ok? }`; RPC calls via a shared `callRpc` helper.

- `updateMyPlayerAction` — self-edit all fields on the caller's linked player.
- `updateMyPokemonIdAction` — self-service, sets only `pokemon_id` on the caller's own player (used by the landing-page prompt).
- `updatePlayerAction` — admin, edits any player's full fields by `player_id`.
- `updatePlayerQuickIdsAction` — admin, inline edit of only `pokemon_id`/`game_id` (no alias required), used by the admin list quick-edit rows.
- `createManagedPlayerAction` → RPC `create_managed_player`.
- `mergePlayersAction` → RPC `merge_players(from, into)`; blocks same-id merge.
- `requestClaimAction` → RPC `request_player_claim`.
- `approveClaimAction` / `rejectClaimAction` → RPCs `approve_player_claim` / `reject_player_claim`.
- `deletePlayerAction` → RPC `delete_player`.

## Lib logic

- `lib/players.ts` — `Player` type; queries: `getMyPlayer`, `listPlayers`, `listUnclaimedPlayers`, `getPlayersByIds` (name lookups), `getMyClaims`, `listPendingClaims`.
- `lib/player-name.ts` — `pairingName(p)`: renders `"Alias · First L."`, falling back to alias alone.
- `lib/player-profile.ts` — pure aggregation (no DB): `computeCareerTotals`, `computeHeadToHead`, `computeLeagueHistory` over `PlayerMatchRecord[]` (bye = win with null opponent). Covered by `lib/player-profile.test.ts`.
- `lib/player-profile-data.ts` — DB-backed data for the profile page: `getPlayer`, `getPlayerMatchRecords` (derives win/loss/draw/bye from the `matches` table per player), `getLeagueConfigs` (point values per league), `getArchetypeHistory` (per-session archetype chips, filtered by public/private visibility).
- `lib/pokedex.ts` — **not** player-ID related. Wraps `data/pokedex.json` (species dex), exposes `spriteUrl(id)`/`pokemonName(id)`; used by the archetype/Pokédex picker (deck archetypes), a separate concept from a player's personal Pokémon Player ID.

## Components

- `player-fields-form.tsx` — full edit form (alias, first/last name, Pokémon ID, game ID); reused by `/me` and the admin edit page.
- `player-id-prompt.tsx` — `PlayerIdPrompt`, dismissing-on-success inline prompt shown on the landing page only when `player && !player.pokemon_id`, posts to `updateMyPokemonIdAction`.
- `player-name-form.tsx` — minimal alias-only form (create managed player).
- `player-quick-edit-row.tsx` — admin list row: badge (linked/managed), edit/delete links+buttons, inline Pokémon/game ID quick form.
- `merge-players-form.tsx` — two selects (from/into) posting to `mergePlayersAction`.
- `copy-pokemon-ids.tsx` — admin utility, copies all participants' Pokémon IDs (newline-joined) to clipboard for tournament software; not merge/profile-specific.

## Database

- `players` (base, 0003): `display_name` not null, `user_id` unique FK to `auth.users` nullable, `created_by`, `created_at`. RLS: public select, insert/update by admin or self. Ownership-guard trigger blocks non-admins changing `user_id`/`created_by`. `player_claims` table (pending/approved/rejected, one pending per player+requester). Security-definer RPCs: `create_own_player`, `create_managed_player`, `request_player_claim`, `approve_player_claim`, `reject_player_claim`, original `merge_players` (repoints claims, deletes source).
- `0004_player_profile_fields.sql` — adds `first_name`/`last_name`/`pokemon_id`/`game_id`; auto-creates a linked player on signup (`handle_new_user`); redefines claim approval so claiming = merge the caller's auto-player into the managed player, then link it.
- `0029_merge_players_fix.sql` — fixes 3 bugs in `merge_players`: carries `user_id` across (frees it from the source if the target has none, so the surviving row keeps the login); moves (not drops) non-conflicting `session_participants` rows before deleting leftovers; extends the move-then-delete pattern to `event_registrations`, `event_lists`, `event_staff` (previously cascade-deleted). `matches` rows are straight repointed (no uniqueness constraint).

## Notes on recent fixes

Commit `06ba9c7` ("Fix session/event page crash for joined participants") fixed `app/events/[slug]/page.tsx` and the session page passing a non-serializable inline closure as `onVisibilityChange` to the client `ArchetypePicker` instead of a bound server action — this only broke pages for participants who had already joined.
