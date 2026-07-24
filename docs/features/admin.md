# Admin

Site-wide and league/event-scoped admin tooling: managing admins/staff, players, deletions.

## Routes and access gating

| Route | Purpose | Access gate |
|---|---|---|
| `app/admin/events/page.tsx` | Site-wide form to create a standalone (non-league) event | `await requireAdmin()` |
| `app/admin/players/page.tsx` | Tabbed console: approve/reject player-claim requests, create "managed" (loginless) players, list/quick-edit all players, merge players | `await requireAdmin()` |
| `app/admin/players/[id]/page.tsx` | Edit one player's fields (alias, name, Pokémon ID, game ID) | `await requireAdmin()` |
| `app/admin/arquetipos/page.tsx` | Manage global custom archetypes per game (TCG/VGC): add, toggle active, delete | `await requireAdmin()` |
| `app/leagues/[slug]/admin/page.tsx` | League-scoped admin console: details, points config, season duration, weekly schedule + bulk session generation, venue list, league-admin roster, archive/reactivate, hard-delete (site-admin only) | `isLeagueAdmin(league.id)` → redirects to `/leagues/${slug}` if false |

All `app/admin/*` routes gate via `requireAdmin()` (site-wide admin), while the league admin page gates via a league-scoped check (`isLeagueAdmin`) and separately re-checks `getProfile()?.is_admin` inline to show a "danger zone" (hard delete) section only to site admins.

## Components

- `add-admin-form.tsx` — client select+form posting to `addLeagueAdminAction`; picks a user from an "addable" list to grant league-admin role.
- `add-staff-form.tsx` — client select+input+form posting to `addEventStaffAction`; assigns a player as event staff with a free-text role.
- `confirm-delete-button.tsx` — generic client wrapper around `Button` (`type="submit"`) that intercepts `onClick` with `window.confirm(confirmMessage)`, used for irreversible cascading deletes (league/player/etc.).
- `merge-players-form.tsx` — client form using `useActionState` with `mergePlayersAction`; two selects (`from`/`into`) merge an unclaimed managed player's history into a real logged-in account.
- `breadcrumbs.tsx` — generic, reusable nav component (`items: {label, href?}[]`), not admin-specific, but used in admin edit pages for the Home → Section → Item trail.

## lib/auth.ts

Exposes `getUser`, `getProfile` (both `cache`-memoized), `requireUser` (redirect `/login`), and `requireAdmin` — redirects to `/login` if unauthenticated, `/` if `profile.is_admin` is false. `requireAdmin` is the standard guard called at the top of every `app/admin/*` page. Non-site-scoped admin checks use separate `lib/leagues.ts`/`lib/events.ts` helpers (`isLeagueAdmin`, `isEventAdmin`) and SQL-side `is_event_admin`/`is_league_admin`/`is_site_admin` functions used inside RPCs.

## Database

- `0002_grants.sql` — PostgREST table grants only (`select` to anon/authenticated, `insert/update` to authenticated on `profiles`); explicitly does not grant `admin_allowlist` — that table is only readable by the `SECURITY DEFINER` trigger `handle_new_user` (see `docs/features/auth.md`), which auto-sets `profiles.is_admin` on first login if the email matches the allowlist. A trigger blocks non-admins from self-escalating `is_admin`.
- `0014_deletions.sql` — hard-delete pattern (no soft-delete flag) via `SECURITY DEFINER` RPCs: `delete_player` (site-admin only; refuses if the player has a linked account, forcing a merge instead), `delete_session` (league-admin), `delete_league` (site-admin, cascades to sessions/rounds/matches/members), `delete_event` (site-admin, cascades to registrations/lists/admins). Relies on FK `on delete cascade` already in place.
- `0024_event_staff.sql` — `event_staff` table (`event_id`, `player_id` composite PK, free-text `role`), RLS with a public select policy; RPCs `add_event_staff`/`create_event_staff_player`/`remove_event_staff`, each gated by `is_event_admin(p_event)`.
