# Phase 10, sub-phase 3 — Properties & Units test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Third sub-phase of Finding 3. Covers `app/api/v1/properties/*` (7 routes) — the first domain touching `lib/api/propertyAccess.ts`'s `canManageProperty()`/`serializeUnit()` and the first sub-phase needing fixtures beyond `createUser`.

## What was built

- **`tests/helpers/fixtures.ts`** — added `createProperty()`, `createUnit()`, `createLease()`. Kept intentionally minimal (only the fields these tests actually assert on plus the schema's required ones), consistent with the plan's "add factories when a sub-phase actually needs them" rule.
- **`tests/api/properties.test.ts`** (18 tests, 7 describe blocks):
  - **public browsing (default, unauthenticated)** — only `isPublished: true` properties are returned with no session at all; `sqft`↔`squareFeet` aliasing is correct in the list response (`sqft` present, raw `squareFeet` absent); price filtering goes through `Unit.rentAmount` via the `some` relation filter, not a nonexistent `Property.price` column (rule 9).
  - **`scope=mine`** — 401 unauthenticated, 403 for a TENANT/VENDOR caller, a MANAGER only sees their own properties (published or not) and never another manager's, and ADMIN sees every property regardless of owner (the `where: {}` branch).
  - **create** — 403 for a TENANT; a MANAGER's new property auto-fills `managerId` from the session; **`isPublished: true` in the request body is silently dropped** — every new listing starts unpublished regardless of what the caller sends, since real publication is gated on `moderationStatus`, not built yet.
  - **`canManageProperty()` gating on PATCH/DELETE** — the owning manager can edit; a different manager gets 403; ADMIN can edit anyone's; DELETE soft-archives (`isPublished: false`) rather than removing the row, confirmed by re-`GET`ing the same id afterward and still finding it (rule: soft-delete/archive throughout).
  - **verified reviews** — the core assertion behind CLAUDE.md rule 4: a tenant with a real lease on a unit of the property gets `verified: true`, a stranger with no lease gets `false`, and `?verified=true` correctly filters to only the former.
  - **units** — deleting a unit with lease history is refused (409, `HAS_LEASES`) rather than cascading away tenancy records (`Lease.unit` has `onDelete: Cascade`, so a hard delete would silently destroy real lease rows); a unit with no lease history deletes cleanly; `sqft` round-trips correctly through create → get → patch.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 2 files, 41/41 passing (23 from Phase 10.1/10.2's auth suite + 18 new).

## What's next

10.4 — Maintenance & Operations: `MaintenanceRequest.categoryId` nullable vs. `MaintenanceSchedule.categoryId` required, priority defaults, vendor assignment + `vendorNotes` patch path, rating, category CRUD.
