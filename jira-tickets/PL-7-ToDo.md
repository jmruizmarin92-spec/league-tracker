# PL-7 — Smoke test for RPC signatures and RLS against the live schema

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.3. The vitest suite covers pure logic only (pairing, scoring, standings, profile, prize pool, deadlines, TDF). Nothing checks that the `supabase.rpc("name", {...})` calls in `app/actions/` match a function that actually exists in the deployed schema, and nothing asserts the RLS rules `PLAN.md` listed under "Auth/RLS". PL-5 is exactly the class of bug this would catch.

## WHY

Migrations are applied by hand and functions get dropped/recreated with new signatures (`DEPLOYMENT.md` documents the pattern). The only guard today is remembering to update every caller. A check that runs in seconds against PostgREST closes that gap without needing a local Supabase.

## Requirements

- A script (`scripts/check-rpc-signatures.ts` or a vitest file that skips itself when `NEXT_PUBLIC_SUPABASE_URL` is unset) that:
  - extracts every `rpc("<name>", { ...keys })` call from `app/actions/**/*.ts` (and `lib/` if any),
  - calls each against `/rest/v1/rpc/<name>` with the anon key and null-ish values for the keys,
  - fails on `PGRST202` (signature not found) and passes on anything else (`Not allowed`, `Not found`, `42501`, `P0001`…). Read-only in effect because every write RPC checks authorization before touching rows — verify that assumption per RPC before adding it, and exclude any RPC that would insert/delete for anon.
- A second set of assertions for RLS, anon and a test user if one is available: cannot create league/event, cannot read `event_lists` of someone else, cannot read `player_decks`, `event_tdf_players`, `event_tdf_imports`, `admin_allowlist`; `report_match` on a match you're not in is refused.
- `npm run check:schema` (or similar) documented in `DEPLOYMENT.md` as a step after applying a migration and before pushing.

## Development needed

* Write the extractor + probe (Node fetch, no new deps).
* Decide the list of RPCs safe to probe anonymously; document the exclusion list in the script.
* Hook into `DEPLOYMENT.md` step 4 ("verify the migration actually landed").
* Optionally wire into CI (PL-12) with the anon key as a secret.

## QA — Dev

- [ ] Script reports PL-5's mismatch before the fix and is clean after.
- [ ] Script is clean for every other RPC call in the repo.
- [ ] RLS assertions pass as anon.
- [ ] `DEPLOYMENT.md` updated.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
