# PL-6 — Click through the open browser QA of PL-1, PL-2 and PL-3

Status: To Do | Type: Task | Assignee: José María | Created: 2026-08-21 | Done: —

## Description

Audit finding 5.2. The three feature tickets shipped to production verified by tests, tsc, build, REST probes and a prod page fetch, but nobody has clicked through the flows: PL-1 has 6 unchecked browser items, PL-2 (still In Review) has 11, PL-3 has 7. PL-5 proves this matters — a form that never worked went a month unnoticed because nothing exercised it in a browser.

## Requirements

- Every unchecked `- [ ]` item under "QA — Dev" in `PL-1-Done.md`, `PL-2-InReview.md` and `PL-3-Done.md` is either ticked (with the date) because it was actually done in a browser, or rewritten to say why it can't be (and stays unchecked).
- Anything that fails becomes its own Bug ticket, linked from the item.
- PL-2 moves to Done (and its file is renamed `PL-2-Done.md`) only when its list is clear. PL-1 / PL-3 stay Done but their lists get closed honestly.

## Development needed

* Set up a throwaway league + session on prod (or a local Supabase if one exists) with enough managed players for the 3/4/5-player pairing cases in PL-1 and the drop/re-pair cases in PL-2.
* Run each scenario; tick as you go; file bugs for failures.
* Update INDEX.md rows and rename files on status change.

## QA — Dev

- [ ] PL-1 list closed.
- [ ] PL-2 list closed; ticket Done and renamed.
- [ ] PL-3 list closed.
- [ ] Any failures tracked as new tickets.

## Changes made

—

## Activity

- 2026-08-21 — Ticket created from the audit (PL-4).

Last updated: 2026-08-21
