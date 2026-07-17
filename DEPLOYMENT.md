# Deployment

This project has two moving parts that deploy separately: the **app**
(Vercel, from GitHub) and the **database** (Supabase, applied manually).
Neither auto-triggers the other, so the order you do things in matters.

## Stack

- **App**: Next.js 16, hosted on [Vercel](https://vercel.com), auto-deploys
  from the `main` branch of
  `https://github.com/jmruizmarin92-spec/league-tracker.git`.
- **Database**: Supabase Postgres. Schema changes live as SQL files in
  `supabase/migrations/`, applied by hand in the Supabase SQL Editor —
  there is no CLI/CI step that runs them automatically.

## The golden rule

**Never push a commit that depends on a migration before that migration has
been applied to the live Supabase project.** Vercel deploys the instant you
push; if the code expects a column, table, or RPC that doesn't exist yet in
production, the live site breaks for real users immediately.

So the order is always:

1. Migration applied to Supabase (if the change needs one)
2. Verified as actually applied
3. *Then* push to `main`

## Normal deploy flow

1. **Build the feature** — edit code, and if the change needs a schema
   change, add a new numbered file to `supabase/migrations/`
   (`00NN_description.sql`, next number after whatever's already there).
2. **Test locally**:
   ```
   npm test        # vitest — pure logic (pairing, scoring, standings, profile)
   npm run build    # next build — full compile + typecheck
   ```
   Both must pass clean before anything ships.
3. **If there's a migration**, hand the SQL to whoever has the Supabase
   dashboard open and wait for confirmation it ran. Don't push yet.
4. **Verify the migration actually landed** — don't just trust "it ran".
   Query the REST API directly with the anon/publishable key, e.g.:
   ```powershell
   Invoke-WebRequest -Uri 'https://<project>.supabase.co/rest/v1/<table>?select=<new_column>&limit=1' `
     -Headers @{ apikey = '<publishable-key>' }
   ```
   HTTP 200 = the column/table/function exists. HTTP 400 = it doesn't —
   stop and re-check before going further.
5. **Commit** — use a heredoc for the commit message (see note below on
   Windows/PowerShell quoting) and never include literal double quotes in
   a message passed through a PowerShell here-string.
6. **Push to `main`**:
   ```
   git push origin main
   ```
   This alone triggers the Vercel deploy — no separate deploy command.
7. Vercel builds and deploys automatically (typically 1–2 minutes). No
   manual step on the Vercel side is needed as long as the GitHub
   integration is connected.

## If there's no schema change

Skip straight to build → test → commit → push. No need to touch Supabase.

## Vercel project settings that matter

- **Framework Preset must be "Next.js"**, not "Other". This was
  misdetected once and caused builds to hang until they hit the 45-minute
  timeout. If a deploy is stuck for an unusually long time, check this
  setting first.
- Environment variables (Supabase URL + keys) are configured in the
  Vercel project settings, mirroring `.env.local` used for local dev.

## Migrations directory

- Files are named `00NN_short_description.sql` and applied **in order**.
- Postgres functions can't have parameters added via `create or replace
  function` — if a function needs a new parameter, the migration must
  `drop function if exists <old signature>` first, then `create function`
  with the new signature (and re-`grant execute`).
- New tables need explicit `grant select`/`grant insert`/etc. to `anon`
  and/or `authenticated` — this project's Supabase setup does not
  auto-grant, RLS policies alone are not enough for the REST API to allow
  access.
- Nothing in `supabase/migrations/` runs itself. It's a historical record
  + the literal SQL to copy into the Supabase SQL Editor by hand.

## Troubleshooting

- **Git push rejected / wrong account (403)**: the machine's stored Git
  credential can drift to the wrong GitHub account. Fix with
  `cmdkey /delete:git:https://github.com`, then push again to re-trigger
  the browser auth flow and pick the right account
  (`jmruizmarin92-spec`).
- **Live site suddenly broken after a deploy**: almost always a migration
  that wasn't applied (or wasn't applied before the push). Check the
  relevant table/column/function via the REST API as in step 4 above.
- **Build stuck / taking forever on Vercel**: check the Framework Preset
  (see above).
