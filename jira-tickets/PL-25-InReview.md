# PL-25 — Guest list submission fails on prod: `function gen_random_bytes(integer) does not exist`

Status: In Review | Type: Bug | Assignee: José María | Created: 2026-09-04 | Done: —

## Description

Reported 2026-09-04: a player submitting a guest list on a VGC event gets a `gen_random_bytes` error. Reproduced from the anon REST API against `league-challenge-war-lotus-q1-vgc` with a throwaway name/ID: the RPC `guest_submit_event_list` returns `42883 function gen_random_bytes(integer) does not exist`. The call rolls back, so nothing is written (no player, no registration, no list) and the form shows the raw English message.

Cause: the function live on Supabase is an earlier draft of migration 0048 that built the edit token from pgcrypto's `gen_random_bytes()`. On Supabase pgcrypto is installed in the `extensions` schema and the function runs with `set search_path = public`, so the call cannot be resolved. The committed 0048 already uses two `gen_random_uuid()` calls (core Postgres), but that body never reached the database; the 2026-09-02 REST probe only exercised the `Unknown event` guard, which sits before the token line. Not game-specific: TCG events fail the same way.

## Requirements

- Re-apply `guest_submit_event_list` with the committed 0048 body (token = two v4 UUIDs, no extension dependency), same signature and grants, as a new migration. 0048 is not edited: it was already applied.
- The other guest RPCs (`guest_token_hash`, `guest_get_event_entry`, `guest_update_event_list`) already work on prod (probed 2026-09-02 and 2026-09-04) and are left alone.

## Development needed

* ✅ `supabase/migrations/0051_guest_submit_token_fix.sql`: `create or replace function public.guest_submit_event_list(...)` copied verbatim from 0048 (the function block was extracted from the 0048 file, not retyped) + the anon/authenticated grant.
* ✅ `docs/features/events.md`: 0051 noted in the migration list and the guest-lists section.
* ✅ Migration 0051 applied in Supabase (José María, 2026-09-04).
* Commit + push, Vercel deploy is not needed (no app code changed).

## QA — Dev

- [x] ✅ Reproduced on prod before the fix (2026-09-04, anon REST): `guest_submit_event_list` on an open VGC challenge → `42883 function gen_random_bytes(integer) does not exist`; `players` has no row for the probe ID afterwards (rolled back).
- [x] ✅ `0051` contains `gen_random_uuid` and no `gen_random_bytes` outside its header comment; function text is byte-identical to the 0048 block.
- [x] ✅ After 0051 (2026-09-04, anon REST on `league-challenge-war-lotus-q1-vgc`): `guest_submit_event_list` with name "QA probe PL-25" / ID 9999999998 → 64-hex token; `guest_get_event_entry` with that token → the entry (`registered`, content `probe`); submitting the same ID again → "This Pokémon ID is already registered for this event".
- [ ] Leftover: the probe registration is still on that event's roster. `SUPABASE_SERVICE_ROLE_KEY` is empty in `.env.local`, so it could not be deleted from here. Remove "QA probe PL-25" from the admin roster of the War Lotus Q1 VGC challenge (and, if wanted, the unclaimed player with ID 9999999998 from `/admin/players`).
- [ ] Browser (logged out): submit a guest list on a VGC event and on a TCG event → registered badge + private link; reload keeps it; admin roster shows the player with "Sin cuenta".
- [ ] The still-open PL-19 browser QA (duplicate ID, account-holder ID, deadline, edit) can now actually run.

## Changes made

### 2026-09-04
**supabase**
- `supabase/migrations/0051_guest_submit_token_fix.sql` (new).

**docs / tickets**
- `docs/features/events.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-04 — created (In Progress directly: bug with a clear reproduction, no clarifying round). Reproduced on prod via REST, cause identified as prod/file drift of `guest_submit_event_list`. Migration 0051 written. Waiting on: 0051 applied, REST re-probe, commit.
- 2026-09-04 — 0051 applied by José María; verified live via anon REST (token returned, entry readable, duplicate refused). In Progress → In Review. Open: remove the probe registration from the roster, browser check, commit.

Last updated: 2026-09-04
