@AGENTS.md

Identity, voice, formatos, and general principles live in `JMRM/CLAUDE.md` (one level up) — read
that first. This file is project-scoped only.

# Workflow

The user will send very short prompts describing what they want added to the website. Before writing any code or making a plan, always use the AskUserQuestion tool to ask clarifying questions first to refine the request — don't start implementing from a short prompt alone.

After implementing a feature, update the relevant `.md` file(s) under `docs/features/` to reflect the change (routes, server actions, lib logic, components, database, or notable fixes) — keep these docs current, not just the code.

# Local ticket tracking

There is no Jira for this project. Every task we tackle gets a local ticket file under `jira-tickets/` that follows the `jira-ticket-workflow` skill's local-mirror shape, minus any Atlassian calls — the `.md` file is the ticket.

- Keys are sequential `PL-<n>`; `jira-tickets/INDEX.md` lists every ticket (newest first) and says which key is next. Add a row there when creating a ticket and update its Status/Done columns as it moves.
- Create the ticket at the start of a task (after the clarifying questions, before writing code). File shape: `# PL-n — <title>`, a `Status: … | Type: … | Assignee: … | Created: … | Done: …` line, then `## Description`, `## WHY`, `## Requirements`, `## Development needed`, `## QA — Dev`, `## Changes made`, `## Activity`, `Last updated:` at the bottom. Skip `## WHY` when the description already carries the reasoning.
- Content is in English (the skill's Spanish rule is for Horizon client tickets; this is a personal project and the chat is in English). Technical identifiers as-is.
- Statuses: To Do → In Progress → In Review → Done. Mark progress as it happens, the same way the skill does for its local mirror: `✅` prefix on finished Development needed bullets, `- [x] ✅` on verified QA — Dev items, dated `## Changes made` blocks (newest first) listing files created/modified, and one line per event under `## Activity` (created, status changes, time logged, commits). Only mark something done when it was actually done or verified.
- "Log 2h on PL-3" adds a worklog line under `## Activity` — no Jira call.
- Done = committed and QA — Dev verified. Set `Done:` to the date, flip Status, update INDEX.md.
- QA — Dev stays honest: anything not actually verified (browser checks, deploys) stays unchecked and gets called out in chat.
