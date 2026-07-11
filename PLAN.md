# Plan: Weekly Pokémon League Website

## Context
You run in-person / tabletop Pokémon competitions and want a website to manage them, replacing scattered notes/spreadsheets. The site handles **two games — TCG and VGC —** and two kinds of activity:

**1. Leagues** (ongoing, site-run): **League → Session → Round → Match**
- A **League** is an ongoing competition **for a single game** (TCG *or* VGC). e.g. "War Lotus Summer League" is a TCG league *and* a separate VGC league. It has an owner + co-admins and accumulates points over time.
- A **Session** is a single event day within a league. It inherits the league's game, has its own participating players (differ session to session), its own running admin, and a number of Swiss rounds the running admin decides on the day. Sessions have a date/time, location, and cost.
- A **Round** is one wave of Swiss pairings inside a session.
- A **Match** is one pairing's result.

**2. Independent events / tournaments** (standalone, *not* run through the site)
- Not tied to any league and **not run by the site** (no pairings/rounds/standings here). The site only handles **listing, registration, and list submission**.
- Each event is for one game (TCG or VGC), with a date/time, location, and cost.
- Players **join** and submit a **full list**: **TCG = `.txt` decklist**, **VGC = pokepaste** (pasted text or a pokepaste URL). Lists are **private — visible only to the submitter and event admins.** Whether a list is **required to register is a per-event setting**.

Rules gathered from planning:
- **Login is Google SSO only** (no passwords, no magic links).
- **Players are decoupled from accounts.** Admins can create "managed" player records for people who won't use the app. A logged-in user can **request to claim** a managed player; an admin **approves** the link. Duplicates handled by both prevention (claim approval) and an **admin merge tool**.
- **Creation is site-admin-only; joining is open.** Only site admins (`profiles.is_admin`) create leagues/events and manage the archetype catalog. Any logged-in user can self-join sessions and register for events.
- Players **self-join** any league and any session; the session roster is **fully flexible** (join/drop any round) and standings **only count rounds actually played**.
- **Attendance** (for the attendance point) is earned by **playing ≥1 round** — being paired in at least one round (a bye counts as played). A self-join with zero games played earns nothing, so no-shows aren't rewarded.
- **Optional capacity + waitlist.** Sessions and events can set a max (blank = unlimited); when full, further sign-ups are **waitlisted** and auto-promoted (earliest first) when someone drops/unregisters.
- **First login:** a Google user gets a profile automatically, then is prompted to **claim an existing managed player or create a new one** — preventing duplicates for people the admin pre-created.
- **Result reporting:** either participant reports their own match; **admins can report/correct any match** (needed when two managed players are paired); the next round can't be generated until every current-round match has a result (admin override available).
- **Within a session:** Win = 3, Draw = 1, Loss = 0, ordered by points then **Buchholz** (opponent win %). Drives Swiss pairing and session ranking.
- **League points from a session are win-based, not rank-based:** `league_points = wins × win_value + attendance_value` (defaults: 1/win, 1 for attending; configurable per league). Equal win counts earn equal league points.
- **Session decks = "archetypes," not lists.** Per session, a player optionally picks **two Pokémon** from an **admin-curated, per-game catalog** (each entry = icon + name; separate TCG and VGC catalogs). The player controls whether the pick is **public or private** and can set/change it **before or after** playing (private = "just for my own tracking").
- **Cost:** sessions and events show a **price in EUR, display-only, paid in person** — no online payment.
- **"Próximas sesiones" (upcoming) screen:** a unified, phone-first agenda of upcoming **sessions and events** with date/time, game, league (for sessions), location, and cost — each with a join/register action.
- **UI in Spanish.** **No notifications in v1.** Design is **clean/minimal, not themed**. Neutral placeholder name.

This is greenfield — the directory is empty. Constraint: simplest possible build, low/no cost to host.

## Recommended stack (all free-tier)
- **Next.js 15 (App Router, TypeScript)** — UI + server actions in one codebase. Deploys free on Vercel.
- **Supabase** — Postgres + **Auth (Google provider)** + Row Level Security + Realtime (live display) + **Storage** (archetype-catalog icons). Free tier is ample.
- **next-intl** — i18n from day one (Spanish only now; strings externalized).
- **next-themes** — light/dark handling.
- **Tailwind CSS + shadcn/ui** — clean, minimal, accessible components.
- **Vercel** — free hosting + CI from GitHub.

## Design & UI
Principles: **simple, clean, modern, no decorative flourishes.** Content-first; whitespace and hierarchy over borders/shadows/ornament.
- **Phone-first.** Build at mobile width first, then enhance up. Single-column, thumb-reachable actions, ~44px tap targets. Data tables (standings, pairings, agenda) render as stacked cards or horizontal-scroll on narrow screens. **Exception:** `/sessions/[id]/display` is projector-first (large type, high contrast).
- **Light + dark**, defaulting to the device setting with a persistent **manual toggle** (`next-themes`, class strategy), no theme flash on load.
- **Color:** neutral grays for surfaces/text; a **single blue accent** for primary buttons/links/active/focus. Green/red only semantic (wins/losses), never decorative.
- **Typography:** native **system font stack** — zero webfont load, feels native.
- **Components:** shadcn/ui defaults, minimally styled — flat surfaces, thin borders/subtle elevation only for grouping, one small radius, restrained spacing.
- **Motion:** functional only. **Accessibility:** WCAG AA both themes, visible focus, semantic HTML.
- Design tokens (neutral + blue, radius, spacing) live in the Tailwind config.

## Data model (Postgres via Supabase)
Identity:
- `profiles` — one row per Google account (FK `auth.users`): `display_name`, `avatar_url`, `is_admin` (site admin, manages the archetype catalog).
- `players` — competitor identity, **global**: `id`, `display_name`, `user_id` (nullable — set on claim), `created_by` (admin, for managed players), `created_at`.
- `player_claims` — `id`, `player_id`, `requested_by`, `status` (`pending`/`approved`/`rejected`), `resolved_by`, `resolved_at`.

Leagues (site-run):
- `leagues` — `id`, `name`, `slug`, `description`, **`game` (`tcg` | `vgc`)**, `win_value` (1), `attendance_value` (1), `draw_value` (0), `created_at`.
- `league_members` — admins only: `league_id`, `user_id`, `role` (`owner` | `admin`).
- `sessions` — `id`, `league_id`, `name`, **`starts_at`**, **`location`**, **`cost`** (EUR), **`capacity`** (nullable = unlimited), `status` (`setup` | `active` | `complete`), `created_by`. (Game inherited from league.)
- `session_participants` — `session_id`, `player_id`, **`status`** (`registered` | `waitlisted`), `joined_round`, `dropped_round` (nullable), **`archetype1_id`**, **`archetype2_id`** (FK `archetype_options`, nullable), **`archetype_public`** (bool, default true).
- `rounds` — `id`, `session_id`, `number`, `status` (`pending` | `active` | `complete`).
- `matches` — `id`, `round_id`, `session_id`, `player1_id`, `player2_id` (nullable = **bye**), `result` (`pending` | `p1_win` | `p2_win` | `draw` | `bye`), `reported_by`, `reported_at`.

Archetype catalog (admin-curated, shared per game):
- `archetype_options` — `id`, **`game`** (`tcg` | `vgc`), `name`, `icon_url` (Supabase Storage), `active`, `created_by`. Separate lists per game; managed by site admins.

Independent events (standalone):
- `events` — `id`, `name`, `slug`, **`game`** (`tcg` | `vgc`), `starts_at`, `location`, `cost` (EUR), `description`, **`external_url`** (payment/registration link), **`prizes`** (text — prize breakdown), **`list_required`** (bool), **`capacity`** (nullable = unlimited), `status` (`open` | `closed` | `complete`), `created_by`.
- `event_admins` — `event_id`, `user_id` (owner + co-admins for an event).
- `event_registrations` — `id`, `event_id`, `player_id`, **`status`** (`registered` | `waitlisted`), **`list_text`** (nullable — TCG .txt / VGC pokepaste text), **`list_url`** (nullable — pokepaste link), `submitted_at`, `registered_at`.

Derived (not stored):
- **Session standings** (`lib/scoring.ts`): from a session's `matches` → points (3/1/0), wins, Buchholz; respects `joined_round`/`dropped_round` (only played rounds count).
- **League standings** (`lib/scoring.ts`): across sessions → `Σ wins × win_value + sessions_attended × attendance_value` (+ draws × `draw_value`), where `sessions_attended` counts only sessions in which the player played ≥1 round.

Row Level Security:
- Public `SELECT` on leagues/sessions/standings/schedule/events (listings) and on **public** archetype picks.
- **Creating** leagues and events is restricted to site admins (`profiles.is_admin`); joining/registering is open to any authenticated user.
- A match result is writable by its two participants (one player reports, final) **and by session admins** (who can also correct any result).
- **Private lists:** `event_registrations.list_*` readable only by the registrant and that event's admins.
- **Private archetype picks:** an `archetype_public = false` pick is readable only by that player (+ admins).
- League/event admins manage their sessions/rounds/pairings/registrations/claims/merges. Archetype catalog is site-admin only. Managed-player creation and merge are admin-only.

## Key logic
**Swiss pairing** — `lib/pairing.ts`, pure + unit-tested. `generateRoundPairings(activeParticipants, pastMatches, standings)`:
1. Active set = participants with `joined_round ≤ current` and no `dropped_round ≤ current`.
2. Sort by session points, then Buchholz.
3. Greedily pair adjacent players who haven't met; backtrack on rematch.
4. Odd count → **bye** (counts as a win) to the lowest-ranked player without a prior bye.
Late joiners enter at current standings; drops leave. Standings count only played rounds — no back-filled losses.

**Player merge** — `lib/merge.ts`, admin-only: merge B into A → reassign `session_participants`, `matches` (both slots), `player_claims`, `event_registrations` from B to A, then delete B.

**Capacity & waitlist** — `lib/waitlist.ts`: on join/register, if `capacity` is set and full, the new sign-up is `waitlisted`; on a drop/unregister that frees a slot, promote the earliest-registered `waitlisted` entry to `registered`.

**First-login onboarding** — on first Google login, create the `profile`, then route to a chooser: claim an existing managed player (→ `player_claims`, admin-approved) or create a fresh player linked to the account.

**List handling** — events store the raw submission (TCG `.txt` text or VGC pokepaste text/URL); no parsing needed in v1. Cost is display-only (EUR) — no payment flow.

## Pages / routes (labels in Spanish)
- `/` — home; highlights upcoming + links to leagues.
- `/agenda` — **"Próximas sesiones y eventos":** unified upcoming list of sessions + events with date/time, game (TCG/VGC), league (sessions), location, cost, and a join/register action.
- `/login` — Google SSO.
- Leagues: `/leagues` (list), `/leagues/[slug]` (home: active session + standings snapshot), `/leagues/[slug]/clasificacion` (standings), `/leagues/[slug]/sesiones` (session history), `/leagues/[slug]/admin` (co-admins, point config).
- Sessions: `/sessions/[id]` (rounds, pairings, standings, **join**, **archetype picker** with public/private toggle), `/sessions/[id]/display` (projector live view, Realtime), `/sessions/[id]/admin` (add managed players, set/advance rounds, generate pairings, correct results, approve claims, merge).
- Events: `/events` (list), `/events/[slug]` (details, cost, **register + submit/edit your private list**), `/events/[slug]/admin` (registrations, toggle list-required, view submitted lists, close).
- Players: `/players/[id]` (career win/attendance totals, per-league standings history, **public archetypes used per session**, head-to-head). `/me` (linked player + claim requests + private archetype tracking).
- Admin: `/admin/arquetipos` — site-admin management of the **TCG and VGC archetype catalogs** (icon + name; icon upload to Storage).

## Build order (each phase independently runnable)
1. **Scaffold** — `create-next-app` (TS, App Router, Tailwind), shadcn/ui, next-intl (es), next-themes, Supabase project, env wiring, deploy empty page to Vercel.
2. **Auth** — Google SSO, `profiles` auto-created on first login, `is_admin` flag, login/logout, admin-only creation gate.
3. **Players & claims** — global players, managed players, **first-login claim-or-create onboarding**, claim→approve, merge tool.
4. **Leagues & roles** — (site-admin) create league (with **game**), owner + co-admins, point config.
5. **Sessions & participants** — create session (starts_at/location/cost/**capacity**), self-join with **waitlist**, flexible join/drop with waitlist promotion.
6. **Archetype catalog & picker** — site-admin catalogs per game (icon+name, Storage upload); per-session pick of two archetypes with **public/private** toggle.
7. **Rounds, pairing & session standings** — set rounds on the fly, Swiss pairing, Buchholz standings. Core loop.
8. **Match reporting** — participant reports winner/draw; standings update.
9. **League standings** — cross-session aggregation (wins + attendance).
10. **Independent events** — (site-admin) standalone events (game/cost/location/**capacity**), registration with **waitlist**, **private list submission** (TCG .txt / VGC pokepaste), per-event list-required toggle, event admins.
11. **Agenda / "Próximas sesiones"** — unified upcoming screen of sessions + events with cost/location/game.
12. **Live display** — projector view with Realtime auto-refresh.
13. **Player profiles** — records, public archetypes, per-league history, head-to-head.
14. **Polish** — mobile layout, empty states, validation, seed script.

## Critical files to create
- `lib/supabase/{server,client}.ts` — Supabase clients.
- `lib/pairing.ts` — Swiss pairing + Buchholz + flexible pool (pure, unit-tested).
- `lib/scoring.ts` — session standings + configurable league-point formula.
- `lib/merge.ts` — player merge (incl. event registrations).
- `lib/waitlist.ts` — capacity check + waitlist promotion (sessions and events).
- `supabase/migrations/*.sql` — schema + RLS + Storage bucket for archetype icons.
- `app/actions/*.ts` — server actions: create league/session/event, join, report result, generate round, approve claim, merge, register+submit list, manage archetype catalog.
- `messages/es.json` — Spanish UI strings.
- `app/**` — the routes above.

## Verification
- **Unit tests** (`vitest`):
  - `pairing`: no rematches; correct byes; late join at current standings; drop removed from future rounds.
  - `scoring`: session points (3/1/0) + Buchholz; standings ignore unplayed rounds; league points = wins×win_value + attendance; equal wins → equal points.
  - `merge`: all history (incl. event registrations) reassigned, no orphans.
- **End-to-end local** (`npm run dev` + Supabase, seed ~6 players):
  - Leagues: create TCG league + VGC league → session → self-join + admin-add managed player → pick two archetypes (one public, one private) and confirm visibility rules → generate rounds → report results → drop a player mid-session (standings reflect only played rounds) → next round has no rematches → close session → league points aggregate correctly → claim a managed player, admin approves → create a duplicate and merge → `/sessions/[id]/display` live-updates on a result.
  - Events: create a TCG event (list required) and a VGC event → register → submitting a `.txt` / pokepaste unblocks registration → confirm a list is visible only to the submitter + event admin, not other players.
  - Capacity/waitlist: set a cap of 2, register 3 → 3rd is `waitlisted` → one drops → 3rd auto-promoted to `registered`.
  - Attendance: a player who self-joins but plays 0 rounds earns no attendance point; playing ≥1 round earns it.
  - Onboarding: first Google login prompts claim-or-create; claiming routes through admin approval.
  - Agenda: `/agenda` shows upcoming sessions + events with correct game/cost/location; past ones excluded.
- **Auth/RLS**: a non-site-admin cannot create a league/event; reporting a match you're not in is rejected (but a session admin can correct any match); only admins run sessions/events/approve/merge/catalog; another player cannot read your private list or private archetype; logged-out visitors can view listings/standings but not edit.
- **Deploy smoke test**: push → Vercel preview → Google login + view standings + agenda + live display.

## Deferred (not v1)
- Online payment (cost is display-only, paid in person).
- Notifications (email/push).
- Site-run tournaments with brackets; multiple concurrent seasons under one league.
- Decklist parsing/validation, legality checks.
- Additional languages (architecture supports it; only Spanish shipped).
- Themed/branded visual design and final site name.
