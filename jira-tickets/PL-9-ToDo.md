# PL-9 — Make `npm run lint` pass: set-state-in-effect errors and unused imports

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.5. `npx eslint .` exits non-zero with 2 errors and 2 warnings, all pre-existing:

- `components/round-timer.tsx:107` — `setNow(Date.now())` called synchronously inside `useEffect` (`react-hooks/set-state-in-effect`).
- `components/theme-toggle.tsx:14` — `React.useEffect(() => setMounted(true), [])` (same rule).
- `app/admin/events/page.tsx:4` — `CardHeader`, `CardTitle` imported and unused.

PL-2 already fixed the same rule in `rounds-tabs.tsx` by adjusting state during render, and `round-timer.tsx` itself uses `useSyncExternalStore` for the notification opt-in, so the patterns to copy are in the repo.

## Requirements

- `npm run lint` exits 0 with no errors and no warnings.
- No behaviour change: the timer still ticks every second from `endsAt` and re-syncs when `running`/`endsAt` change; the theme toggle still avoids the hydration mismatch (render a neutral icon until mounted).

## Development needed

* `round-timer.tsx`: drop the synchronous `setNow` — initialise `now` lazily and let the interval drive it, or derive the first tick from the `running`/`endsAt` change during render, or move the clock to `useSyncExternalStore` with a 1s subscription.
* `theme-toggle.tsx`: replace the mounted flag with `useSyncExternalStore(subscribe-noop, () => true, () => false)` (the standard "is client" hook), or render `resolvedTheme`-independent markup with `suppressHydrationWarning`.
* `app/admin/events/page.tsx`: remove the two imports.

## QA — Dev

- [ ] `npx eslint .` clean.
- [ ] Browser: round timer counts down, pause/resume/reset still work, tab switch doesn't freeze it.
- [ ] Browser: theme toggle shows the right icon after load in both themes, no hydration warning in the console.
- [ ] `npx tsc --noEmit`, `npm run build` clean.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
