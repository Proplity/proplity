# Phase: Domain API Phase 9, sub-phase 3a — Manager/Landlord Operational Core

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

First half of sub-phase 3 (re-scoped mid-implementation — see `out/phase-9-frontend-hydration-plan.md`). Covers the tenant/maintenance operational core a manager uses day to day: `Dashboard.tsx`, `TenantManagement.tsx`, `TenantDetail.tsx`, `MaintenanceBoard.tsx`, `MaintenanceDetail.tsx`. Split out from the full 8-component sub-phase 3 because that was too much to verify as one unit — `PropertyDetail.tsx`, `LandlordDashboard.tsx`, and the 929-line `DashboardBreakdownPage.tsx` are deferred to sub-phase 3b.

## Backend changes

**Additive `include` extensions** (same pattern as sub-phase 2 — no behavior change for existing consumers):
- `GET /api/v1/leases` (list) — added `tenant: { select: id/name/email/phoneNumber/avatarUrl }` to the existing `unit.property` include, for the tenant list table.
- `GET /api/v1/leases/[id]` — extended the `invoices` include to also include `payments`, so a single lease-detail call carries real payment history (previously only the list-level invoice fields, no payments).
- `GET /api/v1/invoices` (list) — added `lease: { tenant: {id,name}, unit: { unitNumber, property: {id,name} } }` (minimal `select`, not full objects) so Dashboard's recent-payments feed can show tenant/property names without a second round-trip per row.

**One new endpoint**: `GET /api/v1/properties?scope=mine` — the existing `GET /properties` route is deliberately public/unauthenticated (PropertyDiscovery and PublicPropertyDetail from sub-phase 1 depend on that) and only ever returns `isPublished: true` listings, with no `managerId`/`landlordId` filter at all. There was no way for a manager's own dashboard to list *their* properties (published or still pending review). Added an opt-in `scope=mine` mode: when present, the route requires auth (checked manually via `getServerSession()`, not the `withAuth` wrapper, so the route stays callable anonymously by default) and returns the caller's own properties regardless of publish state. The default, unscoped request path is byte-for-byte unchanged.

**One new route**: `GET /api/v1/vendors` — confirmed by search that no vendor-listing endpoint existed anywhere in the API. MaintenanceDetail's assign-vendor picker needs one. MANAGER/LANDLORD/ADMIN only; returns active VENDOR users with reputation computed at query time from real `VendorRating`/`MaintenanceRequest` rows (average rating, completion rate = completed jobs ÷ total assigned jobs, jobs-done count) — no cached score column, per CLAUDE.md rule 8.

`PATCH /api/v1/maintenance/requests/[id]` and `POST /api/v1/leases/[id]/notes` already existed fully-built from earlier phases and needed no changes — MaintenanceDetail's vendor-assign/complete/cancel actions and TenantDetail's note-adding both write through routes that were already there.

## What was built

- **`lib/api/types.ts`** — added `Notice`, `Note`, `Vendor`, `UpdateMaintenanceRequestInput` types; extended `Lease` (tenant incl. emergency contact fields, `riskScore`, `paymentReliability`, `notices`, `invoices`); extended `Invoice` (`lease` relation); extended `MaintenanceRequest` (`tenant`, `vendorRating`, `unit.property`).
- **`lib/apiClient.ts`** — added `api.properties.mine()`, `api.leases.get()`, `api.leases.notes.list/create()`, `api.maintenance.get()`, `api.maintenance.update()`, `api.vendors.list()`.
- **`hooks/useProperties.ts`** — added `useMyProperties()`.
- **`hooks/useLeases.ts`** — added `useLeases()` (list), `useLease(id)` (detail), `useLeaseNotes(id)`, `useCreateLeaseNote(id)`.
- **`hooks/useMaintenanceRequests.ts`** — added `useMaintenanceRequest(id)` (detail), `useUpdateMaintenanceRequest(id)`.
- **`hooks/useVendors.ts`** — new file, `useVendors()`.
- **`Dashboard.tsx`** — replaced `mockRecentPayments`/`mockUpcomingRenewals` with real data assembled from `useMyProperties`, `useLeases`, `useInvoices`, `useMaintenanceRequests`.
- **`TenantManagement.tsx`** — replaced `mockTenantManagementTenants` with `useLeases()` joined against `useInvoices({type:'RENT'})`.
- **`TenantDetail.tsx`** — `tenantId: number` → `leaseId: string`. Replaced `mockTenantDetails` with `useLease(leaseId)` + `useMaintenanceRequests()` (filtered client-side by `unitId`) + `useLeaseNotes`/`useCreateLeaseNote` (a real, working "Add Note" button — previously decorative).
- **`MaintenanceBoard.tsx`** — replaced `mockMaintenanceBoardRequests` with `useMaintenanceRequests()`, bucketed into the 3 kanban columns by real `status`.
- **`MaintenanceDetail.tsx`** — `requestId: number` → `requestId: string`. Replaced `mockVendors`/`getMockMaintenanceDetailRequest` with `useMaintenanceRequest(id)` + `useVendors()` + `useUpdateMaintenanceRequest(id)`. Assign-vendor, mark-completed, and cancel-request are now real PATCH calls, not local `useState`.
- **`app/dashboard/navigateToPage.ts`** — `tenant-detail`'s `tenantId: number` → `leaseId: string`; `maintenance-detail`'s `requestId: number` → `requestId: string`.
- **`app/dashboard/tenants/[id]/page.tsx`**, **`app/dashboard/maintenance/[id]/page.tsx`** — dropped the `Number(id)` conversions.

## Real-vs-mock shape mismatches resolved (judgment calls)

- **No "Active Tenants" stat exists as a count of distinct people** — a tenant with two leases would double-count. Used "Active Leases" (count of `ACTIVE`-status leases) instead, and relabeled the stat card accordingly rather than fabricating tenant deduplication logic the schema doesn't need elsewhere.
- **Dashboard's stat-card trend arrows (`+3`, `-3`, `+8%` etc.) are dropped entirely.** There's no historical snapshot anywhere to compute a real delta against (would need a time-series table nothing writes to). Showing a fabricated trend arrow next to a real number would be worse than showing no trend at all.
- **"Upcoming Renewals" has no real "contacted" status.** The mock's `contacted`/`pending` pill doesn't correspond to a stored field — the closest real concept (a `Notice` of type `RENEWAL_OFFER` with status `SENT`/`VIEWED`/`COUNTERED`, per CLAUDE.md rule 6) would require a per-lease fetch this list-level view can't afford. Replaced with "Nd left" computed directly from `Lease.endDate`, which is real and requires no extra request.
- **Dashboard's "AI Insights" banner (3 hardcoded bullets) dropped entirely** — pure fabricated copy, no underlying computation.
- **TenantManagement's "AI Payment Prediction" banner (hardcoded tenant names "Tunde Bakare and Ibrahim Musa") dropped** — same reason.
- **Rent status (paid/due/overdue) and next-due date are computed, not stored** — same derivation as sub-phase 2's `TenantPaymentHistory`: the earliest unpaid `RENT` invoice for a lease decides the bucket.
- **Risk score now comes from the real `Lease.riskScore` enum** (`LOW`/`MEDIUM`/`HIGH`, computed by the Phase 8 `paymentReliabilityScorer` worker) instead of a fabricated random value — leases the worker hasn't scored yet show "UNSCORED"/"Unscored" rather than guessing.
- **TenantDetail's "Emergency Contact" and avatar turned out to be real fields already on `User`** (`emergencyContactName/Relationship/Phone`, `avatarUrl`) — a pleasant surprise; no fabrication needed there at all, unlike the "manager contact" gap found in sub-phase 2.
- **TenantDetail's "Documents" reduced to `Lease.signedAgreementUrl`** only, same reasoning as sub-phase 2 (no generic document-storage model exists). Payment-history "Receipt download" column dropped for the same reason as sub-phase 2 (no receipt generation exists).
- **MaintenanceDetail's "AI Classification" box (fabricated urgency text, estimated time, confidence %) replaced with a "Triage" box** showing only real fields: category, priority, `costEstimate`, `scheduledFor`.
- **MaintenanceDetail's "Photos & Evidence" renders real `mediaUrls`**, empty in all 3 seeded requests — matches the known, already-documented gap ("maintenance image upload is display-only"), not a bug being newly introduced.
- **MaintenanceDetail's inline "Communication" chat box dropped** — `MaintenanceRequest.conversation` is a real relation, but wiring actual `Conversation`/`Message` rendering is explicitly sub-phase 5's job (`useConversations` doesn't exist yet); building a one-off partial version here would duplicate that work.
- **Vendor-assignment modal's fabricated concepts dropped**: "AI recommends X — 98% match", per-vendor `aiMatch` %, `priceRange`, and a `Busy`/`available` flag — none of these have any backing field. Replaced with real computed stats (`rating`, `completionRate`, `jobsDone`, `categories`, `coverageArea`) from the new `GET /vendors` endpoint. Also collapsed the original two-step select→confirm modal into a single step (click a vendor → immediately assigns) since the confirmation step's content was mostly the fabricated AI-recommendation copy.
- **"Mark as Completed" now requires real input** (`completionProofUrl`, `finalCost`) via a small modal, matching the PATCH route's actual validation (`completionProofUrl` and `finalCost` are both required to complete a request) — the mock's button had no backing logic at all.
- **Dropped "Update Priority" button** (MaintenanceDetail) and **"Filter" button** (TenantManagement) — both were `alert()` placeholders in the mock with no real target; since every other button on these pages now performs a real action, leaving inert ones in place would be actively misleading rather than neutral.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors. `pnpm build` — succeeds; `/api/v1/vendors` appears in the route list.
- Live-tested against the real dev server and seeded database as `manager@proplity.com`:
  - `GET /properties?scope=mine` returns all 4 of the manager's properties including `PENDING_REVIEW` (unpublished-to-the-public) ones — confirms the new scoped mode works and is distinct from the public default.
  - `GET /vendors` returns 3 real vendors with correctly computed `rating`/`completionRate`/`jobsDone` (spot-checked against the underlying `VendorRating`/`MaintenanceRequest` rows).
  - `GET /leases` confirmed `tenant` and `riskScore` now present; `GET /invoices` confirmed `lease.tenant.name` present.
  - `GET /leases/[id]` confirmed nested `invoices[].payments[]` and `notices[]` present.
  - `GET /maintenance/requests/[id]` confirmed full detail shape (`unit.property`, `category`, `vendor`, `tenant`).
  - All 5 pages (`/dashboard`, `/dashboard/tenants`, `/dashboard/tenants/[id]`, `/dashboard/maintenance`, `/dashboard/maintenance/[id]`) render `200` with no server-side exception.
  - **Write paths exercised directly against the API** (not just read paths, since this sub-phase adds real mutations for the first time): `PATCH /maintenance/requests/[id]` to reassign a vendor and reassign back (round-tripped, final state matches original — no permanent change); `POST /leases/[id]/notes` to confirm note creation works, then the test note was deleted directly via Prisma (no `DELETE /notes` route exists) to keep the seed data clean.
- **Not verified**: interactive browser click-through (the assign-vendor modal's search/filter, the mark-completed modal's form validation UX) — no browser-automation tool available in this environment, same caveat as every prior frontend phase.

## Next up

Sub-phase 3b — `PropertyDetail.tsx`, `LandlordDashboard.tsx`, `DashboardBreakdownPage.tsx` (the property/portfolio-rollup group, including the 929-line, 5-breakdown-type `DashboardBreakdownPage.tsx`).
