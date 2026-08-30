# Phase: Domain API Phase 2 — Maintenance & Operations API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Second domain API, building the maintenance lifecycle: category reference data, tenant-submitted requests, staff triage, vendor job execution through completion, auto-invoicing on completion, and post-job ratings — the workflow behind PRD §5.1 (AI-triaged issues) and §5.4 (vendor reputation).

## What was built

Five routes, exactly as scoped in `docs/development-history/domain-api-implementation-plan.md`'s Phase 2 section:

- **`app/api/v1/maintenance/categories/route.ts`** — `GET` (public, `isActive = true` only — same public-reference-data pattern as `/properties`, since both tenants submitting requests and admins managing the list need to read it); `POST`/`PATCH` (`ADMIN` only, `PATCH` takes `{ id, isActive }` in the body — no `[id]` subroute since the plan specified a single file).
- **`app/api/v1/maintenance/requests/route.ts`** — `GET` role-scoped (`TENANT` → own, `VENDOR` → assigned, `MANAGER`/`LANDLORD` → requests on units of properties they manage/own, `ADMIN` → all); `POST` (`TENANT` only), validates an `ACTIVE` lease on the target unit exists for that tenant before allowing submission, `categoryId` left nullable for AI triage per the schema's own comment.
- **`app/api/v1/maintenance/requests/[id]/route.ts`** — `GET` (owner tenant, assigned vendor, or `canManageProperty()` on the unit's property); `PATCH` branches into three sub-operations by which fields are present and who's calling: triage (`categoryId`/`priority`/`vendorId`/`scheduledFor`, requires `canManageProperty()`), cancel (`status: CANCELLED`, requires `canManageProperty()` or the owning tenant), and progress/completion (`status: IN_PROGRESS`/`COMPLETED`, requires the assigned vendor). Completion requires `completionProofUrl` + `finalCost` and, in the same `$transaction`, auto-creates a `MAINTENANCE` `Invoice` with `maintenanceRequestId` set (satisfies the schema's "at least one of" rule) and `dueDate` set to the completion timestamp (immediately due — not specified in the plan, a judgment call).
- **`app/api/v1/maintenance/requests/[id]/rating/route.ts`** — `POST` (`TENANT` who owns the request), requires `status === 'COMPLETED'`, relies on `VendorRating.maintenanceRequestId @unique` for double-rating rejection (`P2002` → clean `409` via `handleApiError`, no separate pre-check).
- **`app/api/v1/maintenance/schedules/route.ts`** — `GET`/`POST` gated to `ADMIN`/`MANAGER`/`LANDLORD` (schedules are staff-created per the schema comment, no tenant/vendor use case); `GET` scoped to the caller's own properties unless `ADMIN`; `POST` requires `categoryId` (unlike requests, schedules are never AI-triaged).

## One real judgment call: LANDLORD included in "manager" visibility

The plan's spec text says "`MANAGER`/`ADMIN` → all requests on managed properties," not mentioning `LANDLORD`. Extended `LANDLORD` into the same bucket — `canManageProperty()` (from Phase 1) already treats `LANDLORD` identically to `MANAGER` for property access, and a landlord with zero visibility into maintenance issues on their own property would be a gap, not a deliberate restriction. Applied consistently across the requests list scope and the schedules gate.

## Verification performed

Full live end-to-end pass against the real dev server and seeded database (not just `tsc`/`build`), using all 5 demo accounts:

- `GET /api/v1/maintenance/categories` unauthenticated → `200`
- `POST /api/v1/maintenance/requests` as `tenant@proplity.com` with an active lease on the unit → `201`, `categoryId: null` (AI-triage pending)
- `GET /api/v1/maintenance/requests/[id]` as owner tenant → `200`; as an unrelated vendor → `403`; unauthenticated → `401`
- `PATCH .../[id]` triage as the owning tenant → `403`; as the property's actual `manager@proplity.com` → `200`; as `admin@proplity.com` (unrelated but `ADMIN`) → `200`
- `PATCH .../[id]` `status: IN_PROGRESS` as an unassigned landlord → `403`; as the assigned vendor → `200`
- `PATCH .../[id]` `status: COMPLETED` without `completionProofUrl`/`finalCost` → `400`; with both → `200`, and the `MAINTENANCE` invoice was confirmed created (`INV-EF91CD46`, `maintenanceRequestId` set, `amount` matching `finalCost`, DB-generated `invoiceNumber`)
- `POST .../rating` as the owning tenant → `201`; immediate second `POST` → `409` (`P2002`, unique-constraint path)
- `PATCH .../[id]` `status: CANCELLED` as an unrelated vendor → `403`; as the owning tenant on a fresh request → `200`
- `POST /api/v1/maintenance/categories` as `manager@proplity.com` → `403`; as `admin@proplity.com` → `201`; `PATCH isActive: false` → `200`, confirmed excluded from the public `GET` afterward
- `GET /api/v1/maintenance/schedules` as `tenant@proplity.com` → `403` (role gate); `POST` as the unit's actual manager → `201`; `GET` as that manager and as the property's actual landlord (a distinct role, genuinely tied to the same property) both → included, confirmed correct via a direct DB lookup rather than assumed
- All test rows (2 maintenance requests, 1 invoice, 1 vendor rating, 1 schedule, 1 category) cleaned up afterward via a one-off script

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 5 new routes listed alongside the existing 41.

## Next up

Phase 3 — Leases & Tenancy API (`app/api/v1/leases/*`), already spec'd in `docs/development-history/domain-api-implementation-plan.md`.
