@AGENTS.md

Identity, voice, formatos, and general principles live in `JMRM/CLAUDE.md` (one level up) — read
that first. This file is project-scoped only.

# Workflow

The user will send very short prompts describing what they want added to the website. Before writing any code or making a plan, always use the AskUserQuestion tool to ask clarifying questions first to refine the request — don't start implementing from a short prompt alone.

After implementing a feature, update the relevant `.md` file(s) under `docs/features/` to reflect the change (routes, server actions, lib logic, components, database, or notable fixes) — keep these docs current, not just the code.

# Local ticket tracking

There is no Jira for this project. Every task we tackle gets a local ticket file under `jira-tickets/` that follows the `jira-ticket-workflow` skill's local-mirror shape, minus any Atlassian calls — the `.md` file is the ticket.

- Keys are sequential `PL-<n>`; `jira-tickets/INDEX.md` lists every ticket (newest first) and says which key is next. Add a row there when creating a ticket and update its Status/Done columns as it moves.
- The file name carries the status: `PL-<n>-<Status>.md` with `ToDo`, `InProgress`, `InReview`, `Done` (e.g. `PL-1-Done.md`). On every status change rename the file with `git mv`, fix the link in INDEX.md and any other reference to the old name (`grep -rn "PL-<n>-" --include=*.md`).
- Create the ticket at the start of a task (after the clarifying questions, before writing code). File shape: `# PL-n — <title>`, a `Status: … | Type: … | Assignee: … | Created: … | Done: …` line, then `## Description`, `## WHY`, `## Requirements`, `## Development needed`, `## QA — Dev`, `## Changes made`, `## Activity`, `Last updated:` at the bottom. Skip `## WHY` when the description already carries the reasoning.
- Content is in English (the skill's Spanish rule is for Horizon client tickets; this is a personal project and the chat is in English). Technical identifiers as-is.
- Statuses: To Do → In Progress → In Review → Done. Mark progress as it happens, the same way the skill does for its local mirror: `✅` prefix on finished Development needed bullets, `- [x] ✅` on verified QA — Dev items, dated `## Changes made` blocks (newest first) listing files created/modified, and one line per event under `## Activity` (created, status changes, time logged, commits). Only mark something done when it was actually done or verified.
- "Log 2h on PL-3" adds a worklog line under `## Activity` — no Jira call.
- Done = committed and QA — Dev verified. Set `Done:` to the date, flip Status, update INDEX.md.
- QA — Dev stays honest: anything not actually verified (browser checks, deploys) stays unchecked and gets called out in chat.

# Database migrations

Schema and data changes are SQL files in `supabase/migrations/`, applied to prod by the
`db-migrate` GitHub workflow with the Supabase CLI (history in
`supabase_migrations.schema_migrations`); the app deploy on Vercel is gated until the migration
is applied. Full flow in `DEPLOYMENT.md`. Rules for every new migration:

- File name `<YYYYMMDDHHmmss>_<snake_case_name>.sql` (UTC timestamp, not the old `00NN`
  counter — parallel sessions would collide). Anything else is skipped by the CLI.
- **Idempotent, always.** The file must be safe to run twice: `create table if not exists`,
  `add column if not exists`, `create or replace function`, `drop ... if exists`,
  `drop policy if exists` + `create policy`, `insert ... on conflict do nothing`, and a
  `do $$ ... $$` block that checks the catalog for the cases Postgres gives no `if not
  exists` for (types, constraints, renames, publications). Run `npm run lint:migrations`
  (also part of `npm test`) — it enforces these on every file after the 0052 baseline and
  fails CI otherwise. The exact rule list is in `scripts/migration-lint.mjs`.
- Never edit a migration once it has been pushed; the CLI does not checksum files and the
  edit would never reach the database. Add a new migration.
- Changing a function's parameters: `drop function if exists <old signature>` first, then
  `create or replace function`, then re-`grant execute`.
- New tables need explicit `grant`s to `anon`/`authenticated` on top of RLS policies.
- Do not hand the SQL to the SQL editor any more: the push applies it. Verification is still
  a REST probe of the new function/column after the deploy-hook build goes green.
