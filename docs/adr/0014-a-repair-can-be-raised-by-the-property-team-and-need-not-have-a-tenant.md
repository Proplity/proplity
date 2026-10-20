# 0014 — A repair can be raised by the property team and need not have a tenant

Status: Proposed
Decided by: (pending: drafted by an agent, to be accepted or changed by the owner) · Date: 2026-10-19
Recorded: 2026-10-19

## Context

Only a tenant with an active lease could raise a repair (`POST /maintenance/requests` was tenant-only and `MaintenanceRequest.tenantId` was required). A manager or landlord could not log a repair they found themselves, nothing could be raised on a vacant or unleased unit, and the daily job for recurring schedules **skipped a vacant unit silently**, so a vacant unit's servicing never happened. `CLAUDE.md` listed the open decisions: an optional tenant, which units qualify, who may create one, who pays, what the tenant is told, and whether schedules get a screen. The owner asked for the work to start (2026-10-19) without answering them, so these are the defaults chosen. Each is easy to change.

## Decision

1. **A repair may have no tenant.** `MaintenanceRequest.tenantId` is nullable; a new `createdById` says who raised a work order (null when a tenant reported it).
2. **Which units:** any unit of a property the person looks after, whatever its status (occupied, vacant, reserved, in maintenance, not yet listed or approved).
3. **Who can raise one:** an admin, or the manager or landlord of that property (`canManageProperty`). Tenants still report their own unit with an active lease; vendors cannot raise repairs.
4. **Who pays:** unchanged. The property team pays the vendor's invoice, exactly as for a tenant's repair; a work order introduces no new payer.
5. **What the tenant is told:** a work order is not their report, so it never asks them to confirm it and they cannot rate the vendor. If someone lives in the unit now, they are told in the app that work is planned there.
6. **Sign-off:** the vendor finishes it (with the finished-work photo where uploads are configured) and the property team approves it. There is no tenant answer to wait for.
7. **Schedules:** the property team gets a screen (add, edit, pause, resume, remove). On a **vacant** unit the daily job raises a tenant-less work order and tells the team, instead of skipping it. On an occupied unit it still attributes the repair to the tenant, as before.
8. **Month-end:** a schedule keeps its intended day of the month (`MaintenanceSchedule.dayOfMonth`) and falls on the last day of a short month, then returns to it.

## Alternatives Considered

- **Attach work orders to a placeholder "system" tenant:** every reader would then treat it as a real tenant, send it notices and ask it to confirm; a nullable column makes the absence explicit.
- **A separate `WorkOrder` model:** the vendor flow, invoices, photos, messages and sign-off all hang off `MaintenanceRequest`; a second model would duplicate or fork them.
- **Keep skipping vacant units:** it is the bug that motivated this; the unit gets no servicing and nobody is told.
- **Ask the current tenant to confirm a work order on their unit:** they did not report it and may not have seen the work; the team's approval is the check.

## Consequences

- Everything that reads a repair's tenant must cope with `null` (about a dozen places were changed). New code must not assume `request.tenant`.
- A work order never gets a vendor rating (only the tenant rates). If vendors should be rated on these jobs, the team would need a way to do so.
- A tenant who is moved out and back in does not see work orders raised while the unit was empty.
- **Revisit if:** the owner wants approval before work starts or a spending limit on work orders, wants tenants of an occupied unit to confirm work done in their unit, or wants a different payer.

## Enforced by

`tests/api/work-orders-and-schedules.test.ts` (who may raise one, no tenant answer or rating, the vendor flow, the thread, the vacant-unit job) and `tests/unit/maintenanceSchedule.test.ts` (month-end dates).

## Binds

- `prisma/schema/operations.prisma` (`MaintenanceRequest.tenantId`, `createdById`, `MaintenanceSchedule.dayOfMonth`)
- `app/api/v1/maintenance/requests/route.ts`, `lib/maintenanceFlow.ts`
- `lib/workers/maintenanceScheduleDispatcher.ts`, `lib/maintenanceSchedule.ts`
- `tests/api/work-orders-and-schedules.test.ts`
