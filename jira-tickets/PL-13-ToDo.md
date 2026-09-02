# PL-13 — `/settings` is a placeholder reachable from the user menu

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.7. `app/settings/page.tsx` renders `placeholder.settingsTitle` + `placeholder.soon` behind `requireUser()`, and `components/user-menu.tsx` links to it. There is nothing to configure there today; the things a user can change (alias, names, IDs, saved decks) live on `/me`.

## Requirements

Decide one:
- Remove the `/settings` route and the menu link (and the `placeholder` namespace keys if nothing else uses them), or
- Give it a purpose: e.g. the timer-alert opt-in that `round-timer.tsx` stores per device in `localStorage` (`league.timer-alerts`), default game (TCG/VGC) for the landing filter, theme preference (already in the header). If there is no concrete setting to put there within the next few tickets, remove it.

## Development needed

* Option A: delete `app/settings/page.tsx`, remove the link from `user-menu.tsx`, prune unused keys in `messages/es.json`, update `docs/features/platform.md`.
* Option B: implement the chosen settings; document in `docs/features/platform.md`.

## QA — Dev

- [ ] Menu has no dead link / settings page works.
- [ ] `npx tsc --noEmit`, `npm run build` clean; no unused i18n keys left behind (grep).

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
