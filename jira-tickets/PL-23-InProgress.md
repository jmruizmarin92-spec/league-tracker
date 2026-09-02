# PL-23 — Landing page: "Esta semana" split into tabs (Ligas / TCG / VG / Otros)

Status: In Progress | Type: Story | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

Original ask: there are more events now, so the "Esta semana" block on the landing page needs a way to filter too. Tabs: one for league sessions, one for TCG cups and challenges, one for VG cups and challenges. The game/type filters of the "Próximos" list stay as they are.

Clarified in chat (2026-09-02):
- TCG / VG tabs hold only cups and challenges of that game. Demos, prereleases and "otros" of either game go to a fourth "Otros" tab.
- "Hoy" stays a flat list.
- Tabs with nothing this week are not rendered; the first tab with items opens by default. Labels carry the count, e.g. "Ligas (3)". A single non-empty group still renders as one tab.

## Requirements

- `lib/week-groups.ts` (pure, unit-tested): `groupThisWeek(items)` returns the non-empty groups in fixed order `sessions` → `tcg` → `vgc` → `others`. Sessions = `kind === "session"` of either game; `tcg` / `vgc` = events of that game with category `cup` or `challenge`; `others` = every other event (demo, prerelease, others, null category). Item order inside a group is preserved (already sorted by start).
- `components/upcoming-row.tsx`: the row markup that `app/page.tsx` repeated three times (Hoy card, Esta semana card, Próximos list item) extracted into one component so the tab panels reuse it instead of a fourth copy. No visual change.
- `app/page.tsx`: "Esta semana" renders `PageTabs` (client, `line` variant, state only, no URL param) with one tab per non-empty group, label `<name> (<count>)`, initial = first tab. Hoy and Próximos untouched.
- `messages/es.json` `landing`: `weekTabSessions` "Ligas", `weekTabTcg` "TCG", `weekTabVgc` "VG", `weekTabOthers` "Otros".
- Docs: `docs/features/events.md` landing section, `docs/features/platform.md` utilities bullet.
- No migration, no server action.

## Development needed

* `lib/week-groups.ts` + `lib/week-groups.test.ts`.
* `components/upcoming-row.tsx`; `app/page.tsx` uses it in the three sections.
* `app/page.tsx` "Esta semana" → `PageTabs` over `groupThisWeek(thisWeekItems)`.
* `messages/es.json` (`landing.weekTab*`).
* `docs/features/events.md`, `docs/features/platform.md`.
* Commit on `main`, PL-23 paths only (the tree also carries uncommitted PL-22 work from another session).

## QA — Dev

- [ ] `vitest run` green, `lib/week-groups.test.ts` covers: fixed order, empty groups dropped, cup/challenge split by game, demo/prerelease/others/null → Otros, sessions of both games in one group, order preserved.
- [ ] `tsc --noEmit` clean.
- [ ] `eslint` clean on every touched file.
- [ ] Browser: with sessions + a TCG cup + a VG challenge + a demo in the week, four tabs with counts; switching shows only that group; rows look exactly like before.
- [ ] Browser: a week with only league sessions → a single "Ligas (n)" tab, no empty tabs.
- [ ] Browser: Hoy and Próximos (filters, pagination) unchanged.

## Changes made

## Activity

- 2026-09-02 — Created (To Do → In Progress).

Last updated: 2026-09-02
