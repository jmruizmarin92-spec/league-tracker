# PL-19 — Guest decklist submission on standalone events (no account needed)

Status: In Review | Type: Story | Assignee: José María | Created: 2026-09-02 | Done: —

## Description

Original ask: for events (standalone tournaments, not league sessions) a guest should be able to submit a decklist with their name without registering an account.

Clarified in chat (2026-09-02):
- Storage: a guest submission reuses the managed-player model. It creates (or reuses) an unclaimed `players` row, registers it in `event_registrations` and writes `event_lists` exactly like a logged-in player. Guests show up on the admin roster, count toward capacity / waitlist, feed the Pokémon-ID copy tool, match on TOM `.tdf` import by ID or name, and can later claim the player from `/me`.
- Scope: per-event toggle `events.allow_guest_lists`, default off, in the create and edit event forms. Only events with it on show the guest form to logged-out visitors; everyone else keeps seeing "Entra para inscribirte".
- Identity: full name and Pokémon Player ID, both required. The ID is the dedupe key: it is the natural key TOM uses, so requiring it keeps one row per person.
- Edits: submitting returns a random token. It is stored in an `httpOnly` cookie scoped to the event page and also shown as a private link (`/events/<slug>?guest=<token>`). The same browser (or anyone with the link) sees the submitted list and can edit it until the entry deadline. Nobody can overwrite a list by just typing the same name/ID again.

## Requirements

- `events.allow_guest_lists boolean not null default false`; `create_event` gains an 18th arg `p_allow_guest_lists`; `updateEventAction` writes the column.
- `event_guest_entries (event_id, player_id, token_hash, created_at)` with RLS on and no policies/grants: only the `security definer` RPCs touch it. The token itself is never stored, only its sha256.
- `guest_submit_event_list(p_event, p_name, p_pokemon_id, p_content, p_url) returns text` (the token). Refuses when: guests not allowed, event not `open`, entry deadline passed (`event_entry_locked`), no list content/url, name empty, ID not 1–10 digits, the ID belongs to a player with an account (they must log in), or that player is already registered for the event. Reuses the unclaimed player with that ID, otherwise creates one (`display_name` = name, `pokemon_id`, `created_by` null). Same capacity / waitlist rule as `register_event`.
- `guest_get_event_entry(p_event, p_token)` returns the guest's registration (name, ID, status, list content/url) or nothing; `guest_update_event_list(p_event, p_token, p_content, p_url)` edits until the deadline. All three granted to `anon` and `authenticated`.
- Server actions validate inputs (caps, URL, ID format), set/read the cookie (`event_guest_<eventId>`, httpOnly, sameSite lax, secure in prod, 60 days, path `/events/<slug>`), and translate RPC errors to Spanish.
- Event page: when logged out and `allow_guest_lists` is on, the registration card renders `EventGuestRegister` (form → submitted state with private link + editable list, read-only past the deadline). Token comes from the cookie or the `guest` query param.
- Admin roster: registrants whose player has no account get a small "Sin cuenta" badge so the TO knows which lists came in as guests.
- Docs (`docs/features/events.md`) and `messages/es.json` updated.

## Development needed

* ✅ `supabase/migrations/0048_event_guest_lists.sql`: column, `event_guest_entries`, `create_event` 18 args (body = 0046 + flag), `guest_token_hash`, `guest_submit_event_list`, `guest_get_event_entry`, `guest_update_event_list` + grants to anon/authenticated. Token = two v4 UUIDs (core Postgres, no pgcrypto).
* ✅ `lib/event-guest.ts` (pure) + `lib/event-guest.test.ts` (7 tests): Pokémon ID normalisation/validation, token format check, cookie name/path, private link path.
* ✅ `lib/events.ts`: `allow_guest_lists` on `EventRow`; `GuestEntry` + `getGuestEntry`; `has_account` on `EventParticipant` (from `players.user_id`).
* ✅ `app/actions/events.ts`: `guestSubmitListAction`, `guestUpdateListAction`, `GuestActionState`, `friendlyGuestError`; `allow_guest_lists` on create (RPC arg) and update (column).
* ✅ `components/event-guest-register.tsx` (new); `components/create-event-form.tsx` + `components/edit-event-form.tsx` switch + hint; `lib/form-labels.ts` (`allowGuests`, `allowGuestsHint`).
* ✅ `app/events/[slug]/page.tsx`: `searchParams.guest`, cookie + headers read, guest branch of the registration card, "Sin cuenta" badge in the roster, edit form default + labels.
* ✅ `messages/es.json` (`events.fAllowGuests` / `allowGuestsHint`, `event.eAllowGuests` / `eAllowGuestsHint` / `guest*` / `noAccount`), `docs/features/events.md` (server actions, components, database, new "Guest lists (0048, PL-19)" section).
* ✅ Migration 0048 applied in Supabase (José María, 2026-09-02), verified live via REST.
* ✅ Commit `ffcf75c` on `main` (2026-09-02), PL-19 paths only; PL-20's hunks in `create-event-form.tsx` and `INDEX.md` staged around, not included. Pushed to `origin/main` (`e141129..ad4c15b`, with the ticket commit `ad4c15b`).
* ✅ Vercel deployment for `ad4c15b` finished `success` (GitHub deployments API, 2026-09-02).

## QA — Dev

- [x] ✅ `vitest run lib/event-guest.test.ts`: 7 tests green (2026-09-02). Full suite: 126 passed, 3 failed — the 3 failures are `composeEventName` cases in `lib/play-event-paste.test.ts`, uncommitted PL-20 work in progress in the working tree, not touched by this ticket.
- [x] ✅ `npx tsc --noEmit` clean (2026-09-02).
- [x] ✅ `eslint` clean on every touched file (2026-09-02).
- [x] ✅ Migration 0048 applied on Supabase and probed via REST with the anon key (2026-09-02): `events.allow_guest_lists` selectable (false); `event_guest_entries` → 42501 permission denied for anon; `guest_submit_event_list` (unknown event) → "Unknown event"; `guest_get_event_entry` (bogus token) → `[]`; `guest_update_event_list` (bogus token) → "Unknown guest entry"; `create_event` with 18 args → "Admins only".
- [x] ✅ Committed tree checked in a detached worktree of `ffcf75c` (2026-09-02): `tsc --noEmit` clean, vitest 117 passed; the one suite that could not run (`tdf-sequence.test.ts`) reads the untracked `TOMFiles/` fixtures, absent from any fresh checkout — unrelated.
- [x] ✅ Prod smoke on `pkmgranada.vercel.app` after the deploy (2026-09-02): `/` 200; `/events/september-5-2026-9-30am` 200 and, with `allow_guest_lists` off, still shows "Entra para inscribirte"; same page with a bogus `?guest=` token 200; `/admin/events` 307 → login when anonymous.
- [x] ✅ Live bug found once 0050 turned the flag on (2026-09-02): the anonymous event page returned a 500 error page. Cause: `submittedAs` was passed as a function prop to the client component (`Functions cannot be passed directly to Client Components`); the deploy smoke had only exercised flag-off events. Fixed by passing the "{name}"/"{id}" template string and filling it client-side; reproduced 500 → 200 on a local dev server before pushing.
- [ ] Browser (logged out): event with the flag on → form with name + ID + list → submit → registered badge, "Inscripción de X (ID n)", private link; reload keeps it (cookie); open the private link in another browser → same list; edit → "Guardado."; admin roster shows the player with the ID, "Lista enviada" and "Sin cuenta"; list editor shows the content.
- [ ] Browser: same ID again from a fresh browser → "Ya hay una inscripción con ese Player ID…"; ID of an account holder → "…Inicia sesión para inscribirte."; flag off → "Entra para inscribirte."; past the deadline → read-only list + deadline notice; event closed → "La inscripción está cerrada."
- [ ] Browser: admin removes the guest from the roster → the guest's link/cookie shows the blank form again; re-submitting with the same ID reuses the player.
- [ ] Browser: TOM `.tdf` import matches the guest by ID.
- [ ] Regression: logged-in registration unchanged; create/edit event forms save the toggle; store console create form (`/stores/[slug]/admin`) still renders (it shares `eventFormLabels`).

## Changes made

### 2026-09-02
**supabase**
- `supabase/migrations/0048_event_guest_lists.sql` (new).

**lib / actions**
- `lib/event-guest.ts` (new), `lib/event-guest.test.ts` (new).
- `lib/events.ts`, `lib/form-labels.ts`, `app/actions/events.ts`.

**components / pages**
- `components/event-guest-register.tsx` (new), `components/create-event-form.tsx`, `components/edit-event-form.tsx`.
- `app/events/[slug]/page.tsx`.

**i18n / docs / tickets**
- `messages/es.json`, `docs/features/events.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-02 — created (To Do → In Progress after clarifying questions).
- 2026-09-02 — implementation done locally; unit tests, typecheck and lint green. Waiting on: migration 0048 applied, commit, browser QA.
- 2026-09-02 — migration 0048 applied by José María, verified live via six anon REST probes (column, table lock-down, three guest RPCs, create_event 18 args). Next: commit, browser QA.
- 2026-09-02 — In Progress → In Review: PL-19 paths committed on main (PL-20's uncommitted hunks in `create-event-form.tsx` / `INDEX.md` left out of the commit). Browser QA still open.
- 2026-09-02 — pushed (`ad4c15b`); Vercel deploy succeeded; prod smoke OK. Next: switch the flag on for one event and run the guest-flow browser QA.
- 2026-09-02 — 0050 (PL-24) turned the flag on for the cups/challenges → anonymous event page 500 (function prop to a client component). Fixed, verified locally, committed.
- 2026-09-02 — fix `f93811c` pushed; Vercel deploy `success`; prod `/events/september-5-2026-9-30am` anonymous → 200 with the guest form rendered (`name="pokemon_id"` present). Browser QA of the guest flow still open.

Last updated: 2026-09-02
