# Work orders and recurring-schedule screens — repairs the property team raises, and a screen for recurring maintenance

**Status:** Built on `feat/work-orders-and-schedules` (stacked on `feat/offline-payments-and-receipts`). **Date:** 2026-10-19. **Issues:** ISS-120 to ISS-124. **Migration:** `20261019221827_work_orders_and_schedules`. **Decisions:** ADR-0014, **Accepted 2026-10-20**: the owner asked for the work to start without answering the open questions, so the defaults below were chosen; the owner accepted them as drafted a day later.

## Why

Only a tenant with an active lease could raise a repair, so a manager or landlord could not log one they found themselves and nothing could be raised on a vacant or unleased unit. Recurring schedules existed as an API only (list and create, no way to edit, pause or remove one), and the daily job **skipped a vacant unit silently**: the unit was never serviced and nobody was told.

## What was built

- **A repair may have no tenant.** `MaintenanceRequest.tenantId` is nullable (the foreign key stays `RESTRICT`) and `createdById` records who raised a work order.
- **Raise a repair.** `POST /maintenance/requests` also takes an admin, or the manager or landlord of the unit's property (`canManageProperty`): any unit they look after, occupied or vacant, with an optional verified vendor (the job is then `SCHEDULED` and the vendor is told). The rest of the team is told; the person who raised it is not. If someone lives in the unit they get an in-app notice that work is planned. UI: **Raise a repair** on the Maintenance board (`RaiseRepairForm.tsx`), which opens the new repair.
- **Nobody to ask.** A work order never waits for a tenant's answer (`completionData` and `tellTenantRepairDone` take the tenant, if any), cannot be rated, and sends no tenant notices (status changes, review actions, invoices, message thread). The repair page, board and vendor page show "Raised by <name>" and "work order, no tenant"; the vendor is told to arrange entry with the manager. The property team pays the vendor as before.
- **Schedules API.** `PATCH /maintenance/schedules/[id]` (change category, cycle, next date, equipment; pause and resume with `isActive`) and `DELETE` (audit-logged `MAINTENANCE_SCHEDULE_DELETED`; a schedule is configuration that nothing points at, so it is really deleted, and pausing is the reversible option). Creation now checks the category exists and that the equipment belongs to the unit or its building (before, equipment from another property was accepted).
- **Recurring Maintenance screen** (`/dashboard/schedules`, `MaintenanceSchedules.tsx`; a **Schedules** tab for managers and landlords, after the existing tabs so the mobile tab bar's first three do not change): what is due when, last raised, status; new, edit, pause or resume, remove (with a confirmation). A note appears when the unit is vacant.
- **Vacant units.** The daily job now raises a tenant-less work order for a vacant unit and tells the team ("no tenant lives there"); an occupied unit is attributed to its tenant as before. The result of `maintenance-schedule-dispatcher` is now `{ dispatched, forVacantUnits }` (it was `skippedNoTenant`).
- **Month-end drift.** `lib/maintenanceSchedule.ts` works out each date from the schedule's intended day (`MaintenanceSchedule.dayOfMonth`, filled from the first due date and back-filled by the migration): 31 January, 28 February, 31 March, 30 April. The old rule (`setMonth`) turned 31 January plus a month into **3 March**, skipping February.
- **Seeds.** `seed2` has a work order on the vacant flat (waiting for a vendor) and three schedules: one running, one on the vacant flat, one paused.

## Decisions worth remembering (ADR-0014, Accepted)

- Any unit of a property the person looks after qualifies, whatever its status; admins, managers and landlords may raise a work order; the property team pays, as for a tenant's repair.
- No tenant confirmation, rating or tenant notices for a work order; the unit's current tenant is only told that work is planned.
- A schedule on an occupied unit still attributes the repair to the tenant (it asks them to confirm and lets them rate), as before; only a vacant unit's becomes a work order.
- Rejected: a placeholder "system" tenant, a separate work-order model, and continuing to skip vacant units.

## Bugs found and fixed on the way

See ISS-121 to ISS-124: the silent skip of vacant units, the month-end date bug, schedules accepting equipment from another property, and no way to change, pause or remove a schedule.

## Verification

- `tsc --noEmit` clean; 14 new API tests (`tests/api/work-orders-and-schedules.test.ts`: who may raise one, the vendor and the unverified vendor, the occupied-unit notice, no tenant answer or rating, signing off, the vendor invoice, the thread, the permissions on schedules, pause and remove, the vacant-unit job, the tenant attribution and the end-of-February date) and 7 unit tests (`tests/unit/maintenanceSchedule.test.ts`).
- The journey recorder has a new act 19 (the manager raises a work order on an empty flat and picks a vendor; the vendor sees it with no tenant; the Recurring Maintenance screen: create a schedule starting on the 31st, pause, resume, edit, remove). It passed in a fast run and a paced run from a freshly seeded database. **The video was not re-recorded** in this change: each recording adds a copy of the video to the history, so re-record once after the open PRs merge.
- `pnpm test`: 556 tests in 47 files pass (473 API, 83 unit). One existing test (`maintenance.test.ts`, "rejects a non-tenant caller") was changed on purpose: it used a manager, who may now raise a work order, so it uses a vendor.
- Playwright against a production build: see `CURRENT_STATE.md`.

## Known limits

- A work order is never rated (only a tenant rates a vendor).
- Work orders are raised from the board and the dashboard only for managers and landlords; admins can use the API but have no screen.
- Schedules are listed 100 at a time with no search.
- Nothing stops a work order being raised twice for the same job; the board shows both.
- Only the next date is changed when a schedule is edited; the history of repairs it raised is on the board, not on the schedule.
