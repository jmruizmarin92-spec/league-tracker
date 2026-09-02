# PL-4 — Repository audit: inventory, health checks and findings

Status: In Review | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Original ask: "run an audit of the project and create a .md with what's in here". Deliverable is a single markdown document describing the repo as it stands (stack, routes, actions, lib, components, database, docs, tickets), the result of running the project's own checks today, and a ranked list of findings with what was actually verified for each. No code changes.

## Requirements

- One document under `docs/` dated today; self-contained, links to the existing feature docs instead of repeating them.
- Inventory derived from the tree, not from memory: routes from `app/`, actions from `app/actions/`, tables/RPCs/policies from `supabase/migrations/`, docs from `docs/`, tickets from `jira-tickets/`.
- Health checks actually run: vitest, tsc, eslint, next build, npm outdated.
- Findings ranked, each stating how it was verified; anything not verified is labelled as such.

## Development needed

* ✅ Read every file tree, `README.md`, `PLAN.md`, `DEPLOYMENT.md`, `CLAUDE.md`, `AGENTS.md`, all `docs/features/*.md`, `jira-tickets/*`, configs (`next.config.ts`, `proxy.ts`, `tsconfig.json`, `.gitignore`, `components.json`, `i18n/request.ts`, `.claude/settings.json`).
* ✅ Run `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `npm outdated`; grep for `any`, TODO/FIXME, service-role usage, hardcoded Spanish strings.
* ✅ Cross-check `app/actions/sessions.ts` RPC calls against `0033_session_format.sql` and probe the live PostgREST schema (anon key, no mutation possible: `is_league_admin` rejects before any insert) to confirm the signature mismatch.
* ✅ Write `docs/AUDIT-2026-08-21.md`.
* ✅ Create this ticket and add it to `INDEX.md`.
* ✅ Open one ticket per finding (PL-5 … PL-15) and rename every ticket file to `PL-<n>-<Status>.md` (new rule, requested 2026-08-21; documented in `CLAUDE.md` and `INDEX.md`).

## QA — Dev

- [x] ✅ vitest 8 files / 92 tests passing (2026-08-21).
- [x] ✅ `tsc --noEmit` clean; `next build` clean, 22 routes (2026-08-21).
- [x] ✅ eslint: 2 errors + 2 warnings, all pre-existing, listed in the audit (2026-08-21).
- [x] ✅ Finding 5.1 confirmed live: 6-arg `create_session` → `PGRST202`, 9-arg → `Not allowed` (2026-08-21).
- [x] ✅ José María read the audit and asked for a ticket per finding — PL-5 … PL-15 created (2026-08-21).
- [ ] Commit `docs/AUDIT-2026-08-21.md`, `jira-tickets/*` (renames + new tickets), `CLAUDE.md`.

## Changes made

### 2026-08-21
**docs**
- `docs/AUDIT-2026-08-21.md` (new) — the audit.

**tickets**
- `jira-tickets/PL-4-InReview.md` (new); `jira-tickets/INDEX.md` (modified) — PL-4 row, filename-status convention, rows PL-5 … PL-15, next key PL-16.
- `jira-tickets/PL-5-ToDo.md` … `PL-15-ToDo.md` (new) — one ticket per audit finding.
- Renamed: `PL-1.md` → `PL-1-Done.md`, `PL-2.md` → `PL-2-InReview.md`, `PL-3.md` → `PL-3-Done.md`, `PL-4.md` → `PL-4-InReview.md`; references in `PL-2-InReview.md` and `docs/AUDIT-2026-08-21.md` updated.
- `CLAUDE.md` (modified) — filename-status rule under "Local ticket tracking".

## Activity

- 2026-08-21 — Ticket created; audit run (tree read, checks executed, live RPC probe); document written. Status → In Review pending José María's read and the commit.
- 2026-08-21 — José María asked for a ticket per finding and for the status in the file name. PL-5 … PL-15 created (To Do); all ticket files renamed to `PL-<n>-<Status>.md`; rule added to `CLAUDE.md`; audit §7 now lists the tickets. Still In Review pending the commit.

Last updated: 2026-08-21
