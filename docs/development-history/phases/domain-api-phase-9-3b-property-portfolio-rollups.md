# Phase: Domain API Phase 9, sub-phase 3b — Property/Portfolio Rollups

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Second half of sub-phase 3 (see `out/phase-9-frontend-hydration-plan.md` for the 3a/3b split rationale). Covers the property/portfolio-rollup group: `PropertyDetail.tsx`, `LandlordDashboard.tsx`, `DashboardBreakdownPage.tsx`. This closes out sub-phase 3 and, with it, all 8 originally-scoped manager/landlord operational views.

## Backend changes

None. Every route this sub-phase needed (`GET /properties?scope=mine`, the extended `leases`/`invoices`/`maintenance/requests` includes) was already built in sub-phase 3a — this sub-phase is purely a frontend consumer of that work, plus one small type addition (`Property.isPublished`, `managerId`, `landlordId` — these were already present in the raw API response, just not modeled in `lib/api/types.ts` until now).

## What was built

- **`lib/api/types.ts`** — added `isPublished`, `managerId`, `landlordId` to `Property`.
- **`PropertyDetail.tsx`** — `propertyId: number` → `string`. This component turned out to be dual-purpose (confirmed by checking every place it's rendered): the only route pointing to it, `/dashboard/properties/[id]`, is reachable by *any* authenticated role, not just managers — a `TENANT` browsing `/dashboard/discover` lands here too, expecting the "Schedule Viewing"/"Apply Now" flow. Added a client-side `canManage` gate (`useAuth().user` matched against the property's real `managerId`/`landlordId`, or `role === 'admin'`) that decides whether to render the owner-only "Units & Tenants" and "Financial Summary" sections at all.
- **`LandlordDashboard.tsx`** — replaced `mockLandlordDashboardProperties` and the hardcoded stat/activity/revenue numbers with `useMyProperties`, `useLeases`, `useInvoices`, `useMaintenanceRequests`.
- **`DashboardBreakdownPage.tsx`** — the largest single file in this engagement (929 lines, 5 distinct breakdown views: properties/tenants/rent/maintenance/renewals, plus 4 recharts visualizations on the rent view). Replaced all 9 imports from `app/store/dashboardBreakdownData.ts` with the same 4 hooks used by `LandlordDashboard`, computed once and sliced per `breakdownType`.
- **`app/dashboard/properties/[id]/page.tsx`** — dropped the `Number(id)` conversion.
- **`app/dashboard/breakdown/[type]/page.tsx`** — added the `onNavigate` prop (didn't exist before; needed for the breakdown tables' new real "View Details"/"View" row actions).
- **`app/dashboard/navigateToPage.ts`** — simplified `property-application`/`schedule-viewing` Page variants from `{propertyId, propertyTitle, propertyPrice/propertyAddress}` down to just `{propertyId}` — `navigateToPage`'s `router.push` never actually read the title/price/address fields (a leftover from the pre-migration in-memory router where the whole `Page` object doubled as prop-passing), and the two page wrappers that consume the resulting route already fetch their own real property data independently. Confirmed via grep that `PropertyDetail.tsx` was the only caller constructing either variant, so this was safe to simplify.

## Real-vs-mock shape mismatches resolved (judgment calls)

- **`PropertyDetail`'s single-unit assumption doesn't hold** — a real `Property` has a `Unit[]`, not one flat bed/bath/rent. Replaced the mock's one "Current Tenant" card with a "Units & Tenants" list, one row per real unit, each showing its own active lease's tenant (if any) via a real `Lease` lookup by `unitId`.
- **Financial Summary is now computed from real invoices/payments/maintenance** scoped to the property's leases (`collected`, `pending`, `maintenanceCosts`, `netIncome`) — "Yearly Rent" relabeled "Total Listed Rent" (sum of `Unit.rentAmount`) since, per CLAUDE.md rule 5, `rentAmount` is per payment *cycle*, not necessarily annual, and this property's units aren't guaranteed to share one frequency.
- **Property "Edit" button dropped** (was already a bare, unwired icon button in the mock — no regression).
- **`LandlordDashboard`'s "Performance" bar relabeled "Occupancy"** — the mock's 0–100 performance score had no real analogue; occupied-units ÷ total-units is the closest real metric and is what the bar visually represented anyway.
- **"Recent Activity" is now a real merged feed** (payments + completed maintenance + newly-active leases, sorted by real timestamp) replacing 4 hardcoded fabricated events with invented tenant names.
- **"Investment Summary" card dropped entirely** (`₦450M` total value, `8.5%` ROI, hardcoded "3 properties managed") — no purchase-price/valuation field exists anywhere in the schema to compute a real ROI from, and the portfolio-stats grid above already shows the one real number (property/unit counts) this card duplicated.
- **"Manager Access Codes" left completely untouched** — unlike everything else in this component, it was *already* self-contained local `useState`, not reading from `app/store/*`. No `AccessCode`-style model exists for landlord→manager account linking anywhere in the schema (a different concept from the real gate-access `AccessCode` model), so this stays a demo feature, same as `NeighbourhoodReport`'s premium-upgrade banner from sub-phase 2.
- **`DashboardBreakdownPage`'s property status dropdown (Activate/Deactivate/Edit/Delete) replaced with a single real "View Details" link** to the now-real `PropertyDetail` page. The dropdown's actions were all `alert()`/`confirm()` placeholders with a fake local `propertyStatuses` object backing the "Active/Inactive/Partial" badge — there's no real per-property active/inactive flag in the schema (only `isPublished`/`moderationStatus`, both gated by the admin-moderation flow per the properties POST route's own comment), so building a working toggle here would mean either fabricating a field or bypassing that gate. Status badge is now derived read-only from real `isPublished` + unit occupancy instead.
- **Tenant breakdown's "Evicted" tab renamed "Terminated / Expired"** and its `Reason`/`Arrears Owed`/`Eviction Date` columns dropped — `LeaseStatus` has `TERMINATED`/`EXPIRED`, but no eviction-reason or arrears-tracking fields exist anywhere on `Lease` or `Notice`.
- **Renewals breakdown's "Contact Status"/"Action" columns dropped**, same reasoning as Dashboard's upcoming-renewals widget in sub-phase 3a (would need a per-lease `Notice` fetch this list-level view can't afford) — replaced with a real "Days Left" badge and a real "View" link to the tenant's lease.
- **Rent breakdown's "Receipt" column dropped** — no receipt generation exists anywhere (same reasoning as sub-phase 2's `TenantPaymentHistory`).
- **All 4 rent charts are now computed from real data**: Collection Trend (billed vs. collected per month, last 6 months, from real `Invoice.dueDate`/`Payment.paidAt`), Rent by Property (real per-property payment totals — relabeled "all-time" instead of "this month" since the small seeded dataset's payments predate the current month and an all-time total is more representative of what limited real data exists), Payment Methods (real `Payment.paymentMethod` distribution), Collection Status (real collected-vs-pending). **Observed, not fixed**: because the seed data's 2 real payments are dated January/February 2026 and "today" in this environment is August 2026, the Collection Trend chart's last-6-months window (March–August) is empty — an honest reflection of the small, early-dated seed dataset, not a bug in the computation (verified the underlying `GET /invoices` data directly to confirm this before treating it as expected rather than broken).
- **Hero row's fabricated trend arrows (`+3 this quarter`, `+12 this month`, etc.) dropped entirely** across all 5 breakdown types — same reasoning as sub-phase 3a's `Dashboard.tsx`.
- **Filter/Export toolbar buttons dropped** — decorative, no real target, same as sub-phase 3a's `TenantManagement`.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors. `pnpm build` — succeeds.
- Live-tested against the real dev server and seeded database:
  - Confirmed `manager@`, `landlord@`, and `tenant@proplity.com` can all reach `/dashboard/properties/[id]` with `200`, no server-side exception.
  - **Explicitly verified the access-control gate is sound, not just visually hidden**: fetched `GET /leases` as `tenant@proplity.com` directly and confirmed the API only ever returns *their own* lease — even though that lease happens to be on the same property used for this test (so a client-side filter bug could have looked like it worked by coincidence), the `canManage` check gates on `auth.user.role`/`managerId`/`landlordId` independently of what the scoped hooks return, so the owner-only sections stay hidden regardless.
  - Confirmed `property.managerId`/`landlordId` in the real API response match `manager@`/`landlord@proplity.com`'s real user IDs respectively (both own Highland Park Residences in the seed).
  - Confirmed `GET /properties?scope=mine` returns all 4 properties for both `manager@` and `landlord@`.
  - All 7 pages exercised (`/dashboard`, `/dashboard/properties/[id]`, and all 5 `/dashboard/breakdown/[type]` routes) render `200` with no server-side exception, as manager.
- **Not verified**: interactive browser click-through (the breakdown page's search/tenant-tab toggle, the recharts tooltips) — no browser-automation tool available in this environment, same caveat as every prior frontend phase.

## Sub-phase 3 complete

This closes out sub-phase 3 (3a + 3b) — all 8 originally-scoped manager/landlord operational views are now real-data-backed: `Dashboard`, `TenantManagement`, `TenantDetail`, `MaintenanceBoard`, `MaintenanceDetail`, `PropertyDetail`, `LandlordDashboard`, `DashboardBreakdownPage`.

## Next up

Sub-phase 4 — Vendor-facing views: `VendorDashboard.tsx`, `VendorJobDetail.tsx` (2 components).
