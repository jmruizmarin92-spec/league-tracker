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
- `lib/filter-href.ts` — builds query-string-preserving filter links (`buildFilterHref`) for game/category/type chips, plus a fixed-color `ACTIVE_FILTER_CLASS` for active-chip styling independent of theme tokens.
