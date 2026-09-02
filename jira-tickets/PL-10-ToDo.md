# PL-10 — `next build` spends ~6 minutes in the TypeScript step

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.5 (second half). On 2026-08-21 `npm run build` logged `Compiled successfully in 30.2s` followed by `Finished TypeScript in 6.0min`. `npx tsc --noEmit` on its own finishes far faster in the same tree, so the extra time is inside Next's type-check pass. Candidates: `tsconfig.json` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` (the dev server's generated types may be large or stale), `tsconfig.tsbuildinfo` is 174 KB and may be stale, `data/pokedex.json` is imported with `resolveJsonModule` (type inference over a large JSON literal is slow), or it is just this machine.

## Requirements

- Know why. Measure `npx tsc --noEmit --extendedDiagnostics` and a build after `rm -rf .next` and after deleting `tsconfig.tsbuildinfo`; compare.
- If the JSON import is the cost, type `data/pokedex.json` through a declared interface (`lib/pokedex.ts` can cast once) or generate a `.d.ts` for it.
- If it's the `.next/dev/types` include, confirm the recommended include list for Next 16 in `node_modules/next/dist/docs/` before changing `tsconfig.json`.
- Target: the TypeScript step in `next build` under ~1 minute on this machine, or a written note that it's environmental.

## Development needed

* Measurements as above, recorded in this ticket.
* Apply the cheapest fix that moves the number.

## QA — Dev

- [ ] Before/after timings recorded.
- [ ] `npm run build` clean after the change.
- [ ] Vercel build time compared before/after (deployments page).

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
