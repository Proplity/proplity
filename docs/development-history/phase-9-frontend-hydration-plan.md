# Phase 9 — Frontend Read-Path Hydration: plan

**Status:** Approved by user ("tackle 2 first"), in progress. Scoped into sub-phases rather than one pass, given the size (20 components across 5 mock-data files).

## Why this needs sub-phases, not one plan

Phase 7 wired 5 *write* forms. Every *read* path — every dashboard, list, and detail view — still imports directly from `app/store/*`. A full catalog (via `grep` across all 37 top-level components) confirms exactly 20 components with real data needs still on mock data (3 more — `LandlordFeaturePage`, `TenantFeaturePage`, `ServiceProviderFeaturePage` — are static marketing pages with no real per-user data to hydrate, and `AIAssistant.tsx` needs an actual LLM integration that doesn't exist anywhere in this project — both explicitly **out of scope** for this phase).

Unlike Phase 7's 5 forms (each independent, each with one clear POST target), these 20 components share data across roles and often need the SAME underlying data shaped differently per screen (e.g., a manager's `Dashboard.tsx` and a tenant's `TenantDashboard.tsx` both surface lease/invoice data, from opposite sides). Attempting all 20 in one pass risks the same thing a 20-file diff always risks: partial breakage that's hard to isolate. Splitting by role/domain — the same principle the original 6 domain-API phases used — keeps each sub-phase independently testable via the existing 5 demo accounts.

## Sub-phases, in planned order

1. **Public property browsing** (lowest risk — routes are public, already fully built and tested in Phase 1): `PropertyDiscovery.tsx`, `PublicPropertyDetail.tsx` (2 components).
2. **Tenant-facing views**: `TenantDashboard.tsx`, `TenantMaintenanceRequests.tsx`, `TenantPaymentHistory.tsx`, `NeighbourhoodReport.tsx` (4 components).
3. **Manager/Landlord operational views** (largest group, re-scoped to include `PropertyDetail.tsx`): `Dashboard.tsx`, `DashboardBreakdownPage.tsx`, `LandlordDashboard.tsx`, `TenantManagement.tsx`, `TenantDetail.tsx`, `MaintenanceBoard.tsx`, `MaintenanceDetail.tsx`, `PropertyDetail.tsx` (8 components). `PropertyDetail.tsx` moved here from sub-phase 1 during implementation: unlike the public browsing views (one `GET /properties/[id]` call), it needs current-tenant/financial-rollup/maintenance-history aggregation across Lease+Invoice+MaintenanceRequest — the same cross-domain composition this whole group needs, not the simpler public-data shape sub-phase 1 covers.
   - **Further split mid-implementation, same reasoning as the sub-phase-1 re-scope**: 8 components at once was too much to verify as one unit. **3a** (done): `Dashboard.tsx`, `TenantManagement.tsx`, `TenantDetail.tsx`, `MaintenanceBoard.tsx`, `MaintenanceDetail.tsx` — the tenant/maintenance operational core, all backed by routes that already existed or needed only additive `include` extensions, plus one genuinely new route (`GET /api/v1/vendors` — no vendor-listing endpoint existed anywhere, needed for the assign-vendor picker). **3b** (done): `PropertyDetail.tsx`, `LandlordDashboard.tsx`, `DashboardBreakdownPage.tsx` — the property/portfolio-rollup group; `DashboardBreakdownPage.tsx` alone is 929 lines covering 5 distinct breakdown views (properties/tenants/rent/maintenance/renewals), each with its own aggregate shape and 4 recharts visualizations. No new backend needed — reused everything sub-phase 3a built. **Sub-phase 3 is now fully complete.**
4. **Vendor-facing views**: `VendorDashboard.tsx`, `VendorJobDetail.tsx` (2 components).
5. **Messaging**: `MessagingPortal.tsx` (1 component) — the one place a genuinely new hook (`useConversations`) needs building, since Phase 7's 5 hooks didn't cover Communications.
6. **Admin views** (highest risk, likely needs new endpoints — see below): `AdminDashboard.tsx`, `AdminBreakdownPage.tsx`, `AdminReports.tsx` (3 components).

3 + 4 + 7 + 2 + 1 + 3 = 20, matching the catalog.

## Flagged in advance: Admin views likely need new aggregate endpoints

`AdminDashboard`/`AdminBreakdownPage`/`AdminReports` show **platform-wide** aggregates (total revenue across all properties, user growth, uptime) — nothing in the 34 existing routes computes a cross-tenant aggregate; every Phase 1–6 route is scoped to what one caller is authorized to see (their own properties, their own leases). Building these will likely mean adding 1–2 new `ADMIN`-only aggregate routes, which is real new backend work, not just a frontend swap — flagged now so it isn't a surprise when sub-phase 6 arrives; will confirm the exact shape needed once the first 5 sub-phases establish the hydration pattern.

## Standing pattern for each sub-phase

Same shape as every prior phase in this project:
1. Read the target component(s) fully — data shape, prop types, id types (mock ids are `number`, real ids are UUID `string`, same conversion work as Phase 7).
2. Identify the real `GET` route(s) already built that supply the data; add a read-hook if one doesn't exist yet (extending `hooks/use*.ts` rather than inventing a new file per component where one already fits).
3. Replace the mock import with the hook, handle loading/error states, resolve any real vs. mock field-shape mismatches (documented as judgment calls, same as Phase 7's `AddTenantForm`/`VendorCreateInvoice`).
4. `tsc`/`build` clean; live-test by logging in as the relevant demo role and confirming the SSR-safe render + (where feasible) the actual data returned matches the DB, the same verification depth Phase 7 achieved (no browser-automation tool available in this environment, so interactive click-through stays unverified, same caveat as Phase 7).
5. Write `out/phases/domain-api-phase-9-<n>-<name>.md` per sub-phase, then commit.

Starting now with sub-phase 1 (Property Discovery & Detail).
