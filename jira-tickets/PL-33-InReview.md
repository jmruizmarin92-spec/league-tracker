# PL-33 — "No tocar" header tab: rudimentary Snake minigame at /no-tocar

Status: In Review | Type: Feature | Assignee: José María Ruiz Marín | Created: 2026-10-30 | Done: —

## Description

A new "No tocar" link in the top header, right after "Estadísticas", visible to every visitor. It goes to `/no-tocar`, a page with a bare-bones Snake: grid on a canvas, one snake, one piece of food, score, game over, restart. Phones get an on-screen D-pad under the board; desktop uses the arrow keys or WASD. Nothing is persisted, nothing touches the database.

## Requirements

- Header: "No tocar" link after the Estadísticas slot, rendered for everyone (logged in or not).
- Route `/no-tocar`, public, same page chrome as the rest (breadcrumbs, title).
- Game: fixed grid, snake grows when it eats, dies on wall or self collision, score = food eaten.
- Controls: arrow keys and WASD on desktop; four on-screen buttons on touch devices. Reversing into yourself is ignored.
- Tap on a direction or press a key from the idle/game-over state starts a new game; a restart button too.
- Works in light and dark theme, no horizontal scroll on a phone.

## Development needed

- ✅ `messages/es.json`: `nav.noTocar` label plus a `snake` namespace for the page strings.
- ✅ `components/site-header.tsx`: add the link after the Estadísticas block.
- ✅ `app/no-tocar/page.tsx`: server page with breadcrumbs and the game component.
- ✅ `components/snake-game.tsx`: client component with the canvas, loop, keyboard handling and D-pad.
- ✅ `docs/features/platform.md`: document the route and component.

## QA — Dev

- [x] ✅ `npm run lint` — only the 2 pre-existing `react-hooks/set-state-in-effect` errors (`round-timer.tsx`, `theme-toggle.tsx`), nothing from PL-33. `tsc --noEmit` clean.
- [x] ✅ `npm test` green: 18 files, 198 tests.
- [x] ✅ `npm run build` green, `/no-tocar` listed as a dynamic route.
- [x] ✅ Browser desktop (localhost, Chrome): ArrowRight starts, ArrowDown turns, bottom wall ends the game with the overlay and the Otra vez button. D-pad Up restarts, D-pad Left turns, one food eaten (score 1, 4 segments), left wall ends it. Self collision not exercised by hand (pure `step()` logic, tail-cell rule).
- [ ] Browser phone: D-pad verified with mouse clicks only; a real touch device and a 390 px viewport were not checked (Chrome window would not resize below ~500 px). Board is `w-full max-w-[384px]`, so it should fit.
- [x] ✅ Header link shows logged out (`Ligas · Eventos · Arquetipos · No tocar`). Logged-in state not checked, same unconditional render.

## Changes made

### 2026-10-30

- Modified `messages/es.json` — `nav.noTocar` and new `snake` namespace (title, hint, score, start, gameOver, restart, four directions).
- Modified `components/site-header.tsx` — `/no-tocar` link after the Estadísticas block, unconditional.
- Created `app/no-tocar/page.tsx` — public server page, breadcrumbs + `SnakeGame` with labels as props.
- Created `components/snake-game.tsx` — client component: 16×16 canvas, ref-held state, 140 ms interval loop, arrows/WASD, 3×3 D-pad on `onPointerDown`, idle/running/over overlay, restart.
- Modified `docs/features/platform.md` — new section for the route and component.

## Activity

- 2026-10-30 — Created, status To Do → In Progress.
- 2026-10-30 — Implemented, lint/tsc/test/build green, desktop browser QA done on localhost.
- 2026-10-30 — Status In Progress → In Review, committed.

Last updated: 2026-10-30
