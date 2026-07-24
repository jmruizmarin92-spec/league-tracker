@AGENTS.md

Identity, voice, formatos, and general principles live in `JMRM/CLAUDE.md` (one level up) — read
that first. This file is project-scoped only.

# Workflow

The user will send very short prompts describing what they want added to the website. Before writing any code or making a plan, always use the AskUserQuestion tool to ask clarifying questions first to refine the request — don't start implementing from a short prompt alone.

After implementing a feature, update the relevant `.md` file(s) under `docs/features/` to reflect the change (routes, server actions, lib logic, components, database, or notable fixes) — keep these docs current, not just the code.
