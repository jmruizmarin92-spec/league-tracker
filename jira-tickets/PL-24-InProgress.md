# PL-24 — Cups and challenges: list mandatory and guest lists on by default

Status: In Progress | Type: Improvement | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

Original ask (2026-09-02, after PL-19 went live and the guest form did not show on a League Cup because its flag was off): make `allow_guest_lists` and `list_required` default to true on creation for cups and challenges, and flip the existing ones too.

Interpretation: defaults, not locks. Both switches follow the category on the create form (hand-picked or filled by the Play! paste) until the TO touches either one; the pokedata importer applies the same rule since it creates events with no form. The edit form is untouched — an existing event is a decision already made. A data migration flips the cups and challenges already in the database.

## Requirements

- `requiresListByDefault(category)` (pure, `lib/event-category.ts`): true for `cup` and `challenge`, false otherwise (incl. empty/null).
- Create form: choosing or pasting a cup/challenge category switches "Lista obligatoria" and "Permitir listas de invitados" on; any other category switches them off; once the TO flips either switch by hand the category stops driving them.
- `importPokedataEventsAction` passes both flags from `requiresListByDefault(ev.category)`.
- Migration `0050`: `update events set list_required = true, allow_guest_lists = true where category in ('cup','challenge')` (8 rows on 2026-09-02, all open).
- Docs updated.

## Development needed

* ✅ `lib/event-category.ts` (`requiresListByDefault`) + `lib/event-category.test.ts`.
* ✅ `components/create-event-form.tsx`: `applyCategory`, `togglesTouched`.
* ✅ `app/actions/pokedata.ts`: both flags from the category.
* ✅ `supabase/migrations/0050_cup_challenge_list_defaults.sql` (written; apply pending — José María).
* ✅ `docs/features/events.md`.
* Commit — pending.

## QA — Dev

- [x] ✅ `vitest run`: 15 files, 157 tests green incl. `event-category.test.ts` (2026-09-02).
- [x] ✅ `npx tsc --noEmit` clean; `eslint` clean on the four touched code files (2026-09-02).
- [ ] Migration 0050 applied; REST check: every `category in (cup,challenge)` event has both flags true, others unchanged.
- [ ] Browser: `/admin/events` → pick Cup → both switches on; pick Otros → both off; flip one by hand, then change category → switches stay as set.
- [ ] Browser: logged out on `/events/september-5-2026-9-30am` → "Inscripción sin cuenta" form visible (PL-19 QA can start here).
- [ ] Browser: pokedata import of a cup creates it with both flags on.

## Changes made

### 2026-09-02
**supabase**
- `supabase/migrations/0050_cup_challenge_list_defaults.sql` (new).

**lib / actions**
- `lib/event-category.ts`, `lib/event-category.test.ts` (new), `app/actions/pokedata.ts`.

**components / docs / tickets**
- `components/create-event-form.tsx`, `docs/features/events.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-02 — created (In Progress directly: the ask was specific enough to skip the clarifying round).
- 2026-09-02 — implemented; tests, typecheck and lint green. Waiting on: migration 0050 applied, commit, browser QA.

Last updated: 2026-09-02
