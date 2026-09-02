# PL-21 — Import nearby League Cups and Challenges from the pokedata.ovh events API

Status: In Review | Type: Story | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

Original ask: pokedata.ovh exposes the official Play! Pokémon event locator as JSON (`https://pokedata.ovh/events/api/help`). A query like `_tcg/cups/challenges/_latitude/…/_longitude/…/_radius/200/_unit/km/_start/…/_end/…` returns every announced League Cup and League Challenge in the zone. Use it to create the events of our area instead of pasting each tournament page by hand (PL-16).

Clarified in chat (2026-09-02):
- Shape: an admin import page. It queries the API for the area, lists the upcoming cups/challenges that are not yet in the DB, and imports the ticked ones with one click through the existing `create_event` RPC. Nothing automatic, nothing scheduled.
- Stores: only events whose `league` (the Play! League ID) matches a store in `stores.play_league_id` are importable. Events of unknown shops are listed with the id so the store can be added on `/admin/stores`, but never created and never auto-create a store.
- Zone: ~30 km around Granada (centre 37.1773, -3.5986). Today's 30 km query returns 8 events: the TCG and VG cup + challenge of Alcazaba Juegos (League ID 6234028) and of Nueva Lotus (6236068).
- Name: the same `<type> <store> Q<n> <GAME>` as PL-20. The API has no "Season n", so the quarter is derived from the date with the Play! season calendar: Season 1 runs 1 Sep – 30 Nov (confirmed for the 2027 series), then Dec–Feb, Mar–May, Jun–Aug.

What the API gives per event (checked live 2026-09-02): `type` (League Cup / League Challenge), `name`, `date`, `time` / `when` (wall-clock local time, no zone), `shop`, `street_address`, `city`, `pokemon_url` (carries the tournament id: `…/play-pokemon-tournaments/26-09-005734/`), `league` (Play! League ID), `product` (`tcg` / `vg`), `cost`, `latitude`/`longitude`. No format, no series line, no status for upcoming events.

## Requirements

- `lib/pokedata.ts` (pure mapping, unit-tested): request URL builder for the zone/date window, tournament id from `pokemon_url`, `product` → game (`tcg` → tcg, `vg` → vgc, anything else unsupported), category via the existing `categoryFromType`, Play! season quarter from the date, `when` (Europe/Madrid wall-clock) → ISO instant, proposed name via `composeEventName` fed with a synthetic series line ("TCG League Cup Season 1") and subtitle = that line. Plus `fetchPokedataEvents` (server-only, `no-store`, errors returned not thrown).
- `/admin/events/import` (`requireAdmin`): table of the API's events in the window with date, game, proposed name, Play! shop, matched store, matched season league (`matchSeasonLeague`, format Standard for TCG / Champions for VGC) and a state: importable / already imported (link to the event) / unknown store (League ID shown) / unsupported product. Checkboxes on the importable ones, "select all", one submit.
- `importPokedataEventsAction`: site admin only; re-fetches the API server-side (the client only sends tournament ids), resolves store + league again, calls `create_event` per event (status `open`, cost from the API, location = `street_address`, external URL = `pokemon_url`, tournament id, store, league, no capacity, no guest lists), returns one result line per event (slug or readable error). A duplicate tournament id reads as already imported.
- Link to the import page from `/admin/events`. `messages/es.json` namespace `eventImport`. Docs: `docs/features/events.md` (new section) and `docs/features/admin.md` (route row).
- No migration: everything fits the existing `events` columns and the 18-arg `create_event`.

## Development needed

* ✅ `lib/pokedata.ts` + `lib/pokedata.test.ts` (16 tests: URL/window, tournament id, product, season quarters at every boundary, Europe/Madrid conversion incl. both DST switches, `when` parsing, verbatim record mapping, proposed names). Relative imports on purpose: vitest has no `@/` alias.
* ✅ `app/actions/pokedata.ts` (`importPokedataEventsAction`, `ImportResult` / `ImportState`).
* ✅ `app/admin/events/import/page.tsx` + `components/pokedata-import.tsx` (`ImportRow`, `ImportLabels`, `PokedataImport`).
* ✅ `app/admin/events/page.tsx` (link), `messages/es.json` (`eventImport` namespace, `events.importLink`).
* ✅ `docs/features/events.md` (route, action, lib bullets + "Import from the locator (pokedata.ovh, PL-21)" section), `docs/features/admin.md` (route row).
* ✅ Commit `da39808` on `main` (2026-09-02), PL-21 paths only. Pushed to `origin/main` (`76f117e..db7ac52`, together with PL-20 and the PL-18 files).
* ✅ Vercel deployment for `db7ac52` finished `success` (GitHub deployments API, 2026-09-02).

## QA — Dev

- [x] ✅ `vitest run`: 13 files, 145 tests green, `lib/pokedata.test.ts` 16/16 (2026-09-02). `node_modules` had lost its `.bin` and some transitive packages; `npm install` restored them first.
- [x] ✅ `tsc --noEmit` clean (2026-09-02).
- [x] ✅ `eslint` clean on every touched file (2026-09-02).
- [x] ✅ Live API (2026-09-02, curl): the 30 km TCG+VG query returns 8 events, all of League IDs 6234028 / 6236068, `product` `tcg` / `vg`, `when` as local wall-clock ("2026-09-05 09:30:00" for the cup). Mapping verified in the unit test on a verbatim record of that response (tournament id `26-09-005734`, instant `2026-09-05T14:30Z` for 16:30 CEST).
- [ ] Browser: `/admin/events/import` lists the 8 events; Alcazaba/Nueva Lotus resolve to their stores once the Play! ids are set on `/admin/stores`; tick the TCG cup → import → result line with link → event page shows Tienda, Liga, tournament id, cost 15, date 5 Sep 09:30, URL to pokemon.com.
- [ ] Browser: reload the import page → the imported event shows "Ya importado" with its link; importing it again is not possible (unchecked).
- [ ] Browser: an event of an unknown League ID shows the id and cannot be ticked.
- [ ] Browser: pokedata.ovh unreachable → page renders the error, nothing else breaks.
- [x] ✅ Prod smoke on `pkmgranada.vercel.app` after the deploy (2026-09-02): `/` 200; `/admin/events/import` 307 → `/login` when anonymous (it was 404 on the previous build); `/admin/events` 307 → `/login`.

## Changes made

### 2026-09-02
**lib / actions**
- `lib/pokedata.ts` (new), `lib/pokedata.test.ts` (new).
- `app/actions/pokedata.ts` (new).

**components / pages**
- `components/pokedata-import.tsx` (new), `app/admin/events/import/page.tsx` (new).
- `app/admin/events/page.tsx` (link to the import page).

**i18n / docs / tickets**
- `messages/es.json` (`eventImport`, `events.importLink`).
- `docs/features/events.md`, `docs/features/admin.md`.
- `jira-tickets/PL-21-InReview.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-02 — Ticket created (José María, via Claude). Status: In Progress.
- 2026-09-02 — Implementation done, tests/tsc/eslint green. Status: In Review.
- 2026-09-02 — Committed as `da39808` on `main`.
- 2026-09-02 — Pushed (`db7ac52` tip), Vercel deploy success, prod smoke OK. Pending: browser QA of the import flow.

Last updated: 2026-09-02
