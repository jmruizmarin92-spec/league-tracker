# PL-5 — Session create/edit forms call create_session / update_session with a signature that no longer exists

Status: To Do | Type: Bug | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.1 (`docs/AUDIT-2026-08-21.md`). `createSessionAction` (`app/actions/sessions.ts:37`) calls `create_session` with `p_league, p_name, p_starts_at, p_location, p_cost, p_capacity` and `updateSessionAction` (`:75`) calls `update_session` with `p_session, p_starts_at, p_location, p_cost, p_capacity`. Migration `0033_session_format.sql` (commit `05af81e`, 2026-07-19) dropped those signatures and recreated both functions with three more required parameters — `p_best_of smallint, p_rounds_planned int, p_round_timer_minutes int` — and no later migration restored an overload. `create-session-form.tsx` / `edit-session-form.tsx` never send those fields.

Verified live on 2026-08-21 with the anon key: the 6-arg call answers `PGRST202 Could not find the function public.create_session(p_capacity, p_cost, p_league, p_location, p_name, p_starts_at)`; the 9-arg call reaches the function body (`Not allowed`). So "Crear sesión" on the league page and "Editar sesión" on the session Gestión tab both fail with a raw PostgREST error. Sessions in production were created through `generate_league_sessions`, which is why it went unnoticed.

## Requirements

- Creating a session from the league page works again and lets the admin set best-of (1/3), planned rounds (optional) and round length in minutes (optional) — the columns and the session-page display already exist, the form just never exposed them.
- Editing a session (Gestión tab) works again and can change the same three values.
- Existing sessions keep their values; no migration is needed if the actions pass the params (alternative: a new migration adding `default` values to the three params so old callers work — decide one; passing the params is the better fix because the UI should expose the config anyway).
- No other RPC call in `app/actions/` has the same problem (PL-7 automates this; do a manual pass here for the obvious ones: `grep 'rpc("' app/actions/*.ts` vs the latest `create/replace function` of each name).

## Development needed

* `app/actions/sessions.ts`: read `best_of`, `rounds_planned`, `round_timer_minutes` from the form (validate: best_of ∈ {1,3}, rounds_planned > 0 or null, round_timer_minutes > 0 or null), pass them to both RPCs.
* `components/create-session-form.tsx` and `components/edit-session-form.tsx`: add the three inputs (select for best-of, number inputs for the other two; edit form pre-filled from the session row).
* `messages/es.json`: labels for the three fields (check whether `session.*` already has them from the session header).
* `docs/features/sessions-rounds.md`: replace the "worth double-checking" note with the final state.

## QA — Dev

- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` clean.
- [ ] Browser: create a session from the league page with best-of 3, 4 rounds, 40 min → it appears, header shows the format.
- [ ] Browser: edit that session (Gestión) → change to best-of 1, clear planned rounds → saved, header updated.
- [ ] Browser: leave the three fields blank → defaults (best-of 3, nulls) applied, no error.
- [ ] REST probe with the new arg set returns `Not allowed` (not `PGRST202`) when anonymous.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
