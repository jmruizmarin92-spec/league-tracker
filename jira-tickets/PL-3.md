# PL-3 — Saved decks: remember a player's archetype combos and prefill the picker

Status: In Review | Type: Story | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Original ask: players shouldn't have to redo their archetypes every session/event. They usually play a handful of decks, each a combination of the two archetype slots (e.g. Dragapult + Dudunsparce, Raging Bolt + Teal Mask Ogerpon), so a single "preferred archetype" isn't enough — they want several saved combos to pick from, plus the picker prefilled with what they played last.

Clarified in chat (2026-08-21):
- Decks are managed both inside the picker (one-tap chips to apply) and in a dedicated section on `/me` (add / delete).
- A deck has no custom name; it is shown as its two archetype chips.
- A picker with no picks yet is prefilled with the player's most recently used combo of the same game; the player still presses Save to confirm.
- Every distinct combo a player submits is saved automatically (deduped); no explicit "save as deck" step.

## Requirements

- New table `player_decks` (per account, per game): `archetype1` (required), `archetype2` (optional), `last_used_at`. One row per unordered pair per user+game (a `pair_key` generated column enforces it); saving an existing pair only bumps `last_used_at`.
- Auto-save: `set_participant_archetypes` and `set_event_archetypes` (self RPCs only, not the admin ones) upsert the submitted pair into `player_decks` whenever at least one slot is set. Clearing both slots saves nothing.
- `/me`: "Mazos guardados" card with a TCG block and a VGC block; each lists the saved decks (chips, most recent first) with a delete button and has an add form (two archetype comboboxes + "Añadir").
- Picker (self mode only, sessions and events): a "Mis mazos" chip row above the slots when the player has saved decks for that game; tapping a chip fills both slots (Save still required). Admin mode of the picker is unchanged.
- Prefill: when the player's row has no picks yet (and isn't locked), the picker starts with the deck with the latest `last_used_at` for that game and shows a short note saying it was prefilled and needs saving. The DB row stays null until they save.
- Deleting a deck never touches session/event history; decks are only a convenience list.

## Development needed

* ✅ `supabase/migrations/0043_player_decks.sql`: table + RLS (owner select) + grants; `save_player_deck(p_game, p_a1, p_a2)` (normalises empty/swap, upserts, bumps `last_used_at`, returns id); `delete_player_deck(p_id)`; redefine `set_participant_archetypes` (0034) and `set_event_archetypes` (0036) to call `save_player_deck` after a successful update.
* ✅ `lib/decks.ts`: `Deck` type, `listMyDecks(game?)` (with resolved chips), `latestDeck(decks, game)`.
* ✅ `app/actions/decks.ts`: `saveDeckAction` (useActionState shape), `deleteDeckAction`.
* ✅ `components/archetype-picker.tsx`: export `ArchetypeCombobox`, new `DeckChips` + `PickerDeck`; new optional `decks` + `prefilled` props, chip row, prefilled note, new labels.
* ✅ `components/saved-decks-manager.tsx` (new): per-game list + add form for `/me`.
* ✅ `app/me/page.tsx`: wire the card; `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx` and `app/events/[slug]/page.tsx`: load decks, pass chips + prefill to the self picker.
* ✅ `messages/es.json`: `session`/`event` keys `archDecks`, `archPrefilled`; `me` keys for the decks card.
* ✅ `docs/features/archetypes.md` and `docs/features/players.md`.
* ✅ Migration applied in Supabase (José María, 2026-08-21, right after the file was written).
* Commit — pending: the working tree also holds PL-2's uncommitted changes in `messages/es.json`, the session page and `jira-tickets/INDEX.md`, so a PL-3-only commit can't be staged cleanly until PL-2 is committed first.

## QA — Dev

- [x] ✅ `npx tsc --noEmit` clean (2026-08-21).
- [x] ✅ `eslint` clean on every file touched by this ticket (2026-08-21).
- [x] ✅ Migration applied on Supabase (2026-08-21).
- [ ] SQL verified: `save_player_deck` dedupes the reversed pair (`select save_player_deck('tcg','pkm:887','pkm:982')` twice with the keys swapped → one row, `last_used_at` bumped); `set_participant_archetypes` inserts into `player_decks`; `admin_set_participant_archetypes` does not.
- [ ] Browser: save archetypes in a session → deck appears on `/me` and as a chip in another session of the same game; not in a session of the other game.
- [ ] Browser: new session, no picks → slots prefilled with the last-used deck + note; roster still shows "Sin arquetipos" until Save.
- [ ] Browser: tap a deck chip → both slots change; Save persists them.
- [ ] Browser: `/me` add a deck (TCG and VGC), delete one; deleted deck no longer offered in the picker; session history untouched.
- [ ] Browser: events page behaves the same as sessions.
- [ ] Regression: admin roster picker unchanged (no chips, no prefill); lock after completion unchanged.

## Changes made

### 2026-08-21
**supabase**
- `supabase/migrations/0043_player_decks.sql` (new) — `player_decks` table + RLS, `save_player_deck`, `delete_player_deck`, redefined `set_participant_archetypes` / `set_event_archetypes` with auto-save.

**lib / actions**
- `lib/decks.ts` (new) — `Deck`, `listMyDecks`, `latestDeck`.
- `app/actions/decks.ts` (new) — `saveDeckAction`, `deleteDeckAction`.

**components / pages**
- `components/archetype-picker.tsx` (modified) — `ArchetypeCombobox` exported, `DeckChips`, `PickerDeck`, `decks`/`prefilled` props and labels.
- `components/saved-decks-manager.tsx` (new).
- `app/me/page.tsx` (modified) — "Mazos guardados" card.
- `app/leagues/[slug]/sessions/[sessionSlug]/page.tsx` (modified) — load `listMyDecks(game)`, `prefillDeck`, picker props.
- `app/events/[slug]/page.tsx` (modified) — same for events.

**i18n / docs**
- `messages/es.json` (modified) — `session.archDecks/archPrefilled`, `event.archDecks/archPrefilled`, `me.decks*`/`deck*`.
- `docs/features/archetypes.md` (modified) — "Saved decks (PL-3)" section; `docs/features/players.md` (modified) — `/me` route line.

## Activity

- 2026-08-21 — Ticket created after clarifying questions (picker + /me, auto-named, prefill last-used, auto-save every distinct combo). Status set to In Progress.
- 2026-08-21 — Migration 0043 applied in Supabase by José María.
- 2026-08-21 — Implementation done locally; tsc + eslint clean. Status set to In Review. Pending: SQL/browser QA, commit (after PL-2 is committed — shared files).

Last updated: 2026-08-21