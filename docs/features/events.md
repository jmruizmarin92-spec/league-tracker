# Events

An Event is a one-off tournament, distinct from a recurring League — has its own staff, registration/waitlist, optional decklist submission, and archetype tracking, but no Swiss rounds/match reporting of its own.

## Routes

- `app/events/[slug]/page.tsx` — main event detail page: header (name, game/category badges, subtitle, status), prizes, registration/list form (`EventRegister`), self-service archetype picker (locked once event is `complete`), participants list + waitlist with admin removal, staff roster + add-staff/create-staff-player forms, admin edit form (`EditEventForm`), status toggle (open/closed/complete), and site-admin-only hard delete.
- `app/events/[slug]/arquetipos/page.tsx` — public archetype-stats sub-page; renders `computeEventArchetypeStats(event.id)` in an `ArchetypeStatsTable` (no win/loss record, since events aren't Swiss-tracked like leagues).
- `app/admin/events/page.tsx` — admin-only (`requireAdmin`) page hosting `CreateEventForm` to create a new standalone event.

## Server actions (`app/actions/events.ts`)

All are `"use server"`, validate/cap input then call Supabase RPCs; most `revalidatePath`.

- `createEventAction` — validates + calls `create_event` RPC, redirects to the new event.
- `updateEventAction` — direct `.update()` on the `events` table (not an RPC).
- `registerEventAction` / `submitListAction` — register (with optional list) / update submitted list via `register_event` / `submit_event_list` RPCs.
- `setMyEventArchetypesAction` / `adminSetEventParticipantArchetypesAction` / `setEventArchetypeVisibilityAction` — self vs admin archetype-pick RPC wrappers.
- `unregisterEventAction` / `adminRemoveRegistrationAction` — leave / admin-kick a registrant.
- `setEventStatusAction` — open/closed/complete toggle.
- `addEventStaffAction` / `createEventStaffPlayerAction` / `removeEventStaffAction` — staff management, including creating a "managed" player record for staff not already in the system.
- `deleteEventAction` — hard delete via `delete_event` RPC, redirects home.

## Lib logic

- `lib/events.ts` — data-access layer: `EventRow`/`EventStatus` types, `listEvents`, cached `getEventBySlug`, `isEventAdmin` (site admin or row in `event_admins`), `listRegistrations`, `getMyRegistration` (joins `event_registrations` + `event_lists`), `listEventStaff`, `getEventLists` (admin-only, all submitted lists keyed by player).
- `lib/event-category.ts` — defines the `Category` union (`cup | challenge | demo | prerelease | others`) with label/icon metadata (`CATEGORIES`), plus `categoryMeta`/`isCategory` helpers.
- `lib/agenda.ts` — powers the landing page. `getUpcoming()` fetches both `sessions` (league-linked) and `events` (standalone) from today onward (not `complete`), normalizes both into a unified `UpcomingItem[]` (kind: "session"|"event") sorted by `startsAt`, feeding the home page's today/this-week/upcoming sections.

## Components

- `create-event-form.tsx` / `edit-event-form.tsx` — client forms (`useActionState`) for all event fields (name, subtitle, category, game — create only, game is immutable after creation —, datetime, location, cost, capacity, external URL, description, prizes, list-required toggle).
- `event-register.tsx` — client component driving both registration and list submission; shows registered/waitlisted badge + unregister button, or a register form (list-required note if applicable), or a "closed" message.
- `add-staff-form.tsx` — client form to attach an existing player as event staff with a free-text role.
- `game-badge.tsx` — small presentational badge (tcg/vgc colored pill), shared with leagues.

## Database

- `events` (base): id, name, slug (unique), game (tcg/vgc), starts_at, location, cost, description, external_url, prizes, list_required, capacity, status (open/closed/complete), created_by, created_at.
- `event_admins` — owner/admin per user.
- `event_registrations` — (event_id, player_id) PK, status (registered/waitlisted), has_list.
- `event_lists` — private list content/url, RLS restricted to submitter or admin.
- Later additions: `subtitle` (0018), `category` check constraint extended to add `prerelease` (0023), `event_staff` table + RPCs `add_event_staff`/`create_event_staff_player`/`remove_event_staff` (0024), `archetype1`/`archetype2`/`archetype_public` on `event_registrations` (0036).

Key RPCs: `create_event`, `register_event` (handles waitlist via capacity), `submit_event_list`, `unregister_event`/`admin_remove_registration` (promotes from waitlist), `set_event_status`, `set_event_archetypes` (self-service, locked post-complete unless never set), `admin_set_event_archetypes` (unrestricted), `set_event_archetype_visibility`.

## Landing-page integration

`app/page.tsx` consumes `getUpcoming()` from `lib/agenda.ts`; splits into `todayItems`/`thisWeekItems` sections plus a general filterable list (by `game` and `type`/category query params — events filtered via `u.kind === "event" && u.category === typeFilter`). Renders `GameBadge` and `CategoryBadge` per item, distinguishing events from league sessions in the same unified feed.
