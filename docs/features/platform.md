# Platform / Cross-Cutting

i18n, theming, realtime updates, site navigation, game-specific domain routing, and shared utilities.

## i18n

- `next.config.ts` — wraps `NextConfig` with `createNextIntlPlugin()` (next-intl Next.js integration).
- `i18n/request.ts` — `getRequestConfig` for next-intl; single hardcoded locale (`"es"`), loads `messages/es.json`. A comment notes it's structured so a cookie/header-based locale lookup can replace the constant later — no locale routing/prefixing exists today.
- `messages/es.json` — only translation file (namespaces incl. `theme`, `nav`, `placeholder`, etc.), referenced via `useTranslations`/`getTranslations` in client/server components respectively.
- No `[locale]` route segment — locale is not part of the URL; there is no middleware locale detection since only one locale is supported.

## Theming

- `components/theme-provider.tsx` — thin client wrapper around `next-themes`'s `ThemeProvider`, forwarding all props (class-based dark mode).
- `components/theme-toggle.tsx` — client button using `useTheme()` from next-themes; toggles light/dark, guards against hydration mismatch with a `mounted` flag, label sourced from the `theme.toggle` i18n key.

## Realtime

- `components/realtime-refresher.tsx` — client component mounted on live session/round display views. Opens a Supabase Realtime channel `session-display-{sessionId}` filtered by `session_id=eq.<id>`, listening to `postgres_changes` on `matches`, `rounds`, and `session_participants`; on any change calls `router.refresh()` to re-fetch the server-rendered page. Keeps a 30s `setInterval` fallback poll in case a realtime event is dropped. Cleans up the channel + interval on unmount.
- `lib/supabase/client.ts` — `createClient()` factory (`createBrowserClient` from `@supabase/ssr`) used to obtain the browser client for the above subscription; no channel logic lives here.

## Site navigation

- `components/site-header.tsx` — server component; fetches user/profile/player, renders logo, nav links (leagues, archetypes, "my stats" if linked to a player), `ThemeToggle`, and either `UserMenu` (authenticated) or a sign-in button. Labels come from the `nav` i18n namespace.
- `components/user-menu.tsx` — client dropdown (shadcn `DropdownMenu`) showing avatar/initials, admin badge, admin-only links, plus `/me`, `/settings`, and a sign-out form action.
- `components/breadcrumbs.tsx` — presentational nav rendering a list of `{label, href?}` items with chevron separators; the last/href-less item renders as plain text (current page).
- `app/settings/page.tsx` — currently a placeholder page (`requireUser()` guard + "coming soon" text via the `placeholder` i18n namespace); no real settings implemented yet.

## Tap feedback (PL-27)

Every page is dynamic (auth cookies) and there is no `loading.tsx`, so without this a tap on the phone showed nothing until the server answered.

- `components/ui/button.tsx` — client component. Calls `useFormStatus()` and, when the button is a submit button (`type="submit"` or no `type`) inside a `<form>` whose action is running, renders a `LoaderCircle` spinner (`animate-spin`, `data-icon="inline-start"`) before the label, sets `aria-busy` / `data-pending`, and disables the button with `disabled:opacity-100` so it keeps full opacity instead of the usual 50% fade. Works for plain `<form action={serverAction}>` buttons with no wiring; merges with the explicit `disabled={pending}` that the `useActionState` forms already pass. `asChild` (links styled as buttons) and non-submit buttons never enter the pending state. The base classes also got `active:scale-[0.97]` so the press itself is visible.
- `components/navigation-progress.tsx` — client component mounted once in `app/layout.tsx` (before `SiteHeader`; wraps its inner in `Suspense` because it uses `useSearchParams`). Fixed 3 px bar at the top (`.nav-progress` in `globals.css`, primary color, `transform-origin: left`). A document-level click listener starts it when the click was taken over by Next's `<Link>` (`e.defaultPrevented`), is the primary button, targets a same-origin anchor and its pathname+search differs from the current URL (same-URL and `#hash` clicks would never produce a "done" signal). Phases drive inline `transform`/`opacity`: `loading` creeps to `scaleX(0.9)` over 8 s with the opacity fade delayed 120 ms so prefetched/instant navigations never flash it; `done` (set when `usePathname`/`useSearchParams` commit a different URL) fills to 100% and fades; a 15 s stall timeout resets a navigation that never lands. `router.refresh()` from the realtime refreshers does not change the URL, so it never shows the bar.

## Game-specific domain routing

- `proxy.ts` (root) — Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime behavior, Node.js runtime, same `config.matcher`).
- Mechanism: a static map `GAME_BY_HOST` associates Vercel project hostnames to a game code (e.g. `pkmgranadatcg.vercel.app` → `"tcg"`, `pkmgranadavgc.vercel.app` → `"vgc"`).
- On each request, reads the `host` header (strips port), looks up the game. If the request is for `/` (homepage) and no `?game=` param is already present, it clones the URL, sets `searchParams.game`, and performs a `NextResponse.rewrite` (URL bar stays clean) — the same physical deployment serves both domains, pre-filtered.
- Combined with Supabase auth: `updateSession(request, buildResponse)` (from `lib/supabase/middleware.ts`) is always invoked to refresh the auth session/sync cookies, with `buildResponse` swapped to the rewrite when applicable. Non-matching hosts/paths just get plain `updateSession(request)`. See `docs/features/auth.md`.
- Consumption: `app/page.tsx` reads `searchParams.game` (`"tcg" | "vgc"`) to filter homepage lists (`GAME_ROW_TINT`, `GameBadge`, filter chips built via `buildFilterHref`). Other pages (`/leagues`, `/arquetipos`, admin pages, several server actions) also read/set a `game` param for the same manual filter (not domain-forced beyond the homepage rewrite).

## Utilities

- `lib/format.ts` — Spain-locale (`es-ES`, `Europe/Madrid`) date/cost formatting + "is today/this week" day-boundary helpers for landing-page filters.
- `lib/utils.ts` — `cn()`, clsx + tailwind-merge class combiner (shadcn convention).
- `lib/validation.ts` — server-side text trimming/capping (`capText`, `capTextOrNull`), month/date string normalization (`toMonthDate`), and `isHttpUrl` URL validator.
- `lib/weekday.ts` — weekday enum (0=Sun..6=Sat, matching JS `getDay()` and Postgres `dow`) with label lookup and `HH:MM` time formatter.
- `lib/week-groups.ts` — pure grouping of the landing page's "Esta semana" items into the `sessions` / `tcg` / `vgc` / `others` tabs (unit-tested; see `docs/features/events.md`, landing-page section).
- `lib/filter-href.ts` — builds query-string-preserving filter links (`buildFilterHref`) for game/category/type chips, plus a fixed-color `ACTIVE_FILTER_CLASS` for active-chip styling independent of theme tokens.

## Database migrations and deploy gate (PL-31)

Until PL-31 the SQL in `supabase/migrations/` was pasted by hand in the Supabase SQL editor with no history table; PL-25 (a function edited after it was applied) came from that. Now:

- `.github/workflows/db-migrate.yml` — GitHub Actions, on push to `main` touching `supabase/migrations/**` (or manual dispatch). Steps: `node scripts/migration-lint.mjs` → `supabase db push --db-url $SUPABASE_DB_URL --dry-run` (fails if the dry run would apply `0001`, i.e. the history table is empty and the whole folder would re-run) → `supabase db push` → `POST $VERCEL_DEPLOY_HOOK_URL`. Concurrency group `db-migrate`, no cancel-in-progress. The CLI (`supabase/setup-cli@v1`, 2.116.0, same as the dev dependency) records each applied file in `supabase_migrations.schema_migrations (version, name, statements)` and skips versions already there. `--db-url` needs no `supabase link` and no `config.toml`.
- `scripts/vercel-ignore-build.mjs` — Vercel Ignored Build Step (exit 0 cancels, exit 1 builds). Reads the versions in `supabase/migrations/`, calls `public.migration_versions()` through REST with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, cancels only when a local version is missing on the database. Every failure mode (no env, RPC missing, HTTP error, timeout 10 s) builds, so the gate can never block deploys by itself; the log line is prefixed `[db-gate]`. Deploy-hook builds also run the Ignored Build Step (vercel/vercel#10812), which is why the gate checks the database instead of the git diff: the hook-triggered build passes once the workflow has applied the migration.
- `supabase/migrations/20260906120000_migration_versions.sql` — `public.migration_versions() returns text[]`, plpgsql, `security definer`, `stable`, returns the versions in `supabase_migrations.schema_migrations` (or `{}` if the table/schema does not exist yet), `grant execute` to `anon, authenticated`. Only leaks the version list, which is public in the repo anyway. First migration meant to be applied by the workflow.
- `supabase/baseline.sql` — one-time paste (not a migration, the CLI ignores it): creates the history table and inserts 0001–0052 as applied, `on conflict do nothing`. Generated from the file names.
- `scripts/migration-lint.mjs` (+ `migration-lint.d.mts` for the TS import) — idempotency lint. `stripSql` removes `--` and `/* */` comments, `$tag$…$tag$` bodies (function bodies and `do` blocks, replaced by `$body$`) and string literals, lower-cases and splits on `;`, so only top-level statements are inspected. `lintMigrationSql(sql)` returns one message per problem; `lintMigrationsDir(dir)` applies it to every `.sql` whose version is above `BASELINE_VERSION` (52n) and flags file names that don't match `<digits>_<name>.sql`. `-- migration-lint: ignore` on its own line opts a file out. Rules: create table/index/schema/extension/sequence/materialized view need `if not exists`; view/function/procedure need `or replace`; trigger needs `or replace` or an earlier `drop trigger if exists <name>`; policy needs an earlier `drop policy if exists <name> on <table>` (name and table matched, quotes ignored); create type/domain/role/publication are always errors at top level (must go in a `do $$` block, which the stripper hides); every `drop <kind>` needs `if exists`; `alter table` actions are split on commas and checked one by one (`add column if not exists`, `drop column/constraint if exists`, no `add constraint`, no unnamed constraints, no bare `add <col>`, no `rename`); `alter type … add value if not exists`; `alter publication … add table` and `alter … rename` are errors; `insert into` needs `on conflict` or `where not exists`. Grants, revokes, comments, `enable row level security`, `alter column set …`, `update`, `delete` pass untouched. CLI: `node scripts/migration-lint.mjs [dir]` (`npm run lint:migrations`), exit 1 with `<file>: <message> — "<statement head>"` lines.
- `lib/migration-lint.test.ts` — one passing and one failing snippet per rule, the stripper, the file-name parser, and a test that lints the real `supabase/migrations/` folder so `npm test` catches a non-idempotent migration before it is pushed.
- Setup that lives outside the repo: `SUPABASE_DB_URL` (session pooler, IPv4) and `VERCEL_DEPLOY_HOOK_URL` repo secrets, the deploy hook on `main`, and the Ignored Build Step command. Listed in `DEPLOYMENT.md` → One-time setup.
