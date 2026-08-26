# Component completeness audit & fixes

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

User request: "go through each and every component ... make sure that everything is complete, no dummy data and loading is properly placed." Not tied to a roadmap phase — a direct completeness audit of all 37 `app/components/*.tsx` files and their 21 `app/dashboard`/`app/admin` page wrappers, prompted after the pasted third-party analysis review surfaced two real issues (`ScheduleViewing.tsx`'s hardcoded viewing slots, `VendorCreateInvoice.tsx`'s hardcoded vendor/job header) that weren't part of that analysis's own punch list.

## What was audited

Every component and page wrapper, dispatched across parallel background agents (one stalled twice on a large batch and was finished by direct reading instead) plus direct reading for the two components already known to have issues. Checked for: (1) leftover mock/dummy data presented as real, (2) loading states that don't actually gate rendering (stale project convention: `{loading && <p>...</p>}` as an *extra* line rather than a real gate, so stat cards/tables render `₦0`/`0`/empty before the real fetch resolves — the same root-cause shape as the dashboard-flash bug fixed earlier this session), (3) dead buttons / dropped form fields / misleading copy.

Full findings delivered to the user as a severity-ranked list before any fix was made. User chose (via `AskUserQuestion`): fix all wiring/UI bugs now; leave the 4 findings that have **no backend at all** as a follow-up punch list rather than building new schema+API for them in the same pass.

## What was fixed

**Real backend wired up for the first time** — `POST /api/v1/payments/initialize` (a fully-built, fully-tested Paystack endpoint per CLAUDE.md) had **zero frontend callers anywhere in the app**. Added `api.payments.initialize()` (`lib/apiClient.ts`), `usePayInvoice()` (`hooks/useInvoices.ts`), and wired `TenantDashboard.tsx`'s "Pay Rent Online" button to call it and redirect to the real Paystack authorization URL. "Setup Auto-Pay" was left as an honest not-available stub — `AutoPayMandate` creation requires a Paystack card-authorization token that no UI flow in the app captures; faking one would create a broken mandate row, not a real fix.

**Systemic loading-gate fix** — 9 components (`Dashboard`, `AdminDashboard`, `DashboardBreakdownPage`, `AdminBreakdownPage`, `AdminReports`, `MaintenanceBoard`, `TenantPaymentHistory`, `LandlordDashboard`, `VendorDashboard`) had a `loading` flag correctly computed from their hooks but never used to gate the numbers actually shown — every stat card and hero figure now renders `—` instead of `0`/`₦0` while its real fetch is in flight. `LandlordDashboard`/`VendorDashboard` were also missing loading flags for some of their hooks entirely (only tracked one of several).

**Real bugs, not just polish:**
- `app/dashboard/properties/[id]/apply/page.tsx` looked up the property via `mockProperties.find(p => p.id === Number(id))` — `id` is a Prisma cuid, so `Number(id)` was always `NaN` and the property title/price were blank for every property, always. Replaced with the real `useProperty(id)` hook; `PropertyApplicationForm`'s `propertyId` prop type was also `number` (a pre-migration leftover) and is now `string`.
- `ListProperty.tsx` collected amenities and utilities in its form but never sent either to the backend, even though the units API accepts `amenities`. Now sends `amenities` for real (added to `CreateUnitInput`); `utilities` has no schema column anywhere, so — matching the existing codebase convention for fields with no dedicated home (`MaintenanceRequestForm`'s location note) — it's folded into the property description text instead of silently dropped.
- `AdminReports.tsx`'s period selector (Last 30 Days / 3 Months / 6 Months / This Year / Last Year) changed only the displayed label; every chart was hardcoded to a fixed 6-month window. Replaced `last6Months()` with a real `monthsForPeriod(period)` and made every chart/table/label period-aware. The "Refresh" button had no handler; now calls `refetch()` on all 4 underlying hooks (added `refetch` to `useAdminUsers`, which was the one hook in the app missing it).
- `MaintenanceRequestForm.tsx`'s "AI-Powered Assistance" notice promised the app would "automatically categorize your request, estimate the cost, and assign the best vendor" — no such automation exists anywhere in the codebase (categorization is the tenant's own button click; cost/vendor assignment is 100% manager-driven). Copy rewritten to describe what actually happens.

**Dead buttons made real or honest:**
- `PropertyDiscovery.tsx`'s "Schedule Tour" now navigates to the real, already-working `ScheduleViewing` flow instead of an `alert()`.
- `VendorDashboard.tsx`'s "View Details" card button had no handler (the card itself did) — now navigates properly.
- `TenantDetail.tsx` / `TenantManagement.tsx`: "Call"/"Email"/"WhatsApp" now use real `tel:`/`mailto:`/`wa.me` links instead of `alert()` placeholders or doing nothing.
- Buttons with genuinely no feature behind them yet (`LandlordDashboard`'s Download Report/Schedule Review, `TenantDetail`'s Renew Lease/Send Notice/Send Invoice, `AddTenantForm`'s document uploads, `ListProperty`'s media uploads) were left unbuilt but changed from either silent no-ops or fake-progress alerts ("Generating financial report...") to honest "not available yet" messages — matching the pattern `AdminDashboard.tsx` already used correctly for its own unbuilt Security/Database/Settings actions.
- `VendorCreateInvoice.tsx`'s "Save as Draft" button was removed outright — `Invoice` has no draft status in the schema, so it could never be made to do anything real.
- `LandlordDashboard.tsx`'s "Analytics" quick action now navigates to the real rent-breakdown page (which has genuine charts) instead of an `alert()`.

**Checked but deliberately left alone**, to avoid introducing a new bug: `VendorCreateInvoice.tsx` never marking its maintenance request `COMPLETED` looked fixable by adding a PATCH call, but the PATCH-to-`COMPLETED` route already auto-creates the job's invoice in the same transaction — calling it *in addition to* `VendorCreateInvoice`'s own `POST /invoices` would create two invoices for the same job. Confirmed this is the same gap CLAUDE.md already documents as deliberately out of scope, not something to patch blindly.

## Deliberately deferred (no backend exists — flagged to the user, not built)

Per the user's explicit choice: these 4 stay as-is, follow-up work, not touched this pass:
- `Checkout.tsx` — fakes payment success via `setTimeout`; no real subscription/billing API exists (`Subscription` model itself isn't confirmed in the PRD per CLAUDE.md).
- `PropertyApplicationForm.tsx` — fakes submission via `setTimeout`; no `Application` model exists anywhere in the schema.
- `LandlordDashboard.tsx`'s "Manager Access Codes" — pure local `useState`, no landlord-manager linking model exists.
- `PropertyDiscovery.tsx`'s "Create Ad" — pure local `useState`, no ad/campaign model exists.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 8 files, 126/126 passing (no regressions from any of the above changes).
- No browser-automation tool available in this environment (same caveat as every prior frontend phase) — changes were reasoned through against the real, already-tested API contracts (`lib/apiClient.ts`, `lib/api/types.ts`, the route handlers themselves) rather than clicked through live.

## What's next

The 4 deferred fake-flow items above, plus everything already tracked in Finding 4 (`out/next-phase-analysis.md`): real Paystack test-mode key, real email provider, cron scheduling decision, `Unit.status`/`AccessCode.USED` gaps.
