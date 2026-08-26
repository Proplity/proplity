# Phase: Domain API Phase 9, sub-phase 4 — Vendor-facing Views

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Fourth sub-phase of Phase 9. Covers the 2 components a vendor sees: `VendorDashboard.tsx`, `VendorJobDetail.tsx`. Both map onto `MaintenanceRequest` from the assigned-vendor's side — `GET /maintenance/requests` already scopes to `where.vendorId = session.sub` for the `VENDOR` role, so no new list-level backend work was needed; the detail route needed one small additive extension.

## Bug found and fixed (pre-existing, from sub-phase 3a)

While live-testing this sub-phase, `GET /maintenance/requests` (the **list** route) turned out to never have included `unit.property` or `tenant` — only `unit`, `category`, and `vendor` were included. This route was already hydrated into `MaintenanceBoard.tsx` and `TenantDetail.tsx` in sub-phase 3a, both of which reference `request.unit?.property?.name` and `request.tenant?.name`. Because sub-phase 3a's verification was `curl`-based SSR checks (no browser-automation tool available in this environment), the missing fields were silently rendering as the component's own `'—'`/`'Unknown tenant'` fallback text instead of surfacing as a build or runtime error — nothing crashed, so it went unnoticed until this sub-phase's `VendorDashboard.tsx` needed the same fields and a direct API check caught the gap. **Fixed**: added `unit: { include: { property: true } }` and `tenant: { select: { id, name } }` to the list route's include. Verified via direct `GET` calls (not just page-renders) that all 3 consumers (`MaintenanceBoard`, `TenantDetail`, and the new `VendorDashboard`) now receive real property/tenant names — this is now the standing verification bar for every remaining sub-phase, not just an SSR-200 check.

## Backend changes

- **`GET /api/v1/maintenance/requests`** (list) — bug fix above.
- **`GET /api/v1/maintenance/requests/[id]`** — extended the `unit.property` include to also include `manager: { select: id/name/phoneNumber/email }`, for `VendorJobDetail`'s "Property Manager" contact card (previously only `managerId` was available, no way to show contact details).
- **`PATCH /api/v1/maintenance/requests/[id]`** — added `vendorNotes` to the patch schema. It's a real column (`vendorNotes` already existed on `MaintenanceRequest`, populated by seed data, and already read by sub-phase 3a's `MaintenanceDetail` timeline) but had no write path anywhere. Two small additions: the existing `IN_PROGRESS` transition now optionally accepts `vendorNotes` alongside the status change, and a new standalone branch lets the assigned vendor update just `vendorNotes` with no status change (for adding a note without transitioning, e.g. a job already `IN_PROGRESS`).

## What was built

- **`lib/api/types.ts`** — added `Property.manager`, `UpdateMaintenanceRequestInput.vendorNotes`.
- **`VendorDashboard.tsx`** — replaced `mockVendorDashboardJobs` with `useMaintenanceRequests()` + `useInvoices()` + `useAuth()`.
- **`VendorJobDetail.tsx`** — `jobId: number` → `string`. Replaced `mockVendorJobs` with `useMaintenanceRequest(jobId)` + `useUpdateMaintenanceRequest(jobId)` + `useAccessCodes(job.unitId)` (real gate-code lookup for the unit, replacing a hardcoded fake "Gate code: #1234").
- **`app/dashboard/navigateToPage.ts`** — `vendor-job-detail`/`vendor-create-invoice`'s `jobId: number` → `string`.
- **`app/dashboard/vendor/jobs/[id]/page.tsx`** — dropped the `Number(id)` conversion.

## Real-vs-mock shape mismatches resolved (judgment calls)

- **"Accept Job"/"Decline" buttons dropped.** There's no `assignmentStatus`/acknowledgement concept anywhere — a vendor only ever appears in `GET /maintenance/requests` once a manager has already set `vendorId` via the triage PATCH (sub-phase 3a). By the time a vendor can see a job at all, it's already assigned; there's no real "pending offer" state to accept or decline.
- **Job status buckets changed from the mock's `assigned/in_progress/completed` to the real enum** `SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED` — `SUBMITTED` never appears in a vendor's own list (no vendor assigned yet means it can't match `vendorId = session.sub`).
- **Vendor rating/completion-rate computed client-side from the vendor's own scoped jobs**, not from `GET /vendors` (sub-phase 3a) — that endpoint is intentionally `MANAGER/LANDLORD/ADMIN`-only (it's the assign-vendor picker's data source), and broadening its role gate just so a vendor could read their own row wasn't worth the access-control surface increase when the same numbers are already derivable from data the vendor already legitimately has (their own `maintenanceRequests[].vendorRating`).
- **"On-Time Rate" is now a real computation**: among completed jobs that had a `scheduledFor` set, the % where `completedAt <= scheduledFor`. The mock hardcoded `98%`; jobs with no `scheduledFor` are excluded from the denominator rather than guessed at, and the stat shows "N/A" if no completed job ever had a schedule to compare against.
- **"Avg Response Time" and "Next Payout" dropped** — no timestamp exists anywhere for "vendor acknowledged/responded to assignment" (consistent with the Accept/Decline removal above), and there's no payout-scheduling concept in the schema at all.
- **Vendor profile card now shows the real logged-in vendor's name/initial** (`useAuth().user.name`) instead of the hardcoded "AquaFix Plumbers" — this was actively wrong before (every vendor, including `Apex Repairs & Plumbing`, would have seen "AquaFix Plumbers" on their own dashboard).
- **"Materials Used" section dropped entirely** — no line-items/materials model exists anywhere on `MaintenanceRequest`. Same reasoning as sub-phase 3a's decision to drop the manager-side "AI Classification" fabricated fields: don't invent a data model just to keep a UI section populated.
- **"Upload Photos" interactive dropzone + fake "Photo 1/2/3" placeholders replaced with real `mediaUrls` rendering** (empty in all 3 seeded requests) — matches the already-documented known gap ("maintenance image upload is display-only"), same treatment as sub-phase 2's `TenantMaintenanceRequests` and sub-phase 3a's `MaintenanceDetail`.
- **"Access Instructions" now shows a real gate access code** via `useAccessCodes(job.unitId)` (built in Phase 5, unused by any component until sub-phase 2) instead of the hardcoded "Gate code: #1234".
- **Status-update UI simplified to avoid a double-invoice risk**: the mock had 3 quick-status buttons (`In Progress`/`On Hold`/`Completed`) sitting right above the page's own separate "Mark Complete & Create Invoice" CTA. `MaintenanceStatus` has no `ON_HOLD` value, so that button was dropped outright. A quick "Completed" button was deliberately **not** added even though `PATCH .../[id]` supports it — that PATCH path auto-creates a `MAINTENANCE` invoice in the same transaction, and the existing "Mark Complete & Create Invoice" button (unchanged, real since Phase 7) routes to `VendorCreateInvoice`'s separate manual line-item invoice `POST`. Offering both real paths on the same page risked a vendor creating two invoices for one job. Only the safe, side-effect-free `IN_PROGRESS` transition got a quick-action button; completion stays exclusively behind the existing Phase-7 flow.
- **Flagged, not fixed (explicitly out of this sub-phase's scope)**: `VendorCreateInvoice.tsx`'s `handleSubmit` only `POST`s an invoice — it never `PATCH`es the maintenance request to `COMPLETED`. This means a job "completed" only via that form stays `IN_PROGRESS`/`SCHEDULED` forever in the data model (no `completedAt`, no `finalCost`), which would quietly undercount this same sub-phase's own `VendorDashboard` stats (`completedThisMonth`, `totalEarningsMTD`, on-time rate) for any job completed that way. This predates sub-phase 4 (the form itself is one of the 5 write-forms wired back in Phase 7) and `VendorCreateInvoice.tsx` was never in Phase 9's 20-component catalog, so redesigning its submit flow here would be scope creep beyond what this sub-phase asked for — noting it here rather than silently leaving it undocumented, since it directly affects the correctness of the stats this sub-phase just built.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors. `pnpm build` — succeeds.
- Live-tested against the real dev server and seeded database as `vendor@proplity.com` (Apex Repairs, owns 1 `IN_PROGRESS` job) and `aquafix@email.com` (AquaFix Plumbers, owns 1 `COMPLETED` job):
  - Confirmed the list-route bug fix directly via `GET /maintenance/requests` (not just page renders) for both vendor accounts and the manager account, across all 3 consumers.
  - Confirmed `GET /maintenance/requests/[id]` now returns `unit.property.manager` with real contact info (`Alex Vance (Manager)`, real phone/email).
  - **Exercised the new `vendorNotes` write path directly**: PATCHed real notes text onto a live job, confirmed the update round-tripped, then reset the field (the schema doesn't accept `null` for this string field, so it was reset to `''` rather than restored to its original `NULL` — functionally equivalent, since the UI's `if (vendorNotes)` check treats both as "no notes").
  - Both vendor accounts' `/dashboard` and `/dashboard/vendor/jobs/[id]` render `200` with no server-side exception.
- **Not verified**: interactive browser click-through (the notes textarea, the job-filter tabs) — no browser-automation tool available in this environment, same caveat as every prior frontend phase.

## Next up

Sub-phase 5 — Messaging: `MessagingPortal.tsx` — the one place a genuinely new hook (`useConversations`) needs building, since none of Phase 7's or Phase 9's hooks so far have covered Communications (`Conversation`/`Message`, Phase 6 of the domain-API roadmap).
