# PL-23 — Landing page: "Esta semana" split into tabs (Ligas / TCG / VG / Otros)

Status: In Review | Type: Story | Assignee: José María | Created: 2026-09-02 | Done: —

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

* ✅ `lib/week-groups.ts` + `lib/week-groups.test.ts` (10 tests).
* ✅ `components/upcoming-row.tsx`; `app/page.tsx` uses it in the three sections.
* ✅ `app/page.tsx` "Esta semana" → `PageTabs` over `groupThisWeek(thisWeekItems)`; `components/page-tabs.tsx` doc comment mentions the landing page.
* ✅ `messages/es.json` (`landing.weekTab*`).
* ✅ `docs/features/events.md`, `docs/features/platform.md`.
* ✅ Commit on `main`, PL-23 paths only. `messages/es.json`, `docs/features/events.md` and `jira-tickets/INDEX.md` also carry uncommitted PL-22 hunks from another session, so those three were staged as HEAD + the PL-23 edits (blob written with `git hash-object`, index pointed at it); the working tree keeps both sets of changes. Not pushed.

## QA — Dev

- [x] ✅ `vitest run`: 14 files, 155 tests green, `lib/week-groups.test.ts` 10/10 (2026-09-02): fixed order, empty groups dropped, cup/challenge split by game, demo/prerelease/others/null/unknown → Otros, sessions of both games in one group, order preserved, empty input.
- [x] ✅ `tsc --noEmit` clean (2026-09-02).
- [x] ✅ `eslint` clean on `app/page.tsx`, `components/upcoming-row.tsx`, `components/page-tabs.tsx`, `lib/week-groups.ts`, `lib/week-groups.test.ts` (2026-09-02).
- [x] ✅ Server render against the real DB (`next dev -p 3123`, `curl /`, 2026-09-02): one tablist with "Ligas (2)", "TCG (4)", "VG (4)"; the sessions panel is the visible one, tcg/vgc panels `hidden`; no "Otros" tab because the week has no demo/prerelease/otros; 10 "ESTA SEMANA" rows; Próximos still paginates ("Página 1 de 14"). No Hoy items today, so that section was not exercised.
- [ ] Browser: click through the tabs, rows look exactly like before (card border, tint, badges); Hoy card and Próximos rows unchanged visually.
- [ ] Browser: a week with a demo/prerelease/otros shows the "Otros" tab; a week with only league sessions shows a single "Ligas (n)" tab.
- [ ] Prod smoke after the push/deploy.

## Changes made

### 2026-09-02
**lib**
- `lib/week-groups.ts` (new), `lib/week-groups.test.ts` (new).

**components / pages**
- `components/upcoming-row.tsx` (new).
- `app/page.tsx` (rows via `UpcomingRow`, "Esta semana" tabs).
- `components/page-tabs.tsx` (doc comment only).

**i18n / docs / tickets**
- `messages/es.json` (`landing.weekTabSessions/Tcg/Vgc/Others`).
- `docs/features/events.md` (landing section), `docs/features/platform.md` (utilities bullet).
- `jira-tickets/PL-23-InReview.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-02 — Created (To Do → In Progress).
- 2026-09-02 — Tests, typecheck, lint and server render verified; In Progress → In Review.
- 2026-09-02 — Committed on `main`: `9ea1172` (code, i18n, docs, ticket). Ticket hash line in a follow-up commit.

Last updated: 2026-09-02
