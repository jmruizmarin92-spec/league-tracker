# Authentication & Accounts

Google OAuth via Supabase Auth (PKCE flow). Session lives in cookies, refreshed on every request.

## Files

- `app/login/page.tsx` — server component; redirects home if already authenticated (via `getUser()`), otherwise renders `GoogleSignInButton`.
- `app/auth/callback/route.ts` — OAuth redirect target (Route Handler). Exchanges the PKCE `code` param for a session via `supabase.auth.exchangeCodeForSession()`, redirects to `next` (default `/`). Handles `x-forwarded-host` for prod. Falls back to `/login?error=auth` on failure.
- `app/actions/auth.ts` — `signOut()` server action: `supabase.auth.signOut()`, revalidates root layout, redirects to `/login`.
- `lib/auth.ts` — core auth/authorization helpers, all `react.cache`-memoized per request:
  - `getUser()` — current Supabase auth user or null.
  - `getProfile()` — joins to `profiles` (`id, display_name, avatar_url, is_admin`).
  - `requireUser()` — redirects to `/login` if unauthenticated.
  - `requireAdmin()` — redirects to `/login` (no user) or `/` (not admin) unless `profile.is_admin`.
- `lib/supabase/client.ts` — browser Supabase client (`createBrowserClient`, anon key).
- `lib/supabase/server.ts` — server-side Supabase client (`createServerClient`) wired to Next `cookies()`; used in Server Components/Actions/Route Handlers. Silently no-ops cookie writes when called from a read-only Server Component context.
- `lib/supabase/middleware.ts` — `updateSession(request, buildResponse?)`: creates a request-scoped Supabase client, calls `supabase.auth.getUser()` to revalidate the token, syncs refreshed cookies onto the response. Accepts an injectable `buildResponse` so callers can `rewrite` instead of `next()`.
- `proxy.ts` (root) — Next.js 16's renamed middleware entry point. Calls `updateSession()` on every request (matcher excludes static assets); also does host-based game-domain rewriting (see `docs/features/platform.md`).
- `components/google-sign-in-button.tsx` — client component; calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/auth/callback" } })`.
- `components/user-menu.tsx` — client dropdown: avatar/name/email, admin badge + admin nav links (`/admin/players`, `/admin/arquetipos`, `/admin/events`) when `isAdmin`, plus profile/settings links and a sign-out form bound to the `signOut` server action.

## Flow

`GoogleSignInButton` → Supabase-hosted Google consent → `/auth/callback` exchanges code for session (cookies set) → redirect to app. Session persisted in cookies; refreshed on every request by `proxy.ts` → `updateSession()`, which revalidates the token via `getUser()` before any route logic runs (per Supabase SSR guidance — nothing may run between client creation and `getUser()`). Server Components/Actions read the session through `lib/supabase/server.ts`'s cookie-bound client; `lib/auth.ts` layers user/profile/role helpers on top.

## Database

- `public.admin_allowlist(email text PK)` — seed list of emails that get auto-promoted to admin on first login. No RLS policies; readable only by the `SECURITY DEFINER` trigger below.
- `public.profiles(id uuid PK → auth.users.id, display_name, avatar_url, is_admin bool default false, created_at)` — RLS: select open to all, insert/update restricted to self (`auth.uid() = id`). Trigger `profiles_prevent_is_admin_change` blocks non-admins from flipping `is_admin` on themselves.
- Trigger `on_auth_user_created` → function `handle_new_user` (`SECURITY DEFINER`) auto-inserts a `profiles` row on `auth.users` insert, deriving `display_name` from Google metadata and `is_admin` from an `admin_allowlist` match.

## Role model

Single boolean flag: `profiles.is_admin`. Checked code-side in `requireAdmin()` and via the `isAdmin` prop passed into `UserMenu`. Also enforced at DB level by the anti-escalation trigger. No general RLS gating by `is_admin` was found beyond the `profiles` self-escalation guard — per-domain admin checks (league/event) are separate, see `docs/features/admin.md`.

## Player linkage

`players.user_id` (nullable) links a `players` row to a `profiles`/`auth.users` id. `lib/players.ts`: `getMyPlayer()` looks up the caller's player by `user_id = auth uid`; `listUnclaimedPlayers()` finds players with `user_id is null`. A `player_claims` table (`player_id`, `requested_by`, `status`) supports a claim/approval workflow for a logged-in user to link themselves to an existing unclaimed ("managed") player record. See `docs/features/players.md` for the full claim/merge workflow.
