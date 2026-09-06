# Deployment

Two moving parts: the **app** (Vercel, from GitHub) and the **database**
(Supabase Postgres). Since PL-31 both deploy from a push to `main`; the
database step runs first and gates the app when a push carries a migration.

## Stack

- **App**: Next.js 16, hosted on [Vercel](https://vercel.com), auto-deploys
  from the `main` branch of
  `https://github.com/jmruizmarin92-spec/league-tracker.git`.
- **Database**: Supabase Postgres. Schema and seed changes live as SQL files
  in `supabase/migrations/`, applied by the `db-migrate` GitHub Actions
  workflow with the Supabase CLI. The CLI records every applied file in
  `supabase_migrations.schema_migrations` (version + name) and never runs
  the same version twice.

## How a push deploys

1. Vercel's Git integration starts a build for the commit and runs the
   **Ignored Build Step** (`node scripts/vercel-ignore-build.mjs`). The
   script lists the versions in `supabase/migrations/` and asks the database
   which ones are applied (`public.migration_versions()` RPC, anon key).
   - Every version applied → build proceeds. This is the whole story for a
     push without migrations: nothing else runs.
   - A version missing → the build is **canceled**. The app is never
     deployed against a database that lacks its migration.
   - The check cannot run (no env, RPC missing, network) → build proceeds,
     same as before PL-31. It fails open on purpose so it can never brick
     deploys; the log line starts with `[db-gate]`.
2. If the push touched `supabase/migrations/**`, the `db-migrate` workflow
   runs (`.github/workflows/db-migrate.yml`): idempotency lint → dry run
   (refuses to continue if the history table is empty) → `supabase db push`
   → POST to the Vercel deploy hook.
3. The deploy hook starts a new build for `main`. It runs the Ignored Build
   Step again, this time every version is applied, and the app goes live.

A failed migration therefore means no app deploy: the Git build was
canceled and the hook is never called. Fix the file (new migration if the
broken one already partially ran — see below), push again.

## Normal flow

1. **Build the feature.** If it needs a schema or data change, add a file
   `supabase/migrations/<YYYYMMDDHHmmss>_<snake_case_name>.sql` (UTC
   timestamp). Timestamps instead of the old `00NN` counter: several
   sessions work in parallel and two `0053`s would collide.
2. **Write it idempotent.** The rule and the exact checks are in `CLAUDE.md`
   (Database migrations). `npm run lint:migrations` runs the same checks as
   CI; `npm test` includes them.
3. **Test locally**:
   ```
   npm test          # vitest — pure logic + migration lint
   npm run build     # next build — full compile + typecheck
   ```
4. **Commit and push to `main`.** Nothing else. Watch the `db-migrate` run
   on GitHub and the deployment list on Vercel: the Git-triggered build
   should show as canceled by the Ignored Build Step and the deploy-hook
   build as the one that went live.
5. **Verify** as before when it matters: `POST /rest/v1/rpc/<new function>`
   with correctly-shaped args, or `GET /rest/v1/<table>?select=<column>`
   with the anon key. `POST /rest/v1/rpc/migration_versions` returns the
   applied version list.

Never edit a migration file after it has been pushed. The CLI does not
checksum files, so the edit would silently never reach the database (PL-25
happened exactly like this when files were pasted by hand). Write a new
migration instead.

## One-time setup (done once per Supabase project / Vercel project)

1. **Baseline the history.** In the Supabase SQL editor, run
   `supabase/baseline.sql`. It creates `supabase_migrations.schema_migrations`
   and inserts 0001–0052 as applied. Safe to run twice. Check:
   `select count(*) from supabase_migrations.schema_migrations;` → 52.
   The workflow refuses to run while this table is empty (it would re-run
   0001 on a live database).
2. **GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   - `SUPABASE_DB_URL`: the **session pooler** connection string from
     Supabase → Project settings → Database → Connection string
     (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`).
     Not the direct host: it is IPv6-only and GitHub runners have no IPv6.
     Percent-encode the password if it has special characters.
   - `VERCEL_DEPLOY_HOOK_URL`: Vercel → project → Settings → Git → Deploy
     Hooks → create one named `db-migrate` on branch `main`, copy the URL.
3. **Vercel Ignored Build Step**: project → Settings → Git → Ignored Build
   Step → Command: `node scripts/vercel-ignore-build.mjs`. The project env
   vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be
   present (they already are for the app itself).
4. Push. The first run applies `20260906120000_migration_versions.sql`, which
   creates the RPC the gate uses; until then the gate fails open.

## Migrations directory

- `<digits>_<name>.sql`, applied in version order, each once. Files not
  matching that pattern are silently skipped by the CLI (the lint flags
  them).
- Postgres functions can't have parameters added via `create or replace
  function` — `drop function if exists <old signature>` first, then
  `create or replace function` with the new signature and re-`grant execute`.
- New tables need explicit `grant select`/`grant insert`/etc. to `anon`
  and/or `authenticated` — RLS policies alone are not enough for the REST
  API to allow access.
- `supabase/baseline.sql` is not a migration and is not picked up by the
  CLI; it lives next to the folder on purpose.
- Local dev against the prod database: `npx supabase db push --db-url
  "<session pooler url>" --dry-run` shows what CI would apply. Don't run it
  without `--dry-run` from a laptop; that's what the workflow is for.

## Vercel project settings that matter

- **Framework Preset must be "Next.js"**, not "Other". This was
  misdetected once and caused builds to hang until they hit the 45-minute
  timeout. If a deploy is stuck for an unusually long time, check this
  setting first.
- Environment variables (Supabase URL + keys) are configured in the
  Vercel project settings, mirroring `.env.local` used for local dev.
- Ignored Build Step and the `db-migrate` deploy hook, see above.

## Troubleshooting

- **Migration failed in the workflow**: the CLI runs each file in a
  transaction, so a failed file leaves nothing behind and is not recorded.
  Fix the file only if it never reached the database (the workflow log
  shows which versions were recorded); otherwise add a new migration. The
  app was not deployed (Git build canceled, hook never called), so prod is
  still on the previous commit.
- **Workflow says the history is empty**: run `supabase/baseline.sql`
  (one-time setup, step 1).
- **Workflow cannot connect**: check the `SUPABASE_DB_URL` secret is the
  pooler URL and that Network Restrictions on Supabase allow it.
- **Vercel build canceled and no `db-migrate` run**: the push changed a
  migration file the database doesn't have, but the workflow didn't
  trigger (paths filter only watches `supabase/migrations/**`). Run the
  workflow by hand (Actions → db-migrate → Run workflow).
- **Live site broken after a deploy with a migration**: read the
  `[db-gate]` line in the Vercel build log. If it built because the check
  could not run, the migration may not be applied; check
  `migration_versions` via REST.
- **Git push rejected / wrong account (403)**: the machine's stored Git
  credential can drift to the wrong GitHub account. Fix with
  `cmdkey /delete:git:https://github.com`, then push again to re-trigger
  the browser auth flow and pick the right account
  (`jmruizmarin92-spec`).
- **Build stuck / taking forever on Vercel**: check the Framework Preset
  (see above).
- **Commit messages on Windows/PowerShell**: use a heredoc and never
  include literal double quotes in a message passed through a PowerShell
  here-string.
