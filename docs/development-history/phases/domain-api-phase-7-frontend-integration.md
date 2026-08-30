# Phase: Domain API Phase 7 — Frontend Integration & State Hydration

**Status:** Complete, with one caveat on verification depth (see "What's verified vs. what isn't" below). **Date:** 2026-08-22.

## Why

First phase wiring the real backend (Phases 0–6) into the actual UI instead of just proving the routes work via `curl`. The original plan left this phase deliberately high-level ("scoped once Phases 1–6 exist"); a full plan was written to `docs/development-history/phase-7-frontend-integration-plan.md` before implementation, per this project's standing convention for non-trivial phases.

## What was built

### Step 0 — Invite/verification infrastructure (added mid-plan, user-approved)

Research surfaced that `AddTenantForm`'s UI ("An invitation has been sent to the tenant") had no backing capability anywhere in the 6 built phases — `POST /leases` requires an existing `tenantId`, and there's no invite-a-new-user-by-email endpoint. Asked the user how to handle it rather than guessing; approved approach: build a minimal invite flow now, with a **console-transport email** (log the content server-side) instead of a real provider.

- **`lib/email.ts`** — `sendEmail({ to, subject, body })`, console-logs instead of delivering. Swapping in a real provider later means replacing only this function.
- **`app/api/v1/leases/route.ts` POST (extended)** — now accepts `tenantId` **or** `tenantEmail`+`tenantName`(+`tenantPhone`). Matching email → reuses that existing `TENANT` (never merges into a still-pending account, only ever links a verified, `ACTIVE` one). No match → creates a `PENDING_VERIFICATION` user with an unusable random password, a `VerificationToken`, and console-"emails" a verify link. Response now includes `tenantInvited: boolean` so the caller knows which path was taken.
- **`app/api/v1/auth/verify-email/route.ts` (extended)** — accepts an optional `password` alongside `token`; when present, hashes and stores it in the same transaction that flips `status` to `ACTIVE`. Backward compatible.
- **`app/verify-email/page.tsx` (new)** — no frontend page existed for this at all before now (API-only). Reads `?token=`, collects password + confirmation, calls the extended route, redirects to `/` on success.

`login`'s pre-existing `PENDING_VERIFICATION` → `403` check needed no changes — it already keeps an invited-but-unverified tenant out until they complete the link.

### Step 1 — `lib/apiClient.ts` + `lib/api/types.ts`

Domain-grouped typed methods (`api.properties.*`, `api.maintenance.*`, `api.leases.*`, `api.invoices.*`, `api.accessCodes.*`) added on top of the existing `apiClient` axios instance — its 401-refresh interceptor (the thing Phase 0-pre's known-bug fix depends on) is untouched. Hand-written types in `lib/api/types.ts` matching each route's actual Zod/response shape (no codegen in this repo).

### Step 2 — 5 hooks + 1 shared helper

`hooks/useApiSubmit.ts` — shared `{ submit, submitting, error }` shape, avoiding re-deriving the same 3 lines of state 5 times. Then, exactly the 5 files the plan named:

- **`hooks/useProperties.ts`** — `useProperties()`, `useUnits(propertyId, status)`, `useCreateProperty()`, `useCreateUnit()`, `useCreateViewing()`.
- **`hooks/useMaintenanceRequests.ts`** — `useMaintenanceCategories()`, `useCreateMaintenanceRequest()`.
- **`hooks/useLeases.ts`** — `useCreateLease()`, `useActiveLease()` (the logged-in tenant's own active lease — used to thread a real `unitId` into `MaintenanceRequestForm`, which never had one before).
- **`hooks/useInvoices.ts`** — `useCreateInvoice()`.
- **`hooks/useAccessCodes.ts`** — `useAccessCodes()`, `useCreateAccessCode()` — built per the plan's explicit list, **not wired to any form this phase** (no access-code UI exists in the mock app yet).

### Step 3 — All 5 forms wired to real data

- **`MaintenanceRequestForm.tsx`** — category buttons now resolve to a real `MaintenanceCategory` id by name (falls back gracefully if unmatched); `unitId` threaded from `useActiveLease()`; submits to `POST /maintenance/requests`. Image upload stays a local-only display list — no file-storage endpoint exists in any phase, noted as a known gap, not silently dropped.
- **`ScheduleViewing.tsx`** — `propertyId` prop is now `string`; date + time-slot label combined into one `scheduledAt` via a real label parser (`slotToHour`, handles every slot in the mock data, not a lookup table that could miss one); submits to `POST /properties/[id]/viewings`.
- **`ListProperty.tsx`** — submits `POST /properties` then `POST /properties/[id]/units` in sequence; `PropertyType` has no subtype field for things like "Duplex"/"Bungalow", folded into the generated listing name instead of silently lost.
- **`VendorCreateInvoice.tsx`** — `jobId` prop is now `string` (`maintenanceRequestId`); line items collapsed into a single `amount` (schema has no line-item model) with the itemized breakdown rendered into `description` text so it isn't lost; submits to `POST /invoices`.
- **`AddTenantForm.tsx`** — the most substantial rewrite: replaced the mock flat "available units" list with a real two-step picker (pick a property via `useProperties()`, then pick one of its real `VACANT` units via `useUnits()`, auto-selected if there's exactly one); submits `tenantEmail`/`tenantName`/`tenantPhone` to the extended `POST /leases`, which transparently decides invite-vs-reuse server-side.

### Step 4 — Wrapper pages

All 5 `page.tsx` files updated: dropped `Number(id)` conversions (every mock id was a `number`, every real id is a UUID `string`), pass real ids, removed a now-redundant duplicate success `alert()` in `tenants/add/page.tsx` (the form itself now shows an accurate invited-vs-linked message).

## What's verified vs. what isn't

- **`pnpm exec tsc --noEmit`** — 0 errors, throughout.
- **`pnpm build`** — succeeds; all touched/new routes (`/verify-email` plus the 5 wrapper pages) listed correctly.
- **The new backend invite/verify logic — fully live-tested end to end**, including the exact sequence a real user would go through: `POST /leases` with `tenantEmail` for a brand-new address → `201`, `tenantInvited: true`, confirmed the console-"email" was actually logged with a real token; confirmed the new user is `PENDING_VERIFICATION` and login is rejected; `POST /verify-email` with `{ token, password }` → `200`; confirmed login with the new password now succeeds (`200`, real session). Also confirmed: reusing an existing `ACTIVE` tenant by email → `tenantInvited: false`, correct `tenantId` reused; an existing non-`TENANT` email → `400`; a replayed (already-consumed) verification token → `400`.
- **SSR-safety of every touched page** — confirmed via `curl` (authenticated where needed) that `/verify-email` (with and without a token), and all 5 dashboard wrapper pages, return `200` and render without a server-side exception.
- **Not verified: interactive browser click-through.** No browser-automation tool is available in this environment, so the actual UI flows (filling in each form, clicking through multi-step wizards, watching the real-time property/unit picker in `AddTenantForm`, confirming success/error banners render as designed) were **not** exercised through a real browser. Per this project's own verification standard ("if you can't test the UI, say so explicitly rather than claiming success") — this is flagged rather than assumed. Everything the forms *call* (the backend routes, the new invite/verify logic) is real and tested; what's unverified is specifically the client-side wiring — state updates, conditional rendering, the multi-step navigation — actually working as written when a person interacts with it in a browser.

## Known gaps, not built here

- No file-storage endpoint exists anywhere → `MaintenanceRequestForm`'s image upload stays local-only, `mediaUrls` always submitted empty.
- `ListProperty` has no home for granular property subtypes (Duplex, Bungalow, etc.) beyond the 4-value `PropertyType` enum — folded into the generated name string.
- `hooks/useAccessCodes.ts` is built but unused — no access-code UI exists in the app yet.
- Creating/activating a lease still doesn't touch `Unit.status` (the gap flagged back in Phase 3) — a newly tenanted unit stays `VACANT` in the data model.

## Recommended next step before shipping

A manual browser pass through all 5 forms (log in as the relevant demo role, actually click through each flow) — the one verification layer this phase couldn't reach.

## Next up

Phase 8 — Background Workers & Cron Jobs (Rent Invoicer, Overdue Flagger, Maintenance Schedule Dispatcher, Access Code Expiry Janitor, Payment Reliability Scorer) — not started here.
