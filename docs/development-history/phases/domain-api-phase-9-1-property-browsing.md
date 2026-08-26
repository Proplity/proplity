# Phase: Domain API Phase 9, sub-phase 1 — Public Property Browsing

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

First sub-phase of Phase 9 (frontend read-path hydration, Finding 2 from `out/next-phase-analysis.md`). `PropertyDiscovery.tsx` and `PublicPropertyDetail.tsx` were chosen to go first because their backing routes (`GET /properties`, `GET /properties/[id]`) were already fully built and tested in Phase 1 — lowest risk, no new backend work needed.

## What was built

- **`lib/api/types.ts`** — extended `Property` with the display fields these components need (`trustScore`, `powerReliabilityScore`, `securityRating`, `roadConditionScore`, `moderationStatus`, `waterSupplyType`, `electricalSetup`), added `PropertyReview`/`PropertyDetail` types, and added `amenities: string[]` to `Unit` (a real schema field not previously modeled).
- **`hooks/useProperties.ts`** — added `useProperty(propertyId)`, fetching `GET /properties/[id]`'s full detail shape (units, reviews, reviewStats, latest neighbourhood report).
- **`lib/apiClient.ts`** — added `api.properties.get(propertyId)`.
- **`PropertyDiscovery.tsx`** — replaced `mockProperties` with `useProperties()`. Added a `cardFields()` mapper resolving the real-vs-mock shape mismatches (see below). The ad-creation feature (Create Ad / Cancel Ad) stays 100% local mock state — no `Advertisement` model exists anywhere in the 33-model schema, so there's nothing to hydrate; confirmed this is a deliberate, self-contained UI demo, not an oversight.
- **`PublicPropertyDetail.tsx`** — replaced `mockPublicPropertyDetails`/`mockSimilarProperties` with `useProperty()` + `useProperties()`. `propertyId` prop changed `number` → `string`.
- **`app/dashboard/navigateToPage.ts`** — `property-detail`/`property-application`/`schedule-viewing` variants' `propertyId` changed `number` → `string` (the other variants — `tenantId`, `requestId`, `jobId` — stay `number` until their own sub-phases).
- **`app/properties/[id]/page.tsx`** — dropped the `Number(id)` conversion.

## Real-vs-mock shape mismatches resolved (judgment calls)

- **Price is per-unit, not per-property.** A property can have multiple units at different rents; mock data had one flat `price` string per property. Both components now use the *cheapest* unit's `rentAmount` for the headline price/card display — a defensible simplification, not a data loss, since the full unit list is still available.
- **No scalar water-supply rating exists.** `Property` has `securityRating`/`roadConditionScore`/`powerReliabilityScore` (used for the safety/access/power bars, scaled `/10`), but water only has a `waterSupplyType` enum (`BOREHOLE`/`PUBLIC_GRID`/`WATER_TANKER`/`COMBINED`), not a 0–10 score. Rather than inventing a fake number, the water row now shows the enum value as a text label instead of a bar.
- **"Verified" now means `moderationStatus === 'APPROVED'`**, not a boolean flag. Confirmed via live query that the real seeded properties are still `PENDING_REVIEW` (no admin-approval flow has been built in any phase) — so the "AI Verified" badge correctly does **not** show on real data yet, which is accurate, not a bug.
- **"Amenities & Features" now comes from `Unit.amenities: string[]`** (a real field, populated by `ListProperty.tsx`'s amenities checklist in Phase 7) instead of a `{label, icon}` object array — every amenity now renders with one generic `CheckCircle` icon instead of per-amenity icon matching, since the API returns plain strings.
- **No multi-image gallery exists in the schema** beyond `imageUrl`/`video360Url`/`exteriorPhotoUrl` — the 4-image gallery grid keeps its gradient-placeholder look (matching the pre-hydration visual) rather than trying to fabricate a real photo set.
- **"Similar properties"** is now the other published properties from a real `GET /properties` call (excluding the current one, `.slice(0, 3)`), not a curated mock list.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds.
- Live-tested against the real dev server and seeded database: confirmed `GET /api/v1/properties` returns 4 real published properties with real names/units; confirmed `GET /api/v1/properties/[id]` returns units with real `amenities` arrays, a real `reviewStats` (`count: 1, averageRating: 4`) for a property with a seeded review; confirmed both `/dashboard/discover` (authenticated) and `/properties/[id]` (public) render `200` with no server-side exception.
- **Not verified**: interactive browser click-through (filters, the ad-creation modal, the booking date pickers) — no browser-automation tool available in this environment, same caveat as every prior phase touching the frontend.

## Next up

Sub-phase 2 — Tenant-facing views (`TenantDashboard.tsx`, `TenantMaintenanceRequests.tsx`, `TenantPaymentHistory.tsx`, `NeighbourhoodReport.tsx`).
