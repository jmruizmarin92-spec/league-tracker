# PL-31 — DB migrations applied by CI: Supabase CLI history table, deploy gate on Vercel, idempotency lint

Status: In Review | Type: Task | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

Original ask (2026-09-06): automate the database changes the way Flyway does it — every deploy applies the pending SQL (structure and data), scripts are idempotent, and a version-control table in the database records what ran.

Clarified: Supabase CLI is fine (Flyway was only the familiar reference; anything with the same behaviour is valid). The database step gates the app deploy only when a push actually carries DB changes. CI against prod only, no local Docker stack. New rule going forward: every migration script must be idempotent.

Until now the 52 files in `supabase/migrations/` were pasted by hand in the Supabase SQL editor, with no history table and no check that a pushed commit had its migration applied (DEPLOYMENT.md's "golden rule"). PL-25 was caused by exactly that: a function edited after it was applied never reached prod.

## Requirements

- Pending migration files are applied to the production Supabase project automatically when they reach `main`, in file order, each one once, recorded in a history table with its version.
- A push that carries a migration is not deployed on Vercel until the migration is applied; a push without migrations deploys as before, with no extra step.
- Migrations written from now on are idempotent (safe to run twice) and this is enforced, not just documented.
- The 52 hand-applied migrations are baselined as applied, never re-run.
- The manual SQL editor step disappears from the normal flow.

## Development needed

- ✅ `supabase` CLI (2.116.0) added as a dev dependency; `npm run lint:migrations` script.
- ✅ `.github/workflows/db-migrate.yml`: on push to `main` touching `supabase/migrations/**` (and on manual dispatch): lint → `supabase db push --dry-run` with a guard that refuses an empty history (would re-run 0001) → `supabase db push --db-url $SUPABASE_DB_URL` → POST the Vercel deploy hook. Concurrency group so two pushes never run at once.
- ✅ `scripts/vercel-ignore-build.mjs`: Vercel Ignored Build Step. Lists local migration versions, calls the `migration_versions` RPC with the anon key, cancels the build (exit 0) only when a local version is missing on the database. Fail-open on any error (no env, RPC missing, network) so it can never brick deploys. Needed because deploy-hook builds also go through the Ignored Build Step (vercel/vercel#10812), so a plain "skip if migrations changed" script would cancel the re-triggered build too.
- ✅ `supabase/migrations/20260906120000_migration_versions.sql`: `public.migration_versions()` security-definer RPC returning the versions in `supabase_migrations.schema_migrations`; plpgsql so it can be created before the history table exists. First migration meant to be applied by the workflow, not by hand.
- ✅ `supabase/baseline.sql`: one-time paste that creates the CLI history table and inserts 0001–0052 as applied (`on conflict do nothing`). Generated from the file names on disk.
- ✅ `scripts/migration-lint.mjs` + `scripts/migration-lint.d.mts`: idempotency lint over top-level statements (comments, strings and `$$` bodies stripped) for every file after the 0052 baseline: create table/index/schema/extension/sequence need `if not exists`; functions/views need `or replace`; triggers need `or replace` or a prior `drop trigger if exists`; policies need a prior `drop policy if exists <name> on <table>`; types/domains/roles/publications must be guarded in a `do $$` block; `add column if not exists`, `drop column/constraint if exists`, no `add constraint` or `rename` outside a guarded block; every `drop` needs `if exists`; inserts need `on conflict` or `where not exists`; file names must match `<digits>_<name>.sql`. `-- migration-lint: ignore` opts a file out.
- ✅ `lib/migration-lint.test.ts`: unit cases per rule plus a test that lints the real `supabase/migrations/` folder, so `npm test` fails on a non-idempotent migration before it is ever pushed.
- ✅ `.gitignore`: `supabase/.temp/`, `supabase/.branches/`.
- ✅ Docs: DEPLOYMENT.md rewritten for the new flow (one-time setup, normal flow, what the gate does, troubleshooting); `docs/features/platform.md` new "Database migrations and deploy gate" section; project `CLAUDE.md` migration rules (idempotent, timestamp file names, never edit an applied file, run the lint).
- One-time setup by José María (cannot be done from here): paste `supabase/baseline.sql` in the SQL editor; add the `SUPABASE_DB_URL` (session pooler) and `VERCEL_DEPLOY_HOOK_URL` repo secrets; create the deploy hook for `main` on Vercel; set the Ignored Build Step command to `node scripts/vercel-ignore-build.mjs`.

## QA — Dev

- [x] ✅ `node scripts/migration-lint.mjs` passes on the current folder (only the new 2026… file is after the baseline); the unit suite covers each rule with a passing and a failing snippet.
- [x] ✅ `scripts/vercel-ignore-build.mjs` run locally with the prod URL + anon key: RPC not there yet → prints the HTTP status and exits 1 (build). Without env vars → exits 1 (build).
- [x] ✅ `npx supabase db push --db-url <dead url> --dry-run` runs without a linked project or `config.toml` (fails only at the connection), so the workflow needs no `supabase link`.
- [ ] Baseline pasted; `select count(*) from supabase_migrations.schema_migrations` = 52.
- [ ] First workflow run (the push of this ticket, after the secrets exist) applies `20260906120000_migration_versions` and triggers the deploy hook; `POST /rest/v1/rpc/migration_versions` with the anon key returns 53 versions.
- [ ] Gate check on Vercel: a later push with a migration shows the Git-triggered build as "Canceled" by the Ignored Build Step and the hook-triggered build as the one that goes live.
- [ ] A push without migrations deploys through the Git integration as before (workflow does not run).

## Changes made

### 2026-09-06

- `.github/workflows/db-migrate.yml` (new)
- `scripts/vercel-ignore-build.mjs`, `scripts/migration-lint.mjs`, `scripts/migration-lint.d.mts` (new)
- `lib/migration-lint.test.ts` (new)
- `supabase/migrations/20260906120000_migration_versions.sql`, `supabase/baseline.sql` (new)
- `package.json`, `package-lock.json` (supabase dev dependency, `lint:migrations` script), `.gitignore`
- `DEPLOYMENT.md`, `docs/features/platform.md`, `CLAUDE.md` (project)
- `jira-tickets/INDEX.md`

## Activity

- 2026-09-06 — created after the clarifying round (Supabase CLI, gate only on pushes with DB changes, CI against prod only, idempotency as a standing rule). In Progress.
- 2026-09-06 — implemented; lint, gate script (fail-open against prod confirmed), unit tests and isolated typecheck green. Committed (`6055989`), not pushed: the push only makes sense once the baseline is pasted and the two secrets exist, otherwise the workflow just fails red. In Progress → In Review.
- 2026-09-06 — note for the first push: `supabase db push` fails when the remote history has a version the checkout lacks, and `baseline.sql` records 0051 (applied on prod, PL-25) which is still uncommitted in another session. Commit 0051 before or together with this ticket.

Last updated: 2026-09-06
