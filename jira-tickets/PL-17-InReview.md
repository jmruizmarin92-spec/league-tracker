# PL-17 — Store admins: per-store owners/admins who create events and run the store's leagues

Status: In Review | Type: Story | Assignee: José María | Created: 2026-08-25 | Done: —

## Description

Original ask: be able to set admins on the new `stores` objects, different admins for each store, so they can create new events and manage the leagues hanging off their store.

Clarified in chat (2026-08-25):
- A store admin is a full league admin on every league of the store (no need to add them to each `league_members` roster) and can create new leagues under their store.
- Store admins get their own console at `/stores/[slug]/admin`: store details, its leagues (links to the league admin pages) with a create-league form, its events with the create-event form (paste box included, store fixed), and the admin roster. Site admins keep `/admin/stores` for creating/deleting stores.
- Roles mirror `league_members`: `owner` / `admin`. Site admins set owners (and admins) from `/admin/stores`; store owners add/remove admins from the store page. Owners are only added/removed by site admins.
- Events created by a store admin are tied to their store (store fixed, league optional among that store's seasons). They become the event owner as today.

## Requirements

- `store_admins(store_id, user_id, role owner|admin)` with RLS (world-readable, writes only through RPCs). `is_store_admin(uuid)` / `is_store_owner(uuid)` (site admins always pass). `add_store_admin(p_store, p_user, p_role)` and `remove_store_admin(p_store, p_user)`: owners manage admins, only site admins touch owners.
- `is_league_admin` / `is_league_owner` / `is_event_admin` / `is_event_owner` also return true for admins of the league's / event's store, so every existing RLS policy and RPC (league details, sessions, rounds, league admin roster, event status, registrations, staff, TDF import...) opens to store admins without further changes. Hard deletes (`delete_league`, `delete_event`, `delete_player`) stay site-admin only.
- `create_league` and `create_event` accept a caller who is an admin of `p_store_id`; without a store they stay site-admin only. `stores` update policy opens to the store's admins (name / Play! id); insert and delete stay site-admin.
- `lib/stores.ts`: `getStoreBySlug`, `listStoreAdmins`, `isStoreAdmin`, `isStoreOwner`, `listMyStores`, `listAddableStoreUsers`. `lib/leagues.ts` `isLeagueAdmin` and `lib/events.ts` `isEventAdmin` delegate to the SQL helpers so page gates match RLS.
- `/stores/[slug]/admin` (gate `isStoreAdmin`, otherwise redirect home): details form, leagues list + create league (store fixed), events list + create event (store fixed; a pasted page whose League ID belongs to another store warns and keeps the store), roster (owner/admin badges, remove, add form with a role select for site admins only).
- `/admin/stores`: each store row gets its roster (add owner/admin, remove) and a link to its console. User menu lists the stores the user administers.

## Development needed

* ✅ `supabase/migrations/0046_store_admins.sql`: table + RLS, helpers, RPCs, redefined `is_league_admin` / `is_league_owner` / `is_event_admin` / `is_event_owner`, `create_league` / `create_event` gates, `stores` update policy.
* ✅ `lib/stores.ts` (roster + membership helpers), `lib/leagues.ts` / `lib/events.ts` (delegate to SQL helpers), `lib/paste-store.ts` + test (fixed-store paste resolution).
* ✅ `app/actions/stores.ts`: `addStoreAdminAction`, `removeStoreAdminAction`; `updateStoreAction` gated by `isStoreAdmin`.
* ✅ `components/create-event-form.tsx` and `components/create-league-form.tsx`: `fixedStoreId`; `components/store-admin.tsx` roster; `components/store-roster.tsx` (list + add form in one), `components/store-details-form.tsx` (new); `lib/form-labels.ts` (event/league form label bundles shared by `/admin/events`, `/leagues` and the console).
* ✅ `app/stores/[slug]/admin/page.tsx` (new), `app/admin/stores/page.tsx`, `components/site-header.tsx` + `components/user-menu.tsx`.
* ✅ `messages/es.json` (`stores.*` roster keys, `storeAdmin` namespace, `events.pasteStoreMismatch`, `nav.storeAdmin`); `docs/features/events.md`, `admin.md`, `leagues.md`, `auth.md`.

## QA — Dev

- [x] ✅ `vitest run`: 11 files, 117 tests green (2026-08-25) — 8 new in `lib/paste-store.test.ts`.
- [x] ✅ `npx tsc --noEmit` clean (2026-08-25).
- [x] ✅ `eslint` clean on every touched file (2026-08-25).
- [x] ✅ Migration 0046 applied on Supabase (José María, 2026-08-25) and probed via REST with the anon key: `store_admins` selectable (empty); `is_store_admin` / `is_store_owner` / `is_league_admin` / `is_event_admin` answer `false`; `add_store_admin` answers `Unknown store` (function live, checks run before the permission gate); `remove_store_admin` 204; `create_league` (7 args, with and without store) and `create_event` (17 args) answer `Admins only`. Stores present: War Lotus (6236068), Dune Cómics (6234028).
- [ ] Browser (site admin): `/admin/stores` → add a user as owner of War Lotus → the row lists them; `/stores/war-lotus/admin` opens.
- [ ] Browser (store owner, non site admin): user menu shows "Administrar War Lotus"; `/stores/war-lotus/admin` shows details, leagues, events, roster; `/admin/stores` and `/admin/events` still redirect.
- [ ] Browser (store owner): create a league from the store page → lands on the league, store badge set; open `/leagues/<slug>/admin` without being in its roster → allowed; add a league admin there.
- [ ] Browser (store owner): paste the Mid Year Celebration text on the store page → league detected; create → event owner; paste a page with another store's League ID → mismatch warning, store stays; leave League ID blank → creatable.
- [ ] Browser (store owner): add an admin to the roster, remove them; the role select is not shown; cannot remove the owner.
- [ ] Browser (store admin, non owner): roster shows no add/remove controls; can still create events/leagues and edit details.
- [ ] Browser: admin of store A cannot open `/stores/<store-b>/admin` (redirect) and cannot edit a league of store B (RLS: save fails).
- [ ] Regression: site admin flows on `/admin/events`, `/leagues`, league admin pages unchanged.

## Changes made

### 2026-08-25
**supabase**
- `supabase/migrations/0046_store_admins.sql` (new) — applied on Supabase 2026-08-25.

**lib / actions**
- `lib/stores.ts` (roster + membership helpers), `lib/paste-store.ts` + `lib/paste-store.test.ts` (new), `lib/form-labels.ts` (new).
- `lib/leagues.ts`, `lib/events.ts` — `isLeagueAdmin` / `isEventAdmin` call the SQL helpers.
- `app/actions/stores.ts` — roster actions, `updateStoreAction` gate.

**components / pages**
- `components/store-roster.tsx` (new), `components/store-details-form.tsx` (new), `components/store-admin.tsx`, `components/create-event-form.tsx`, `components/create-league-form.tsx`, `components/site-header.tsx`, `components/user-menu.tsx`.
- `app/stores/[slug]/admin/page.tsx` (new), `app/admin/stores/page.tsx`, `app/admin/events/page.tsx`, `app/leagues/page.tsx`.

**i18n / docs**
- `messages/es.json`, `docs/features/events.md`, `docs/features/admin.md`, `docs/features/leagues.md`, `docs/features/auth.md`.

## Activity

- 2026-08-25 — Created (José María via Claude). Status: To Do → In Progress.
- 2026-08-25 — Code written; vitest / tsc / eslint green.
- 2026-08-25 — 0046 applied by José María and probed live via REST. Pending: commit, browser QA.
- 2026-09-02 — vitest (117) and tsc re-run green. In Progress → In Review: committed on main, PL-17 paths only; browser QA still open.

Last updated: 2026-09-02
