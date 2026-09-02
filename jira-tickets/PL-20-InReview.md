# PL-20 — Pasted Play! events get a composed name: "<type> <store> Q<n> <GAME>"

Status: In Review | Type: Bug | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

The Play! Pokémon paste (PL-16) names the event after the page's first line. That works for events with a custom title (Mid Year Celebration) but League Cups and Challenges have no title on the Play! site: the header repeats the start date, so the first real paste of a cup created `/events/september-5-2026-9-30am` named "September 5, 2026 9:30AM" with subtitle "TCG League Cup Season 1". The name should read like "League Cup Dune Cómics Q1 TCG".

Clarified in chat (2026-09-02):
- Shape: `<type> <our store name> Q<n> <GAME>`. "Season n" in the Play! series line becomes `Qn`.
- Always composed, not only when the title is missing — "Mid Year Celebration" becomes "Mid Year Celebration War Lotus TCG".
- Subtitle keeps the Play! series line as today ("TCG League Cup Season 1").

## Requirements

- A date as the page's first line is not a name: the parser returns `name: null` for it.
- `composeEventName` (pure, unit-tested) builds the name from the series line (fallback: event type, then page title), stripping the leading game token (TCG / VGC / GO), turning "Season n" into `Qn`, then appending the store name and the game in caps. Missing pieces are skipped; nothing usable → null.
- Store name = the matched (or fixed) store's name in our `stores` table; when no store matched, the page's Activity Group as printed; when neither, omitted.
- The create form fills the name with the composed value, capped at 80 chars; subtitle unchanged; the name stays editable before submitting.

## Development needed

* ✅ `lib/play-event-paste.ts`: `parseStartDate(first) === null` guard on the title; `EventNameParts` + `composeEventName`.
* ✅ `lib/play-event-paste.test.ts`: League Cup header sample (date as title, `name` null); `composeEventName` cases (cup, VGC challenge, titled event, fallbacks, series game token).
* ✅ `components/create-event-form.tsx`: store resolution moved before the field fill; `name` from `composeEventName` with the resolved store's name / Activity Group.
* ✅ `docs/features/events.md`: paste section — name rule.
* ✅ Commit `c780f59` on `main` (2026-09-02).

## QA — Dev

- [x] ✅ `vitest run`: 12 files, 129 tests green (2026-09-02).
- [x] ✅ `npx tsc --noEmit` clean (2026-09-02).
- [x] ✅ `eslint` clean on `lib/play-event-paste.ts`, `lib/play-event-paste.test.ts`, `components/create-event-form.tsx` (2026-09-02).
- [ ] Browser: paste the Dune League Cup page on `/admin/events` → name "League Cup Dune Cómics Q1 TCG", subtitle "TCG League Cup Season 1", store Dune Cómics.
- [ ] Browser: paste the Mid Year Celebration text → name "Mid Year Celebration War Lotus TCG".
- [ ] Browser: paste with a League ID no store carries → name uses the Activity Group as printed.
- [ ] Prod: rename the existing event `september-5-2026-9-30am` by hand from its edit form (data, not code).

## Changes made

### 2026-09-02
- `lib/play-event-paste.ts` — date-as-title guard on `name`; `EventNameParts`, `composeEventName`.
- `lib/play-event-paste.test.ts` — `CUP_SAMPLE` header, date-title test, `composeEventName` suite (4 tests).
- `components/create-event-form.tsx` — store resolved before the field fill; name from `composeEventName` (cap 100).
- `docs/features/events.md` — paste section: title rule + composed name.

## Activity

- 2026-09-02 — Created (José María), status In Progress.
- 2026-09-02 — Implementation done, unit tests / tsc / eslint green.
- 2026-09-02 — Committed as `c780f59` on `main`, pushed with PL-21. Status: In Review. Browser checks and the prod rename pending.
- 2026-09-02 — Vercel deployment for `db7ac52` finished `success`; prod smoke OK.

Last updated: 2026-09-02
