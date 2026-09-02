# PL-14 — Move the game-domain host map in `proxy.ts` to an environment variable

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.7. `proxy.ts` hardcodes `GAME_BY_HOST = { "pkmgranadatcg.vercel.app": "tcg", "pkmgranadavgc.vercel.app": "vgc" }`. Adding a custom domain (or renaming the Vercel aliases) means a code change and a deploy for a config value.

## Requirements

- `GAME_BY_HOST` built from an env var, e.g. `GAME_HOSTS="pkmgranadatcg.vercel.app=tcg,pkmgranadavgc.vercel.app=vgc"`, parsed once at module load; malformed entries ignored with a `console.warn`. Falls back to the current two hosts when the var is unset so nothing changes until it's configured.
- `.env.example` documents it; Vercel project env gets it.
- `docs/features/platform.md` "Game-specific domain routing" updated.

## Development needed

* `proxy.ts`: parse `process.env.GAME_HOSTS`; keep the current map as default.
* `.env.example`, Vercel env, docs.

## QA — Dev

- [ ] Local: `GAME_HOSTS` unset → both hosts still rewrite (simulate with a `Host` header via curl against `npm run dev`).
- [ ] Local: `GAME_HOSTS` set to a different host → that host rewrites, the old ones don't.
- [ ] Prod: both aliases still land pre-filtered after deploy.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
