# PL-16 — Create an event by pasting its Play! Pokémon tournament page, linked to its store and season league

Status: In Review | Type: Story | Assignee: José María | Created: 2026-08-25 | Done: —

## Description

Original ask: paste the text of a tournament's page from the Play! Pokémon organiser site (name, Tournament ID, League ID, date, event type, format, address, organiser, website, player counts, status…) and have the app create the matching standalone (non-session) event, tied to the right league. There is no API for that site, so the pasted text is the only input.

Clarified in chat (2026-08-25, first pass):
- UI: a textarea on `/admin/events` that prefills the existing create form. Nothing is written until the form is submitted; every field stays editable.
- Stored beyond the existing columns: the Tournament ID (new column, unique, so the same tournament can't be created twice). "Status: Complete" in the paste creates the event already `complete`; "Total Players" becomes the capacity (only when complete); Website → `external_url`; the address block → `location`.
- Category comes from a keyword map on the event type / series (League Cup → cup, League Challenge → challenge, Prerelease → prerelease, demo → demo, anything else → others), editable in the form.

Clarified in chat (2026-08-25, second pass — after 0044 was already applied):
- The Play! "League ID" identifies the store (WAR LOTUS STORE = 6236068) and never changes: the TCG and VGC leagues share it, and so will 27/28. Our leagues are seasons of a store. So the id cannot live on `leagues` (0044 did that, with a unique index that wouldn't even allow the shared id) — it moves to a new `stores` layer.
- Resolution is two-step: League ID → store; then among the store's leagues, the season whose game (Product), format (Format line) and month range fit the event date. One hit → selected; zero or several → league left empty with a note, event attached to the store only unless picked by hand.
- Stores are admin-only for now (`/admin/stores`), no public page.

## Requirements

- `stores` table (name, slug, `play_league_id` digits-only and unique when set); `leagues.store_id` and `events.store_id` nullable FKs (`on delete set null`); 0044's `leagues.play_league_id` dropped.
- `events.league_id` (0044) stays as the optional season link; `events.tournament_id` unique when set. `create_event` takes store, league, tournament id and an initial status; `create_league` takes a store; `updateEventAction` / `updateLeagueDetailsAction` can change them.
- `lib/play-event-paste.ts` (pure, unit-tested) parses the pasted page. `lib/season-match.ts` (pure, unit-tested) maps the page's Format line to our formats and picks the season league: same store, same game, same format (unknown → not filtered), month range covering the date (no range → not ruled out), live seasons before archived ones.
- `/admin/events`: paste box fills the form; store detected → league detected / none fits / several fit notes; missing store or missing League ID warns. Store and league pickers visible and editable; the league picker lists only the chosen store's seasons.
- `/admin/stores`: list with inline name / Play! id edit, leagues + events counts, confirm-delete, create form. Linked from the user menu.
- Event header shows store, league (link) and tournament id; league page shows its store as a badge and lists its linked events.
- Duplicate tournament id or duplicate store Play! id fail with readable messages.

## Development needed

* ✅ `supabase/migrations/0044_event_play_import.sql` (applied 2026-08-25): `events.league_id`, `events.tournament_id`, `create_event` 16 args. Its `leagues.play_league_id` is superseded by 0045.
* ✅ `supabase/migrations/0045_stores.sql`: `stores` + RLS + `create_store`; `leagues.store_id`, `events.store_id`; drop `leagues.play_league_id`; `create_league` 7 args; `create_event` 17 args.
* ✅ `lib/play-event-paste.ts` + test (9 tests, verbatim sample); `lib/season-match.ts` + test (8 tests, the real two-store / three-season setup).
* ✅ `lib/stores.ts` (`Store`, `listStores`, `getStoreById`); `lib/leagues.ts` (`store_id`, `getLeagueById`); `lib/events.ts` (`store_id`, `league_id`, `tournament_id`, `listLeagueEvents`).
* ✅ `app/actions/stores.ts` (create / update / delete); `app/actions/events.ts` (store, league, tournament id, status; duplicate translation); `app/actions/leagues.ts` (store on create and details).
* ✅ `components/create-event-form.tsx` (controlled fields, paste box + notes, store/league/status/tournament id, exports `StoreOption` / `LeagueOption` / `NONE`); `components/edit-event-form.tsx` (store + league + tournament id); `components/create-league-form.tsx` and `components/league-details-form.tsx` (store select); `components/store-admin.tsx` (new); `components/user-menu.tsx` + `site-header.tsx` ("Tiendas" link).
* ✅ Pages: `app/admin/events/page.tsx`, `app/admin/stores/page.tsx` (new), `app/events/[slug]/page.tsx`, `app/leagues/page.tsx`, `app/leagues/[slug]/page.tsx`, `app/leagues/[slug]/admin/page.tsx`.
* ✅ `messages/es.json` (`events.*`, `event.*`, `leagues.*`, `league.eventsTitle`, `leagueAdmin.fieldStore` / `storeNone` / `storeHint`, new `stores` namespace, `nav.adminStores`); `docs/features/events.md` ("Play! Pokémon paste (0044)" + "Stores (0045)"), `docs/features/leagues.md`.
* ✅ Migration 0045 applied in Supabase (José María, 2026-08-25).
* ✅ Commit `e16e9b1` on `main` (2026-08-25), PL-16 paths only; pushed to `origin/main` (`3239c04..e16e9b1`).
* ✅ Vercel deployment for `e16e9b1` finished `success` (GitHub deployments API, 2026-08-25).

## QA — Dev

- [x] ✅ `vitest run`: 10 files, 109 tests green (2026-08-25).
- [x] ✅ `npx tsc --noEmit` clean after the store pass (2026-08-25).
- [x] ✅ `eslint` clean on every touched file (2026-08-25).
- [x] ✅ Migration 0044 applied and probed live via REST (2026-08-25).
- [x] ✅ Migration 0045 applied on Supabase and probed via REST with the anon key (2026-08-25): `create_store`, `create_league` (7 args) and `create_event` (17 args) all answer `Admins only`; `stores` selectable (empty); `leagues.store_id` / `events.store_id` present, all null; `leagues.play_league_id` → "column does not exist".
- [x] ✅ Prod smoke on `pkmgranada.vercel.app` after the deploy (2026-08-25): `/`, `/leagues` 200; `/admin/stores` and `/admin/events` 307 → `/login` when anonymous (admin gate intact). `/events` 404 is pre-existing — there is no index route, only `/events/[slug]`.
- [ ] Browser: `/admin/stores` → create "War Lotus" with `6236068` (and Dune with its id) → counts show 0; set the store on War Lotus 26/27, VGC Lotus 26/27 and GLC Dune 26/27 from their admin pages.
- [ ] Browser: paste the Mid Year Celebration text on `/admin/events` → store "War Lotus" detected, league "War Lotus 26/27" detected (TCG, Standard, 2026-08 inside the range), form filled (name, TCG, others, 2026-08-02 10:00, location, capacity 15, tournament id, status Finalizado, URL, subtitle) → create → event page shows Tienda + Liga link + tournament id; league page shows the event and the store badge.
- [ ] Browser: paste a VGC page with the same League ID → same store, league VGC Lotus 26/27.
- [ ] Browser: paste the same text again → "Ya existe un evento con el Tournament ID 26-08-001970."
- [ ] Browser: paste with a League ID no store carries → warning, store/league empty, event still creatable.
- [ ] Browser: second store with the same Play! id → refused with a readable message.
- [ ] Browser: edit event → change store → league of another store is cleared; save persists.
- [ ] Regression: manual event creation with no paste; create league with and without store; delete a store → its leagues/events stay, unlinked.

## Changes made

### 2026-08-25 (second pass — stores)
**supabase**
- `supabase/migrations/0045_stores.sql` (new).

**lib / actions**
- `lib/stores.ts` (new), `lib/season-match.ts` (new), `lib/season-match.test.ts` (new).
- `lib/leagues.ts`, `lib/events.ts` — `store_id`.
- `app/actions/stores.ts` (new), `app/actions/events.ts`, `app/actions/leagues.ts`.

**components / pages**
- `components/create-event-form.tsx` (store + two-step resolution), `components/edit-event-form.tsx`, `components/create-league-form.tsx`, `components/league-details-form.tsx`, `components/store-admin.tsx` (new), `components/user-menu.tsx`, `components/site-header.tsx`.
- `app/admin/stores/page.tsx` (new), `app/admin/events/page.tsx`, `app/events/[slug]/page.tsx`, `app/leagues/page.tsx`, `app/leagues/[slug]/page.tsx`, `app/leagues/[slug]/admin/page.tsx`.

**i18n / docs**
- `messages/es.json`, `docs/features/events.md`, `docs/features/leagues.md`.

### 2026-08-25 (first pass)
**supabase**
- `supabase/migrations/0044_event_play_import.sql` (new) — `leagues.play_league_id` (superseded), `events.league_id`, `events.tournament_id`, `create_event` 16 args.

**lib / actions**
- `lib/play-event-paste.ts` (new), `lib/play-event-paste.test.ts` (new).
- `lib/leagues.ts`, `lib/events.ts`, `app/actions/events.ts`, `app/actions/leagues.ts`.

**components / pages**
- `components/create-event-form.tsx` (rewritten), `components/edit-event-form.tsx`, `components/league-details-form.tsx`.
- `app/admin/events/page.tsx`, `app/events/[slug]/page.tsx`, `app/leagues/[slug]/page.tsx`, `app/leagues/[slug]/admin/page.tsx`.

**i18n / docs**
- `messages/es.json`, `docs/features/events.md`, `docs/features/leagues.md`.

## Activity

- 2026-08-25 — created (To Do → In Progress after clarifying questions).
- 2026-08-25 — first pass done locally; tests/typecheck/lint green.
- 2026-08-25 — migration 0044 applied by José María, verified live via REST.
- 2026-08-25 — model changed: Play! League ID belongs to a store, not a league. Store layer built (0045).
- 2026-08-25 — migration 0045 applied by José María, verified live via REST.
- 2026-08-25 — In Progress → In Review: committed on main (`e16e9b1`) and pushed; browser QA still open.
- 2026-08-25 — Vercel deploy of `e16e9b1` succeeded; prod smoke OK. Next: stores + league links on prod, then the paste QA.

Last updated: 2026-08-25
