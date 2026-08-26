# Phase 10, sub-phase 4 — Maintenance & Operations test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Fourth sub-phase of Finding 3. Covers `app/api/v1/maintenance/*` (5 routes) — the domain with the most distinct actor roles in one workflow (tenant submits, manager triages, vendor executes, tenant rates) and the route where Phase 9.4 found a real production bug (`unit.property`/`tenant` missing from the list include).

## What was built

- **`tests/helpers/fixtures.ts`** — added `createMaintenanceCategory()`, `createMaintenanceRequest()`, `createMaintenanceSchedule()`.
- **`tests/api/maintenance.test.ts`** (18 tests, 6 describe blocks):
  - **categories** — public unauthenticated GET returns only `isActive: true`; POST/PATCH are ADMIN-only.
  - **requests, create** — non-tenant callers rejected; creating on a unit with no `ACTIVE` lease for that tenant is refused (403); a request with no `categoryId` supplied stays `null` (rule 7's nullable-by-design category) and `priority` defaults to `MEDIUM`.
  - **requests, list scoping** — the full role matrix in one test: a TENANT sees only their own requests, a VENDOR sees only requests assigned to them, a MANAGER sees only requests on their own properties, and ADMIN sees everything. A second test is a direct regression check for the Phase 9.4 bug (list route was silently missing `unit.property`/`tenant`) — asserts both are present and correctly populated on every row, so a future edit that drops the include again fails loudly instead of only showing blank UI fields.
  - **requests, `[id]` read access** — the owning tenant, the assigned vendor, and the managing property owner can all read it; an unrelated tenant gets 403.
  - **requests, `[id]` PATCH** — the four separate authorization branches the route implements, each tested against both the allowed and a forbidden actor: triage (category/priority/vendor/schedule — managing owner only), cancel (managing owner *or* the owning tenant — the one branch with two allowed actors), progress to `IN_PROGRESS` (assigned vendor only, and can attach `vendorNotes` in the same call), and completion (assigned vendor only, requires `completionProofUrl`+`finalCost`, and — verified directly via `testPrisma`, not just the response body — auto-creates a real `MAINTENANCE` invoice in the same transaction). A fourth branch, a `vendorNotes`-only update with no status change, is also covered.
  - **rating** — the full precondition chain: rating before `COMPLETED` is 409, rating by anyone but the owning tenant is 403, and a second rating attempt on the same request hits the `@unique` constraint and comes back 409 (via `handleApiError`'s P2002 mapping) rather than silently overwriting.
  - **schedules** — TENANT/VENDOR are rejected outright (`withAuth({roles: ['ADMIN','MANAGER','LANDLORD']})`); MANAGER/LANDLORD only see schedules on their own properties, ADMIN sees all; creation is gated through `canManageProperty()` on the unit's own property, same pattern as the properties/units domain.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 3 files, 59/59 passing (41 carried over from 10.1–10.3 + 18 new).

## What's next

10.5 — Leases & Tenancy: the tenant-invite flow (`PENDING_VERIFICATION` user + `VerificationToken`), notices, notes, the `rentAmount`-is-per-cycle rule, and renewals-are-`Notice`-not-a-`LeaseStatus`.
