# PL-28 — Registration card disappears once entry is closed

Status: In Review | Type: Improvement | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

Original ask (2026-09-06): the "Inscripción" box should disappear once the time to register is over — on the September 6 event registration closed at 8:30 and at 10:49 the box was still at the top of the page.

Clarified: a viewer who is registered keeps the box as a read-only copy of what they sent (status badge + list); everyone else sees nothing. Admins lose it too — they add players and fix lists from the roster tools in Inscritos, and on the day the card at the top only gets in the way of Emparejamientos / Importar TOM / Gestión. The same rule applies when the event status is Cerrado or Completo, not only to the time cutoff.

## Requirements

- `entryClosed = status !== "open" || isEventEntryLocked(event)`, for every viewer (no admin bypass on the card).
- Logged in: card rendered only when `!entryClosed || myReg`; past the cutoff `locked` is true so a registered player gets the read-only view.
- Logged out: the guest card follows the same rule with `guestEntry`; the "Entra para inscribirte" line is gone once entry is closed.
- Closed/complete status shows "La inscripción está cerrada." in the read-only card instead of a cutoff time that may be in the future.
- Docs updated.

## Development needed

* ✅ `app/events/[slug]/page.tsx`: `entryClosed` / `entryClosedLabel`, card gating for the three viewer kinds.
* ✅ `components/event-register.tsx`: `locked` prop comment.
* ✅ `docs/features/events.md`.
* ✅ Commit `247e197` on `main`, pushed; Vercel deployment 6291100723 `success` (2026-09-06).

## QA — Dev

- [x] ✅ `vitest run` 157 green, `npx tsc --noEmit` clean, `eslint` clean on the two touched code files (2026-09-06).
- [ ] Browser, admin not registered, event past its cutoff → no Inscripción card, tabs directly under the header.
- [ ] Browser, registered player past the cutoff → card with Inscrito badge + list read-only, no form.
- [x] ✅ Logged out past the cutoff → no guest card and no "Entra para inscribirte" (anonymous curl of `/events/september-5-2026-9-30am` on prod after the deploy, 2026-09-06: 200, neither rendered, tab strip present). Still open: the `?guest=` link → read-only guest card.
- [ ] Browser, event set to Cerrado before the cutoff → card gone for non-registered viewers, "La inscripción está cerrada." for registered ones.

## Changes made

### 2026-09-06
- `app/events/[slug]/page.tsx` (`entryClosed`, `entryClosedLabel`, registration card gated for account / guest / logged-out viewers), `components/event-register.tsx` (comment), `docs/features/events.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-06 — created after the clarifying round (registered keep a read-only card; admins lose it too; closed/complete same rule). In Progress.

- 2026-09-06 — implemented; tests, typecheck and lint green. In Review.
- 2026-09-06 — committed and pushed (`247e197`), Vercel deploy green, anonymous prod smoke OK on the past-cutoff cup. Admin / registered-player / guest-link browser checks still open.

Last updated: 2026-09-06
