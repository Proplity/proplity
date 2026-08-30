# Phase: Domain API Phase 9, sub-phase 2 — Tenant-facing Views

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Second sub-phase of Phase 9 (frontend read-path hydration). Covers the 4 components a logged-in tenant sees day to day: `TenantDashboard.tsx`, `TenantMaintenanceRequests.tsx`, `TenantPaymentHistory.tsx`, `NeighbourhoodReport.tsx`. All 4 are keyed off the logged-in tenant's own session (no propertyId/leaseId ever appears in their routes), matching the `useActiveLease()` pattern Phase 7 already established.

## Backend changes (additive, no new routes)

Three existing GET routes were extended with additional Prisma `include`s so the data these components need was actually present in the response — no new endpoints, no behavior change for existing consumers:

- **`GET /api/v1/leases`** — `include: { unit: true }` → `include: { unit: { include: { property: true } } }`. Needed for property name/address/city on the tenant's lease card (and will serve sub-phase 3's manager/landlord views too).
- **`GET /api/v1/invoices`** — added `include: { payments: { orderBy: { paidAt: 'desc' } } }` (previously no include at all). This is the only real gap found this sub-phase: there is no `GET /payments` route anywhere, so payment history has to be read off `Invoice.payments`. `GET /invoices/[id]` already did this per-invoice; the list route just hadn't been extended to match.
- **`GET /api/v1/maintenance/requests`** — added `vendor: { select: { id: true, name: true } }` to the existing `include: { unit: true, category: true }`, for the "Assigned To" field. Selected name only, not email/phone.

Verified via live requests as `manager@`/`vendor@proplity.com` (not just `tenant@`) that these extensions don't break the other roles' existing scoping — all still 200 with correct role-scoped data.

## What was built

- **`lib/api/types.ts`** — added `Payment`, expanded `Invoice` (leaseId/maintenanceRequestId/userId/type/dueDate/status/description/payments/createdAt), added `MaintenanceRequest` (full field set + `category`/`vendor`/`unit`), expanded `Lease` (unit incl. property, startDate/endDate/rentAmount/paymentFrequency/deposit/signedAgreementUrl), added `generatedAt`/`demographics` to `PropertyDetail.neighbourhoodReports[]` (both were missing from Phase 9.1's type).
- **`lib/apiClient.ts`** — added `api.invoices.list()`, `api.maintenance.list()`.
- **`hooks/useInvoices.ts`** — added `useInvoices(params?)`.
- **`hooks/useMaintenanceRequests.ts`** — added `useMaintenanceRequests(params?)`.
- **`TenantDashboard.tsx`** — replaced 4 mock imports (`mockTenantPaymentHistory`, `mockTenantMaintenanceRequests`, `mockTenantAccessCodes`, `mockTenantDocuments`) with `useActiveLease`, `useInvoices`, `useMaintenanceRequests`, `useAccessCodes` (the last already existed from Phase 7, unused until now).
- **`TenantMaintenanceRequests.tsx`** — replaced `mockTenantMaintenanceRequests` with `useMaintenanceRequests()`.
- **`TenantPaymentHistory.tsx`** — replaced `mockAllPaymentsDetailed` with a derived record list built from `useInvoices()`.
- **`NeighbourhoodReport.tsx`** — replaced `mockReportData` with `useActiveLease()` → `useProperty(lease.unit.propertyId)` → `property.neighbourhoodReports[0]` (the same embedded data Phase 9.1's `useProperty` hook already fetches; a separate dedicated `GET /properties/[id]/neighbourhood-report` route exists but returns the identical shape, so no second request was added).

## Real-vs-mock shape mismatches resolved (judgment calls)

- **Outstanding balance / next payment due are computed, not stored.** No single field holds "current balance" — it's derived per-render as `sum(invoice.amount - sum(invoice.payments.amount))` across non-cancelled invoices; "next payment due" is the earliest-due unpaid/overdue/partially-paid invoice.
- **"Property Manager" contact card removed.** The mock hardcoded a phone/email. Nothing in `GET /leases` or `GET /properties/[id]` exposes the assigned manager's contact info (and the properties route is public/unauthenticated, so adding it there would leak manager PII to anonymous visitors). Replaced with a link to the real Messages feature instead of fabricating contact details.
- **"Documents" section reduced to the one real document that exists**: `Lease.signedAgreementUrl`. There's no generic document-storage model in the schema (matches the known gap: maintenance image upload is also display-only). Shows the signed agreement link if present, an empty state otherwise — not a fabricated document list.
- **MaintenanceRequest has no activity-log/event-history model.** The mock's per-request "Activity Timeline" (arbitrary `{text, time, by}` entries) doesn't correspond to anything in the schema. Synthesized a real, shorter timeline from the actual timestamped fields that do exist: submitted (`createdAt`), assigned (`vendor` + `updatedAt`), scheduled (`scheduledFor`), a vendor note (`vendorNotes`), completed (`completedAt`). Also dropped the mock's "Message Vendor" / "Add Photo" buttons — they had no `onClick` handler in the original component (pure decoration), so removing rather than wiring fake handlers.
- **`MaintenancePriority` has 4 real values** (`LOW/MEDIUM/HIGH/EMERGENCY`), the mock only modeled 3 — added `EMERGENCY` to the priority config.
- **Payment History table has no "Receipt" column or Export button anymore.** No PDF/receipt generation exists anywhere in the codebase (the mock's download buttons were `alert()` placeholders). Also dropped the year filter — doable from real dates, but decided the search+status filters already cover the real, currently-small dataset; not a hard blocker, easy to add back if it becomes needed.
- **Payment "period" label is synthesized** from `invoice.description` (when set) or `type + due-month/year`, since there's no dedicated period field on `Invoice`.
- **Payment status buckets (`completed`/`late`/`pending`/`upcoming`) are derived**: an invoice with a payment is `completed` if paid on/before its `dueDate`, else `late`; an invoice with no payment is `upcoming` if its due date hasn't passed yet, else `pending`. `CANCELLED` invoices are excluded entirely.
- **`NeighbourhoodReport` JSON shape is genuinely freeform** (`property.prisma`'s own comment says "however it was entered"). Live-querying the actual seeded data showed it does **not** match the mock's assumed shape at all — e.g. `security.features` is a flat `string[]`, not `[{name, available}]`; `electricity` uses `powerAvailabilityHours`/`gridType`, not the mock's `averageHoursPerDay`/`alternativePower`/`prepaidMeter`/etc. Rather than hardcode a field list that only fit the mock (and would render blank against real seeded properties), rewrote the electricity/road-network/flooding sections to generically render whatever primitive key-value pairs exist in each JSON blob, only special-casing the genuinely list-shaped fields (`features`, `historicalFlooding`, `mitigationMeasures`, amenity categories) that need custom list rendering.
- **Most seeded properties (2 of 4) have no neighbourhood report at all** — added an explicit empty state rather than assuming one always exists.
- **Premium/paywall gating stays 100% local `useState`**, unchanged from the mock. `Subscription` exists in the schema but CLAUDE.md is explicit that it's "not in the PRD... confirm with product before building" — not something to wire to a real entitlement check without that confirmation.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all routes present.
- Live-tested against the real dev server and seeded database as `tenant@proplity.com`:
  - `GET /leases?status=ACTIVE` returns the tenant's real lease with `unit.property` populated (Highland Park Residences, unit 4B).
  - `GET /invoices` returns 1 real RENT invoice with a real nested `payments[]` entry (₦3,500,000, `PSK_REF_202601019842`).
  - `GET /maintenance/requests` returns 1 real request with real `category` (Plumbing) and `vendor` (Apex Repairs & Plumbing) included.
  - `GET /access-codes?unitId=...` returns 2 real codes (one permanent, one guest with an expiry).
  - `GET /properties/[id]` confirmed the neighbourhood report's actual JSON shape differs from the mock's assumed shape (see judgment calls above) — caught before shipping, not after.
  - All 4 tenant routes (`/dashboard`, `/dashboard/tenant-maintenance`, `/dashboard/payment-history`, `/dashboard/neighbourhood-report`) render `200` with no server-side exception.
  - Re-verified the 3 extended backend routes as `manager@` and `vendor@proplity.com` — still correctly role-scoped, still `200`, nothing broken for the other 4 sub-phases that will depend on the same routes.
- **Not verified**: interactive browser click-through (pagination, filters, the "Pay Rent Online"/"Setup Auto-Pay" buttons which remain `alert()` placeholders — Paystack checkout wiring is out of scope for this sub-phase) — no browser-automation tool available in this environment, same caveat as every prior frontend phase.

## Next up

Sub-phase 3 — Manager/Landlord operational views (`Dashboard.tsx`, `DashboardBreakdownPage.tsx`, `LandlordDashboard.tsx`, `TenantManagement.tsx`, `TenantDetail.tsx`, `MaintenanceBoard.tsx`, `MaintenanceDetail.tsx`, `PropertyDetail.tsx`) — the largest and most aggregation-heavy group per `docs/development-history/phase-9-frontend-hydration-plan.md`.
