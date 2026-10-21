# Current Tasks — Proplity

> **Note (2026-10-21):** rows 7 to 14 were added after the fact from the git history, with dates to the day (no start/end times); no per-task files were written for them. Open work is in `HANDOVER.md` and the issue register.
>
> **Rule:** How to tick: change `[ ]` to `[x]`. The table shows the characters, not a clickable box.
> All dates and times are recorded in UTC with standard ISO format (`YYYY-MM-DD HH:MM:SS UTC`).
> **Grouping Policy:** Tasks represent cohesive phase-level milestones (design → schema → logic → UI → test → docs → PR) to prevent file proliferation.

---

## Active & Sequential Milestone Register

| #   | Task ID                                                                                  | Milestone Title                                                                                                                         | Status                                  | Started                 | Ended                   | PR / Branch                       |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------- | ----------------------- | --------------------------------- |
| 1   | [TASK-0001](0001-registration-flow-refactor-and-e2e.md)                                  | Registration Flow Refactoring, Native Links, Email URLs & E2E Tests                                                                     | [x] Completed                           | 2026-10-10 20:30:00 UTC | 2026-10-12 18:00:00 UTC | Merged to `dev`                   |
| 2   | [TASK-0002](0002-private-document-uploads.md)                                            | Private Document Uploads (ISS-031 / ISS-032)                                                                                            | [x] Completed                           | 2026-10-11 12:00:00 UTC | 2026-10-12 21:00:00 UTC | Merged to `dev`                   |
| 3   | [TASK-0003](0003-owner-namespaced-uploads-and-storage-driver.md)                         | Owner-namespaced Uploads and Storage Driver (ISS-034)                                                                                   | [x] Completed                           | 2026-10-11 14:00:00 UTC | 2026-10-13 10:00:00 UTC | Merged to `dev`                   |
| 4   | TASK-0004 (no file was written)                                                          | Photo Manager, Duplicate Detection & Merging, Neighbourhood Editor                                                                      | [x] Completed                           | 2026-10-14 10:00:00 UTC | 2026-10-15 22:00:00 UTC | Merged to `dev`                   |
| 5   | TASK-0005 (no file was written)                                                          | Dashboard Aggregates, Admin Suspension & Audit Logging                                                                                  | [x] Completed                           | 2026-10-15 12:00:00 UTC | 2026-10-16 02:00:00 UTC | Merged to `dev`                   |
| 6   | [TASK-0006](0006-load-testing-and-mutation-testing.md)                                   | Rigorous Testing Suite, Mutation Testing, Security Hardening & 100k Benchmarks (ISS-030)                                                | [x] Completed                           | 2026-10-16 08:00:00 UTC | 2026-10-16 09:50:00 UTC | `dev`                             |
| 7   | (no file; see the phase notes and `CURRENT_STATE.md`)                                    | UI-only journey recorder, flow fixes ISS-084 to ISS-099, access-code screens, viewing date field, notifications and the attention list  | [x] Completed                           | 2026-10-19              | 2026-10-19              | PRs #105 #107 #110 #111, released |
| 8   | [repair follow-through](../development-history/phases/repair-follow-through.md)          | Vendor photos, tenant confirmation, team sign-off (ISS-100 to ISS-110)                                                                  | [x] Completed                           | 2026-10-19              | 2026-10-19              | PR #114, released                 |
| 9   | [offline payments](../development-history/phases/offline-payments-and-receipts.md)       | Paid another way, Bank Transfers list, receipts (ISS-103, ISS-111 to ISS-116)                                                           | [x] Completed                           | 2026-10-19              | 2026-10-19              | PR #115, released                 |
| 10  | [work orders](../development-history/phases/work-orders-and-recurring-schedules.md)      | Work orders and recurring schedules (ISS-120 to ISS-124, ADR-0014)                                                                      | [x] Completed                           | 2026-10-19              | 2026-10-20              | PR #118, released                 |
| 11  | [second person](../development-history/phases/rent-entry-two-person-and-receipt-note.md) | Rent entry needs a second person (ISS-117, ISS-118)                                                                                     | [x] Completed                           | 2026-10-20              | 2026-10-20              | PR #119, released                 |
| 12  | [responsive polish](../development-history/phases/responsive-polish.md)                  | Phone and tablet layout audit (ISS-125 to ISS-130)                                                                                      | [x] Completed                           | 2026-10-20              | 2026-10-20              | PR #120, released                 |
| 13  | (no file; see `CURRENT_STATE.md`)                                                        | Contact form, viewing double-booking, card-payment availability, admin switches (ISS-133, ISS-104, ISS-010, ISS-011, ISS-039, ADR-0015) | [x] Completed                           | 2026-10-20              | 2026-10-20              | PRs #124 to #129, released        |
| 14  | (no file; see `CURRENT_STATE.md`)                                                        | Session-restore flake and the refresh grace window (ISS-131, ISS-134, ADR-0016)                                                         | [x] Completed (ADR-0016 still Proposed) | 2026-10-20              | 2026-10-21              | PRs #135 #138 #139, released      |

---

## Detailed Milestone Checklist

The checklist for each task lives only in its numbered file (linked in the table above) so the two cannot drift. TASK-0001: modules A–F are in [0001-registration-flow-refactor-and-e2e.md](0001-registration-flow-refactor-and-e2e.md).

**Running now:** nothing. (Mark any background process here and in the task file as `(running)`.)

**Issue register:** [../issues/issues.md](../issues/issues.md) — add new findings in the same pass you find them; never delete rows.
