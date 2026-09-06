# PL-30 — Public /events page: upcoming and past standalone events (history)

Status: In Review | Type: Feature | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

Original ask (2026-09-06): "i need a historic of non session events (cant acces them right now)".

Clarified: a new public `/events` page linked from the site header next to Ligas, listing every standalone event (cups, challenges, demos, prereleases, others) in two sections: Próximos (soonest first) and Anteriores (newest first), with the same game (TCG / VG) and category filters the landing page already has, as a flat list.

## WHY

The `/events` index was removed in July (commit `182b0d0`) as "redundant with the paginated landing page", but the landing page only shows upcoming items (`getUpcoming()` filters `starts_at >= today` and `status != complete`). Once a cup is over its page is only reachable by typing the slug, so the results, pairings and archetype stats of past events are effectively lost to players.

## Requirements

- `/events` is public (no login), renders every event from `listEvents()`.
- Split rule: an event is "past" when its status is `complete` or its `starts_at` is before the start of today (app timezone); everything else is "upcoming" (events with no date sort last among upcoming).
- Filters: `?game=tcg|vgc` and `?category=<cup|challenge|demo|prerelease|others>` via `buildFilterHref`, applied to both sections; the filter chips only render when there is at least one event.
- Rows reuse `UpcomingRow` (`variant="list"`) so the page looks like the Próximos list of the landing page; past events additionally show the status badge (Finalizado / Cerrado / Abierto) so a closed-but-not-completed old cup is visible as such.
- Header link "Eventos" between Ligas and Arquetipos.
- Docs updated (`docs/features/events.md` routes + landing-page section).

## Development needed

* ✅ `lib/event-history.ts` — pure `splitEventHistory(events, cutoffIso)` returning `{ upcoming, past }` with the sort orders above, plus `lib/event-history.test.ts` (4 cases).
* ✅ `app/events/page.tsx` — the page (server component, search params for the filters).
* ✅ `lib/agenda.ts` — `eventToUpcomingItem` extracted from `getUpcoming()` so both pages build the same row.
* ✅ `components/upcoming-row.tsx` — optional `trailing` slot (status badge on past events).
* ✅ `components/site-header.tsx` — Eventos link.
* ✅ `messages/es.json` — `nav.events`, `events.subtitle`, `events.upcomingTitle`, `events.pastTitle`, `events.noUpcoming`, `events.noPast`.
* ✅ `docs/features/events.md` (Routes, Lib logic, Landing-page integration).

## QA — Dev

- [x] ✅ `vitest run` 180 green (17 files, incl. the 4 new split cases), `npx tsc --noEmit` clean, eslint clean on the six touched code files (2026-09-06).
- [ ] Browser, logged out: `/events` shows Próximos + Anteriores, past cups listed newest first, click through to the event page.
- [ ] Browser: game / category filters narrow both sections; "Todos" chips clear them; empty-filter message shown.
- [ ] Header: Eventos link visible logged in and out.
- [ ] Prod: anonymous curl of `/events` returns 200 with the two headings after the deploy.

## Changes made

### 2026-09-06
- Created: `app/events/page.tsx`, `lib/event-history.ts`, `lib/event-history.test.ts`.
- Modified: `lib/agenda.ts` (`eventToUpcomingItem`), `components/upcoming-row.tsx` (`trailing` prop), `components/site-header.tsx` (Eventos link), `messages/es.json`, `docs/features/events.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-06 — created after the clarifying round (public /events, both sections, flat list with filters). In Progress.
- 2026-09-06 — implemented; tests, typecheck and lint green. In Review.

Last updated: 2026-09-06
