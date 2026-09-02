# PL-15 — Dependency update: Next 16.3, Supabase, next-intl, shadcn and the rest of the minor drift

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.7 / health check. `npm outdated` on 2026-08-21:

| Package | Current | Latest |
|---|---|---|
| next / eslint-config-next | 16.2.10 | 16.3.2 |
| @supabase/supabase-js | 2.110.2 | 2.112.3 |
| @supabase/ssr | 0.12.0 | 0.12.4 |
| next-intl | 4.13.2 | 4.13.7 |
| react / react-dom | 19.2.4 | 19.2.8 |
| lucide-react | 1.24.0 | 1.33.0 |
| shadcn | 4.13.0 | 4.19.0 |
| radix-ui | 1.6.2 | 1.6.7 |
| tailwindcss / @tailwindcss/postcss | 4.3.2 | 4.3.3 |
| vitest | 4.1.10 | 4.1.11 |
| eslint | 9.39.4 | 10.9.0 (major) |
| typescript | 5.9.3 | 7.0.2 (major) |
| @types/node | 20.19.43 | 26.2.0 (major) |

Nothing urgent. The majors (eslint 10, TypeScript 7, @types/node 26) are out of scope here — each needs its own look (`eslint-config-next` compatibility, TS 7 behaviour changes, Node version on Vercel).

## Requirements

- Bump everything in the "minor/patch" group; read the Next 16.3 release notes (`node_modules/next/dist/docs/` after the bump, plus the changelog) for anything touching `proxy.ts`, server actions, `revalidatePath`, or `cookies()`.
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` clean after the bump.
- Smoke the app locally: login, a session page with rounds, an event page with imported rounds, the display pages, `/me`.
- `package-lock.json` committed with it.

## Development needed

* `npm update` for the minor group (or explicit `npm i pkg@x`), fix whatever breaks.
* Note any deprecation warnings that appear in the build output here.

## QA — Dev

- [ ] All four checks clean.
- [ ] Local smoke as above.
- [ ] Vercel build green after push.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
