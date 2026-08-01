# Events

An Event is a one-off tournament, distinct from a recurring League — has its own staff, registration/waitlist, optional decklist submission, and archetype tracking, but no Swiss rounds/match reporting of its own.

## Routes

- `app/events/[slug]/page.tsx` — main event detail page: header (name, game/category badges, subtitle, status), prizes, registration/list form (`EventRegister`), self-service archetype picker (locked once event is `complete`), the admin-only roster (`ParticipantsList`: check-in, Pokémon IDs, archetypes, lists, removal — see below), staff roster + add-staff/create-staff-player forms, admin edit form (`EditEventForm`), status toggle (open/closed/complete), and site-admin-only hard delete. Non-admins no longer see the roster at all: it carries player IDs and every submitted list, so it's admin-only in the UI (note the underlying `event_registrations` rows are still world-readable by RLS — only `event_lists` is actually restricted).
- `app/events/[slug]/arquetipos/page.tsx` — public archetype-stats sub-page; renders `computeEventArchetypeStats(event.id)` in an `ArchetypeStatsTable` (no win/loss record, since events aren't Swiss-tracked like leagues).
- `app/admin/events/page.tsx` — admin-only (`requireAdmin`) page hosting `CreateEventForm` to create a new standalone event.

## Server actions (`app/actions/events.ts`)

All are `"use server"`, validate/cap input then call Supabase RPCs; most `revalidatePath`.

- `createEventAction` — validates + calls `create_event` RPC, redirects to the new event.
- `updateEventAction` — direct `.update()` on the `events` table (not an RPC).
- `registerEventAction` / `submitListAction` — register (with optional list) / update submitted list via `register_event` / `submit_event_list` RPCs. Both refuse once the entry deadline has passed (`entryDeadlineError` helper, skipped for event admins) before even calling the RPC, so the user gets a Spanish message instead of the raw SQL error.
- `adminSubmitListAction` — admin bypass: writes any registrant's list via `admin_submit_event_list`, deadline or not.
- `setMyEventArchetypesAction` / `adminSetEventParticipantArchetypesAction` / `setEventArchetypeVisibilityAction` — self vs admin archetype-pick RPC wrappers.
- `unregisterEventAction` / `adminRemoveRegistrationAction` — leave / admin-kick a registrant.
- `adminSetEventCheckedInAction(slug, eventId, playerId, checkedIn)` — on-site check-in toggle via `admin_set_event_checked_in`. The page binds `slug` so the shared roster can call it with the session-style `(contextId, playerId, checkedIn)` signature.
- `setEventStatusAction` — open/closed/complete toggle.
- `addEventStaffAction` / `createEventStaffPlayerAction` / `removeEventStaffAction` — staff management, including creating a "managed" player record for staff not already in the system.
- `deleteEventAction` — hard delete via `delete_event` RPC, redirects home.

## Lib logic

- `lib/events.ts` — data-access layer: `EventRow`/`EventStatus` types, `listEvents`, cached `getEventBySlug`, `isEventAdmin` (site admin or row in `event_admins`), `listRegistrations`, `getMyRegistration` (joins `event_registrations` + `event_lists`), `listEventStaff`, `getEventLists` (admin-only, all submitted lists keyed by player). Also `eventEntryDeadline` / `isEventEntryLocked` (+ `DEFAULT_LIST_LOCK_MINUTES` = 60, `MAX_LIST_LOCK_MINUTES` = 10080), the TS mirror of the `event_entry_locked` SQL function used to gate the UI.
- `lib/event-category.ts` — defines the `Category` union (`cup | challenge | demo | prerelease | others`) with label/icon metadata (`CATEGORIES`), plus `categoryMeta`/`isCategory` helpers.
- `lib/agenda.ts` — powers the landing page. `getUpcoming()` fetches both `sessions` (league-linked) and `events` (standalone) from today onward (not `complete`), normalizes both into a unified `UpcomingItem[]` (kind: "session"|"event") sorted by `startsAt`, feeding the home page's today/this-week/upcoming sections.

## Components

- `create-event-form.tsx` / `edit-event-form.tsx` — client forms (`useActionState`) for all event fields (name, subtitle, category, game — create only, game is immutable after creation —, datetime, location, cost, capacity, external URL, description, prizes, list-required toggle).
- `event-register.tsx` — client component driving both registration and list submission; shows registered/waitlisted badge + unregister button, or a register form (list-required note if applicable), or a "closed" message. Past the entry deadline (`locked` prop) the forms are replaced: registrants see their submitted list read-only plus the deadline notice, non-registrants only the notice. While still open it prints the deadline under the list fields.
- `participant-list-editor.tsx` — admin-only inline view + editor for one registrant's list (collapsed `<details>` summary with an edit toggle), posting to `adminSubmitListAction`. Replaces the old read-only admin list preview on the event page and works after the deadline.
- `participants-list.tsx` (shared with sessions, documented in `docs/features/sessions-rounds.md`) — the event roster reuses it with `contextIdField="event_id"` and `extraFields={{ slug }}`, feeding each row the registrant's `pokemon_id`, the "lista enviada" badge inside the name cell, the remove form as `actions`, and `ParticipantListEditor` as `extra`. Registered and waitlisted render as two instances, the first with the "solo pendientes de check-in" filter.
- `copy-pokemon-ids.tsx` (shared with sessions) — copy-all block under the roster, fed by every registrant's `pokemon_id` (registered + waitlist); players without one are listed underneath as links to their admin player page.
- `add-staff-form.tsx` — client form to attach an existing player as event staff with a free-text role.
- `game-badge.tsx` — small presentational badge (tcg/vgc colored pill), shared with leagues.

## Database

- `events` (base): id, name, slug (unique), game (tcg/vgc), starts_at, location, cost, description, external_url, prizes, list_required, capacity, status (open/closed/complete), created_by, created_at.
- `event_admins` — owner/admin per user.
- `event_registrations` — (event_id, player_id) PK, status (registered/waitlisted), has_list, checked_in (on-site check-in, informational only — it gates nothing).
- `event_lists` — private list content/url, RLS restricted to submitter or admin.
- Later additions: `subtitle` (0018), `category` check constraint extended to add `prerelease` (0023), `event_staff` table + RPCs `add_event_staff`/`create_event_staff_player`/`remove_event_staff` (0024), `archetype1`/`archetype2`/`archetype_public` on `event_registrations` (0036), `list_lock_minutes` (0039), `checked_in` + `admin_set_event_checked_in` (0040, the event twin of sessions' 0037).

## Entry deadline (0039)

`events.list_lock_minutes` (int, default 60, 0–10080) closes registration *and* list submission that many minutes before `starts_at`. `event_entry_locked(p_event)` is the SQL source of truth — `starts_at is null` or `list_lock_minutes = 0` never locks — and both `register_event` and `submit_event_list` raise once it returns true, unless `is_event_admin(p_event)`. Admins bypass the cutoff entirely and get `admin_submit_event_list(p_event, p_player, p_content, p_url)` to write someone else's list. `create_event` was dropped/recreated with a 13th arg `p_list_lock_minutes`; the value is editable in both the create and edit event forms (minutes before start, 0 = no cutoff). Unregistering is deliberately *not* blocked by the deadline.

Key RPCs: `create_event`, `register_event` (handles waitlist via capacity), `submit_event_list`, `unregister_event`/`admin_remove_registration` (promotes from waitlist), `set_event_status`, `set_event_archetypes` (self-service, locked post-complete unless never set), `admin_set_event_archetypes` (unrestricted), `set_event_archetype_visibility`.

## Landing-page integration

`app/page.tsx` consumes `getUpcoming()` from `lib/agenda.ts`; splits into `todayItems`/`thisWeekItems` sections plus a general filterable list (by `game` and `type`/category query params — events filtered via `u.kind === "event" && u.category === typeFilter`). Renders `GameBadge` and `CategoryBadge` per item, distinguishing events from league sessions in the same unified feed.
