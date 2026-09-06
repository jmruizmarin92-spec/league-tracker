# PL-26 — TOM import: own tab, one step, lands on the pairings

Status: In Review | Type: Improvement | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

Original ask (2026-09-06): move the `.tdf` import out of Gestión into its own tab, redirect to the pairings automatically after importing, and skip the "confirm import" step whenever the file reads correctly.

Clarified: the review step goes away entirely — one step, pick the file and import, players resolve on the server the same way the preview used to suggest them (existing mapping → Pokémon ID → unambiguous name → new managed player). The new admin-only tab holds the whole TOM card (file drop, "última importación" line, the "borrar lo importado" undo); Gestión keeps staff, edit, status and delete. Every successful import ends on the Emparejamientos tab of the same event page.

## WHY

On the day the TO re-drops the file after every round. Three clicks and a review list to scroll past each time, buried under the staff panel in Gestión, is friction for a step the machine gets right on its own in practice; the one thing the review could fix (a wrong name match) can still be undone with "borrar lo importado" and a re-import once the player carries the right Pokémon ID.

## Requirements

- New tab "Importar TOM" between Inscritos and Gestión, admin only, with the file picker + Importar button, the last-import line and the clear/undo block. Nothing TOM-related left in Gestión.
- `importTdfAction` takes the file directly: reads (2 MB cap), parses, resolves players with `matchTdfPlayers`, calls `import_event_tdf`, revalidates and redirects to `/events/<slug>?tab=pairings`. Parse/RPC errors render under the form. `previewTdfAction` and the review UI are removed.
- `PageTabs` takes the active tab from `?tab=<value>` when it names an existing tab (falls back to the page's `initial`, then the first tab); clicking a tab writes the URL with `history.replaceState` so a later redirect to `?tab=pairings` is always a change, even when the previous import already left the URL on the pairings tab.
- Unused `eventTom.import*` message keys removed; `event.tabImport` added; the hint says players link themselves, unknown ones are created and the import ends on the pairings.
- Docs updated (`docs/features/events.md`, `PageTabs` entry in `docs/features/sessions-rounds.md`).

## Development needed

* ✅ `components/page-tabs.tsx`: URL-driven active tab (`useSearchParams` + `replaceState`; all three host pages render dynamically, so no Suspense boundary needed).
* ✅ `app/actions/event-tdf.ts`: one-step `importTdfAction` with `redirect`; `previewTdfAction` and the `TdfPreview*` types dropped.
* ✅ `components/tdf-import.tsx`: single form, error only (success redirects).
* ✅ `app/events/[slug]/page.tsx`: new `import` tab; TOM card out of `manage`.
* ✅ `messages/es.json`: `event.tabImport`; 16 unused `eventTom.import*` keys removed; `importHint` reworded.
* ✅ `docs/features/events.md` + `docs/features/sessions-rounds.md`.

## QA — Dev

- [x] ✅ `vitest run`: 15 files, 157 tests green (2026-09-06).
- [x] ✅ `npx tsc --noEmit` clean; `eslint` clean on the four touched code files (2026-09-06).
- [ ] Browser: admin on an event → "Importar TOM" tab shows picker + last import + clear; Gestión no longer has the TOM card.
- [ ] Browser: import a `.tdf` → lands on Emparejamientos with the rounds; re-import the next round from the import tab → lands on Emparejamientos again with the new round selected.
- [ ] Browser: import a non-TDF file → error under the form, no redirect.
- [ ] Browser: `?tab=participants` opens Inscritos directly; clicking tabs updates the URL; landing page "Esta semana" tabs and session page tabs still switch.
- [ ] Browser: a `.tdf` whose players only match by name (no Pokémon ID in the system) still lands them on the right players — the review step used to be the safety net here.

## Changes made

### 2026-09-06
**actions / components**
- `app/actions/event-tdf.ts` (`previewTdfAction`, `TdfPreview*` types removed; `importTdfAction` reads, parses, matches, commits and redirects), `components/tdf-import.tsx` (single form), `components/page-tabs.tsx` (active tab from `?tab=`).

**app / messages**
- `app/events/[slug]/page.tsx` (new `import` tab; TOM card out of `manage`), `messages/es.json` (`event.tabImport`; 16 unused `eventTom.import*` keys removed; `importHint` reworded).

**docs / tickets**
- `docs/features/events.md`, `docs/features/sessions-rounds.md`, `jira-tickets/INDEX.md`.

## Activity

- 2026-09-06 — created after the clarifying round (skip review always when the file parses; whole TOM card moves; every import lands on pairings). In Progress.
- 2026-09-06 — implemented; tests, typecheck and lint green. In Review. Not committed; browser QA pending (needs an admin session and a `.tdf`).
- 2026-09-06 — ticket file recreated: a parallel session (PL-27, tap feedback) wrote its ticket to the same `PL-26-InProgress.md` path at the same moment and then renamed it to PL-27, which took this ticket's text with it. INDEX row kept by that session.

Last updated: 2026-09-06
