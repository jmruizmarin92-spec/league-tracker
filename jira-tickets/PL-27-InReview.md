# PL-27 — Tap feedback on the phone: pending spinner on action buttons and a top progress bar on navigation

Status: In Review | Type: Improvement | Assignee: José María | Created: 2026-09-06 | Done: —

## Description

On the phone the app gives no reaction to a tap. Reporting a result, registering, saving a form or opening a league/session row shows nothing until the server answers, so when the request takes a second you don't know whether the tap registered and end up tapping again.

Two separate causes:

- Server-action buttons: most `<form action>` submits have no pending state at all (`my-match-card`, `event-pairings`, `rounds-tabs`, status toggles, register/claim buttons, `confirm-delete-button`...). The ones wired through `useActionState` only pass `disabled={pending}`, which the `Button` renders at 50% opacity: on a phone that reads as "nothing happened".
- Navigation: every page is dynamic (auth cookies), there is no `loading.tsx` anywhere and links only react on hover, so a tap on a row/link shows nothing until the new page arrives.

Decided with the clarifying round (2026-09-06): both get feedback; action buttons show a spinner next to the label and lock (no fade, no double tap); navigation gets a global thin progress bar at the top of the screen.

## Requirements

- Every submit `Button` inside a `<form>` shows a spinner next to its label while that form's action is running, keeps full opacity and cannot be tapped again. No per-form wiring: it has to work for the plain `<form action>` buttons that never pass `pending`.
- Buttons that were already `disabled={pending}` keep working (the two pending sources merge); a button disabled for another reason (validation) still looks disabled as before.
- `asChild` buttons (links styled as buttons) and non-submit buttons are untouched.
- A thin bar at the top starts when a tap turns into a client-side navigation to a different URL and finishes when the new URL commits. It must not flash on instant navigations, must not start on external / new-tab / same-URL / hash links, and must not hang if the navigation never lands (safety timeout).
- No visual change on desktop hover states; the tap press itself gets a slightly stronger squish so the click is acknowledged even before the spinner shows.

## Development needed

* ✅ `components/ui/button.tsx`: client component; reads `useFormStatus()` and, for submit buttons, renders a `LoaderCircle` spinner + `aria-busy` + `disabled` with the opacity fade overridden while pending. Stronger `active:` press.
* ✅ `components/navigation-progress.tsx`: global bar. Document-level click listener starts it for anchors whose click Next's `<Link>` took over (`defaultPrevented`), same origin, different pathname+search. `usePathname` + `useSearchParams` change ends it. 15 s safety timeout. Opacity delayed 120 ms so instant transitions never show it.
* ✅ `app/globals.css`: `.nav-progress` styles (fixed, 3 px, primary color, scaleX transitions).
* ✅ `app/layout.tsx`: mount `NavigationProgress` inside a `Suspense` (required for `useSearchParams` under a prerendered tree).
* ✅ `docs/features/platform.md`: new "Tap feedback" section.

## QA — Dev

- [x] ✅ `tsc --noEmit` clean, `vitest run` 157/157. `npm run lint`: only the two pre-existing `set-state-in-effect` errors (`round-timer.tsx`, `theme-toggle.tsx`), nothing in the PL-27 files.
- [x] ✅ `next build` passes. First `next start` smoke caught a real bug: the idle Button rendered `[false, child]`, which breaks Radix `Slot` for every `asChild` link button (500 on `/`). Fixed (single child when idle); after rebuild `/`, `/leagues`, `/arquetipos`, `/login` are 200, the `nav-progress` div is in the SSR HTML at `scaleX(0)`, and the sign-in `asChild` anchor and the login submit button render with the new classes.
- [ ] Browser, phone or narrow viewport with network throttled (Slow 3G): report a match result → spinner next to the label, button locked, no fade; page refreshes with the new result.
- [ ] Browser: a `useActionState` form (create session / edit event) → same spinner, button re-enables after the action returns with an error.
- [ ] Browser: `ConfirmDeleteButton` → cancel in the confirm dialog shows no spinner; accept shows it until the redirect.
- [ ] Browser: tap a landing row / league link with throttling → bar grows at the top, completes on arrival. Ctrl/Cmd+click, the same page's link, `?game=` filter chips (search-only change), back button: bar only for the filter chips, and it completes.
- [ ] Browser: a link that is prefetched/instant shows no bar flash.
- [x] ✅ Deployed to prod (2026-09-06): pushed `d317394`; the parallel PL-26 session pushed `48f60fc` and `7ea3be2` on top seconds later, so Vercel built those (both `success`, both contain PL-27). Prod smoke via curl: `/`, `/leagues`, `/arquetipos`, `/login` 200, `nav-progress` div present in the SSR HTML, new button classes present.
- [ ] Phone check on prod (spinner on a result report, bar on a row tap) still to do by hand.

## Changes made

### 2026-09-06
**components**
- `components/ui/button.tsx` (client, `useFormStatus` spinner + lock, `active:scale-[0.97]`).
- `components/navigation-progress.tsx` (new).

**app**
- `app/globals.css` (`.nav-progress`), `app/layout.tsx` (mount).

**docs / tickets**
- `docs/features/platform.md` (Tap feedback section), `jira-tickets/INDEX.md`.

## Activity

- 2026-09-06 — created after the clarifying round (scope: buttons + navigation; spinner + label, locked; global top bar). In Progress. Created as PL-26 and renumbered to PL-27 minutes later: a parallel session claimed PL-26 (TOM import) in INDEX.md at the same time.
- 2026-09-06 — implemented; tsc/vitest/build/SSR smoke green (see QA). In Progress → In Review. Open: browser QA on the phone (spinner, bar, edge cases) and prod deploy.
- 2026-09-06 — pushed and deployed to prod (see QA). Open: hands-on phone QA.

Last updated: 2026-09-06
