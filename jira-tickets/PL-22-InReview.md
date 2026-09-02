# PL-22 — Event staff can see the roster and the submitted lists (read-only)

Status: In Review | Type: Story | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

Original ask: "staff from an event should be able to see lists from those events".

Clarified in chat (2026-09-02):
- Scope: staff get the Inscritos tab read-only — roster, check-in tally, Pokémon IDs and each registrant's submitted list. No check-in toggle, no remove, no archetype edits, no list edits, no Gestión tab.
- Who: anyone in `event_staff` whose player row is linked to the logged-in user, whatever the free-text role says. Managed staff (no account) can't log in anyway. Admins who are also staff are just admins.

## WHY

Judges deck-check against the submitted list. Until now `event_lists` was readable only by the submitter and event admins, and the Inscritos tab was admin-only, so a judge had to be made event admin (with edit, delete and import rights) just to read lists.

## Requirements

- `is_event_staff(p_event uuid)` SQL helper: `event_staff` row for the event joined to `players.user_id = auth.uid()`. `security definer`, granted to anon/authenticated (anon just gets false).
- `event_lists` select policy gains the staff branch; the write path is untouched (`admin_submit_event_list` still requires `is_event_admin`).
- `lib/events.ts` `isEventStaff(eventId)` mirrors it via RPC.
- Event page: `canViewRoster = admin || staffViewer` gates the Inscritos tab, the lists fetch and the initial-tab choice. Staff render is read-only: static check-in icon, no archetype button, no remove form, list view without the edit toggle, plain names (no `/admin/players` links) in the missing-ID line, "Vista de staff" hint on top.
- Docs (`docs/features/events.md`, `docs/features/sessions-rounds.md`) and `messages/es.json` updated.

## Development needed

* ✅ `supabase/migrations/0049_event_staff_lists.sql`: `is_event_staff`, drop `event_lists_select_own_or_admin`, create `event_lists_select_own_admin_or_staff`.
* ✅ `lib/events.ts`: `isEventStaff`.
* ✅ `components/participants-list.tsx`: `readOnly` prop (static `CircleCheck`/`Circle` instead of the switch, archetype button hidden, `setCheckedInAction` optional, toggle no-ops).
* ✅ `components/participant-list-editor.tsx`: `readOnly` prop (view only, no toggle/form).
* ✅ `app/events/[slug]/page.tsx`: `isEventStaff` in the parallel fetch, `canViewRoster`, read-only roster wiring, admin-only remove form and player links, `staffReadOnly` hint, `initialTab`.
* ✅ `messages/es.json`: `event.staffReadOnly`.
* ✅ `docs/features/events.md` (routes, lib, components, database, new "Staff access" section), `docs/features/sessions-rounds.md` (`participants-list.tsx` line).
* ✅ `npx tsc --noEmit` clean, `eslint` clean on the touched files, `vitest run` 145/145 (2026-09-02).
* ✅ Migration 0049 applied in Supabase (José María, 2026-09-02), verified live via REST: `rpc/is_event_staff` returns `false` as anon (function exists; before, a missing function would 404).
* ✅ Commit `d963140` on `main` (2026-09-02), code + migration + docs, pushed to `origin/main`.

## QA — Dev

- [x] ✅ (anon half only) Apply 0049; `select public.is_event_staff('<event>')` as a staff user → true; as a non-staff user → false; as anon → false.
- [ ] As a staff user with a linked player, REST `event_lists?event_id=eq.<event>` returns the event's lists; a non-staff, non-admin user still gets only their own row.
- [ ] Staff user opens `/events/<slug>`: Inscritos tab present with the "Vista de staff" hint, lists expandable per registrant, no switch/remove/archetype/edit-list controls, no Gestión tab, lands on Inscritos when nothing is imported.
- [ ] Same user on an event they are not staff of: no Inscritos tab (unchanged behaviour).
- [ ] Admin view unchanged: switch, remove, archetype picker, list editor, Gestión.
- [ ] Session roster (`/leagues/.../sessions/...`) unchanged (the shared component's default is `readOnly=false`).
- [ ] Staff user cannot write: `admin_submit_event_list` / `admin_set_event_checked_in` RPCs still raise `Not allowed`.

## Changes made

### 2026-09-02

Created: `supabase/migrations/0049_event_staff_lists.sql`, `jira-tickets/PL-22-InProgress.md`.
Modified: `lib/events.ts`, `components/participants-list.tsx`, `components/participant-list-editor.tsx`, `app/events/[slug]/page.tsx`, `messages/es.json`, `docs/features/events.md`, `docs/features/sessions-rounds.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-02 — Created (To Do) after clarifying scope and who counts as staff.
- 2026-09-02 — Status: In Progress. Code, migration file and docs written; typecheck, lint and unit tests pass.
- 2026-09-02 — Migration 0049 applied by José María, RPC verified live. Code committed as `d963140`. Status: In Review — browser and staff-user RLS checks still open.

Last updated: 2026-09-02
