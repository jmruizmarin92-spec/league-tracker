# PL-12 — GitHub Actions: run test, typecheck, lint and build on every push

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.7. Tests, tsc, lint and build only run when someone remembers to run them locally before pushing (the `DEPLOYMENT.md` procedure). Vercel runs the build, but not the tests or lint, and it only fails after the push has already happened. A CI workflow makes the checks visible on the commit and on any future PR.

## Requirements

- `.github/workflows/ci.yml` on `push` to `main` and on `pull_request`: Node 20 (match `@types/node`), `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Build needs `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` as repo secrets (the anon key is public anyway, but keep it out of the YAML). Pages are dynamic, so the build doesn't hit the DB, but the env must be present for the Supabase client module to load.
- Lint must pass first (PL-9), otherwise the workflow is red from day one.
- Optional later: PL-7's schema check as a separate job with the anon key secret.
- `DEPLOYMENT.md`: mention that CI runs the same checks and that a red check on `main` means prod is already deployed — so local checks before pushing remain the rule.

## Development needed

* Write the workflow; add the two secrets in GitHub.
* Push, confirm green, fix whatever the runner disagrees with (Windows vs Linux path/case differences are the usual suspect).

## QA — Dev

- [ ] Workflow green on `main`.
- [ ] A deliberate failing test on a branch turns it red.
- [ ] `DEPLOYMENT.md` updated.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
