# Phase: Domain API Phase 1 — Properties & Units API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

First real consumer of Phase 0's `lib/api/` utilities, and the first domain API for the platform: property listing, detail, units, reviews, viewings, and neighbourhood reports — the foundation everything else (leases, maintenance) hangs units off of.

## What was built

Seven routes, exactly as scoped in `out/domain-api-implementation-plan.md`'s Phase 1 section:

- **`app/api/v1/properties/route.ts`** — `GET` (public, paginated, filtered by `city`/`state`/`type`/`trustScoreMin`/`powerReliabilityMin`/`floodRiskMax`/`minPrice`/`maxPrice`/`minBedrooms`, the price/bedroom filters via a `units: { some: {...} } }` relation query); `POST` (`ADMIN`/`MANAGER`/`LANDLORD` only, auto-assigns `managerId`/`landlordId` from the session when the caller is that role and didn't specify one, and — the one deliberate behavior enforced here — always creates with `isPublished: false` regardless of what the caller sends, since `moderationStatus` defaults `PENDING_REVIEW` and there's no AI/admin approval flow yet to earn a `true`).
- **`app/api/v1/properties/[id]/route.ts`** — `GET` (public; property + units + latest neighbourhood report + reviews with a `verified` flag derived from `leaseId !== null` + aggregate rating stats); `PATCH`/`DELETE` gated by a new `canManageProperty()` helper (the property's own `managerId`/`landlordId`, or `ADMIN`). `DELETE` is soft-archive only (`isPublished: false`) — never `prisma.property.delete()`.
- **`app/api/v1/properties/[id]/units/route.ts`** — `GET` (public, optional `status` filter); `POST` (ownership-gated, `sqft` input aliased to `squareFeet` on write).
- **`app/api/v1/properties/[id]/units/[unitId]/route.ts`** — `GET`/`PATCH`/`DELETE`, same ownership gate.
- **`app/api/v1/properties/[id]/reviews/route.ts`** — `GET` (public, `?verified=true` filter); `POST` (any authenticated user) — resolves the verified badge once at creation by looking up any `Lease` for `tenantId = session.sub` on a unit of this property, never re-checked later.
- **`app/api/v1/properties/[id]/viewings/route.ts`** — `GET` (the property's manager/landlord/admin see all bookings, everyone else sees only their own); `POST` (any authenticated user, rejects a same-user/same-property/same-calendar-day duplicate booking with `409`).
- **`app/api/v1/properties/[id]/neighbourhood-report/route.ts`** — `GET` (public, latest report only).

**New shared helper**: `lib/api/propertyAccess.ts` — `canManageProperty(session, property)` (used by all three property/unit-owning routes) and `serializeUnit()` (the `squareFeet` → `sqft` response aliasing, used everywhere a unit is returned).

## One real judgment call: unit `DELETE`

The plan's spec just said "same RBAC" for unit `DELETE` without specifying hard vs. soft delete, and the schema has no `ARCHIVED` `UnitStatus` to soft-delete into. `Lease.unit` is `onDelete: Cascade`, so a naive hard delete would silently wipe a unit's entire lease/tenancy history. Resolved by refusing the delete with a `409 HAS_LEASES` if any `Lease` rows reference the unit, and hard-deleting only when none exist — consistent with the codebase's stated "soft-delete/archive over hard delete" convention without inventing a schema value that isn't there.

## Verification performed

Full live end-to-end pass against a real dev server and the seeded database (not just `tsc`/`build`):

- `GET /api/v1/properties` unauthenticated → `200` with real seeded data
- `POST /api/v1/properties` as `manager@proplity.com` with `isPublished: true` in the body → `201`, response confirms `isPublished: false` anyway (moderation gate working) and `managerId` auto-set to the session's user id
- `GET /api/v1/properties/[id]` → `200`, correct empty `units`/`reviews`/`neighbourhoodReports` arrays and `reviewStats` on a fresh property
- `POST .../units` as the owning manager → `201`, `sqft` correctly present in the response (aliased from `squareFeet`), defaults (`listedPaymentFrequency: ANNUAL`, `status: VACANT`) applied
- `POST .../units` as a tenant who doesn't own the property → `403`
- `POST .../units` unauthenticated → `401`
- `GET`/`PATCH .../units/[unitId]` as owning manager → `200`, status update persisted
- `POST .../reviews` as a tenant with no qualifying lease → `201` with `verified: false`
- `POST .../viewings` → `201`; an immediate second booking same property/user/day → `409 DUPLICATE_BOOKING`; `GET` as that tenant shows only their own booking
- `GET .../neighbourhood-report` on a property with none → `404`
- `DELETE .../units/[unitId]` with no lease history → `200`, hard-deleted, subsequent `GET` → `404`
- `DELETE .../properties/[id]` → `200`, confirmed `isPublished: false` (soft-archive, not a real delete)
- All test rows (property, unit, review, viewing) cleaned up afterward via a one-off script so the seeded dataset's documented row counts in `CURRENT_STATE.md` stay accurate

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 7 new routes listed alongside the existing 34.

## Next up

Phase 2 — Maintenance & Operations API (`app/api/v1/maintenance/*`), already spec'd in `out/domain-api-implementation-plan.md`.
