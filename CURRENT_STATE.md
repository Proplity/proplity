# 📊 Proplity — Current Project & Codebase State

> **Last Updated:** 2026-10-04
> **Status:** Full domain-API roadmap complete (Phase 0-pre through Phase 8), plus Phase 9 frontend read-path hydration and Phase 10's automated test suite | The UI/UX gap audit below is complete (all dead `alert()` stubs wired or honestly explained); next up is the Finding-4 punch list — see `docs/development-history/next-phase-analysis.md`

---

## 🎯 Executive Snapshot

| Subsystem                     |  Completion   | Status Summary                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | :-----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database & Schema**         |   **100%**    | 40 Prisma models across 10 modular schema files; 15 migrations; seeded via `prisma/seed.ts` / `seed2.ts`.                                                                                                                                                                                                                                                                                                                         |
| **Authentication & Security** |   **100%**    | 10 REST endpoints `/api/v1/auth/*`, Edge JWT (15 min) + opaque refresh tokens (30 days remember-me / 1 day), CSRF, atomic advisory-lock rate limiting, last-hop client-IP, logout revokes refresh tokens even for an expired access token, email-verified self-registration, `proxy.ts` edge guard, Axios interceptor, `AuthContext`. Hardened after the 2026-09-30 independent review (`docs/auth-review-2026-09-30.md`).        |
| **Domain REST APIs**          |   **100%**    | 73 route handlers under `/api/v1`: properties (+units, reviews, viewings, ads, announcements, equipment, violations, condition reports, moderation, CSV/XLSX import-export), maintenance, leases (+notices, notes, e-signature), invoices, payments (initialize, webhook, autopay, authorization), applications, manager-codes, bank-accounts, conversations, notifications, subscriptions, uploads, vendors, admin, cron, setup. |
| **Background Workers**        | **Scheduled** | 5 idempotent workers (rent invoicer incl. the recurring service-charge line, overdue flagger, maintenance dispatcher, access-code janitor, payment-reliability scorer). `vercel.json` runs `/api/v1/cron/all` daily at 02:00, fanning out to all 5 in dependency order; also triggerable via `POST /api/v1/cron/[job]` or `scripts/workers/*.ts`.                                                                                 |
| **Frontend UI Views**         |   **100%**    | Every dashboard/detail component reads real data through the hook files in `hooks/` and the typed `api.*` client; every form is wired to a real API; the UI/UX gap audit removed every dead `alert()` stub. Only 3 marketing pages (`LandlordFeaturePage`, `TenantFeaturePage`, `ServiceProviderFeaturePage`) and `AIAssistant.tsx` still read `app/store/*` — deliberately out of scope.                                         |
| **Paystack Integration**      |   **Built**   | Checkout init, HMAC-SHA512 webhook, auto-pay mandates + reusable-authorization lookup. Webhook live-tested (self-signed key) and exercised end to end by the mock gateway (`NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`, `/dev/mock-checkout`). `/payments/initialize`'s call to Paystack's live API has never run — no real test-mode key yet. No cron charges auto-pay mandates yet.                                                     |
| **Email**                     |   **Built**   | Resend delivery when `RESEND_API_KEY` is set, console-transport otherwise (plus an opt-in in-app "Sent Emails" widget for testers). Used by self-registration verification, password reset, resend-verification, tenant invites, viewing confirmations and moderation outcomes.                                                                                                                                                   |
| **File uploads**              |   **Built**   | Signed direct-to-Cloudinary uploads (`maintenance-requests`, `applications`, `profile`, `properties` folders); "not available" fallback UI when unconfigured.                                                                                                                                                                                                                                                                     |
| **Automated Tests**           |   **100%**    | Vitest: 247 tests across 15 files in `tests/api/` (`pnpm test`), real HTTP against a spawned `next dev` + a dedicated `proplity_test_db`. Playwright: 36 tests in `tests/e2e/` (`pnpm test:e2e`) — smoke, per-role flows, session restore, mock payment, responsive nav. Both run in CI on every PR (`Typecheck, format & build`, `Integration tests`, `E2E (Playwright)`).                                                       |

---

## 🔍 Detailed Subsystem Breakdown

### 1. 🗄️ Database & Prisma ORM (`prisma/`) — **READY**

- **Architecture**: Modular Prisma schema layout (`prisma/schema/`, 10 files: `audit`, `auth`, `base`, `communication`, `financial`, `lease`, `notification`, `operations`, `property`, `system`) — 40 models. See `CLAUDE.md` for the file-by-file table and exact enum values.
- **Database**: PostgreSQL 18, Prisma ORM v7 with the `@prisma/adapter-pg` driver adapter. Local dev DB name and credentials are whatever your `.env` says (`.env.example` is the template); the test suite uses its own `proplity_test_db`.
- **Migrations** (15, in `prisma/migrations/`): `init_domain_schema`, `sync_schema_drift`, applications / manager codes / ad campaigns, lease late-fee type + flat amount, access-code single-use, lease signature, `init` (re-baseline), password-reset token, notifications, system settings, `settings_auto_complete_invoice`, `add_service_charge` (2026-09-28), `tenant_profile_fields` and `tenant_year_of_birth` (2026-09-28).
- **Seed Scripts**:
  - `prisma/seed.ts` (`pnpm db:seed`): clean standard seed (1 property, 5 core demo users, 1 lease, 1 invoice).
  - `prisma/seed2.ts` (`pnpm db:seed2`): enriched multi-property seed (properties across Lekki/VI/Yaba, 9 users, units, leases, gate access codes with audit logs, verified reviews, neighbourhood reports, invoices). E2E and most manual verification run against this.
- **Row counts** are deliberately not tracked here any more — they drift with every verification run. Read them from the database.

---

### 2. 🔐 Authentication & Session Layer (`app/api/v1/auth/`, `lib/auth/`, `context/`) — **COMPLETE**

- **Routes (10)**: `login`, `logout`, `refresh`, `register`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`, `me` (GET + PATCH).
- **JWT & Tokens**: 15-minute Edge-compatible access tokens (`jose`) + opaque refresh tokens hashed in `RefreshToken` with `familyId` rotation and reuse detection. Lifetime is **30 days** with `rememberMe` (default) or **1 day** without; rotation inherits the original expiry.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, path-scoped (`access_token` at `/`, `refresh_token` at `/api/v1/auth/refresh`).
- **Guards**: CSRF header verification (`lib/auth/csrf.ts`, exempting only `verify-email` and `reset-password`; a malformed `Origin` fails closed), DB-backed rate limiting (`lib/auth/rateLimit.ts` — atomic `reserveAttempt`/`releaseAttempt` under a Postgres advisory lock; `REFRESH_MAX_ATTEMPTS = 30` for the periodic refresh call; `getClientIp()` trusts the last `x-forwarded-for` hop), `getServerSession()` for server components, and a live `proxy.ts` edge guard on `/dashboard/*` and `/admin/*` (Next 16 renamed `middleware.ts` → `proxy.ts`).
- **Logout** revokes every active refresh token for the user by decoding the access token with `getExpiredSession()` (tolerates expiry, still verifies the signature) — the refresh cookie is path-scoped and never reaches `/logout`.
- **Registration**: self-registration creates a `PENDING_VERIFICATION` account and emails a verification link; `login` refuses that status until verified. Self-registerable roles: `TENANT`, `LANDLORD`, `MANAGER` (needs a landlord invite code), `VENDOR`; never `ADMIN`. Tenant invites (`POST /api/v1/leases` with `tenantEmail`/`tenantName`) reuse the same verification page, which also lets the invitee set a password.
- **First-run setup**: `/setup` + `POST /api/v1/setup` bootstrap the first `ADMIN`, then disable themselves (`SystemSettings.setupComplete`).
- **Client Integration**: `lib/apiClient.ts` (Axios, single-flight 401-refresh dedup, domain-grouped typed `api.*` client), `context/AuthContext.tsx`, `hooks/useAuthRefresh.ts` (13-min proactive timer), `lib/safeRedirect.ts` (open-redirect guard for `?from=`), demo-login buttons gated to non-production.
- **Independent review** (2026-09-30, `docs/auth-review-2026-09-30.md`): all four findings fixed — see `docs/development-history/phases/auth-review-hardening.md`.

---

### 3. ⚙️ Domain REST APIs (`app/api/v1/`) — **COMPLETE, LIVE-TESTED**

73 route handlers. The original 36 were built phase-by-phase, each verified against the real dev server and seeded database (RBAC boundaries, business-rule enforcement, cleanup of test data), with a writeup per phase in `docs/development-history/phases/`; everything added since is covered by the later phase docs and the changelog below.

| Group                 | Routes                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth (10)             | `auth/{login,logout,refresh,register,verify-email,resend-verification,forgot-password,reset-password,change-password,me}`                                                                                                                                                                                                    |
| Properties & units    | `properties`, `properties/export`, `properties/[id]`, `.../units`, `.../units/import`, `.../units/[unitId]`, `.../units/[unitId]/{condition-reports,violations,violations/[violationId]}`, `.../{reviews,viewings,neighbourhood-report,moderation,announcements,announcements/[id],equipment,equipment/[id],ads,ads/[adId]}` |
| Maintenance           | `maintenance/{categories,requests,requests/[id],requests/[id]/rating,schedules}`                                                                                                                                                                                                                                             |
| Leases & tenancy      | `leases`, `leases/[id]`, `leases/[id]/{notices,notes,sign}`, `applications`, `applications/[id]`                                                                                                                                                                                                                             |
| Financial             | `invoices`, `invoices/[id]`, `payments/{initialize,webhook,autopay,authorization}`, `bank-accounts`, `bank-accounts/[id]`, `subscriptions/{checkout,me}`                                                                                                                                                                     |
| Access control        | `access-codes`, `access-codes/[id]`, `access-codes/verify`                                                                                                                                                                                                                                                                   |
| Communications        | `conversations`, `conversations/[id]/messages`, `notifications`, `notifications/[id]`, `notifications/mark-all-read`                                                                                                                                                                                                         |
| People & admin        | `vendors`, `manager-codes` (+`check`, `redeem`, `[id]`), `admin/{users,settings,audit-logs}`                                                                                                                                                                                                                                 |
| Platform              | `cron/[job]`, `setup`, `uploads/sign`, `health`                                                                                                                                                                                                                                                                              |
| Dev-only (flag-gated) | `dev/emails` (`NEXT_PUBLIC_EMAIL_INBOX_ENABLED`), `dev/mock-checkout/complete` (`NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`)                                                                                                                                                                                                         |

Per-phase docs for the original 36: Phase 0 shared infra, 1 properties, 2 maintenance, 3 leases, 4 financial, 5 access control, 6 communications, 7 frontend integration, 8 background workers, 9 (six sub-phases) frontend hydration, 10 (eight sub-phases) automated tests — all under `docs/development-history/phases/`.

---

### 4. ⏱️ Background Workers (`lib/workers/`, `scripts/workers/`) — **BUILT AND SCHEDULED**

Five idempotent workers, each with real logic against the schema, invoked from `/api/v1/cron/[job]` (guarded by `CRON_SECRET`) or a standalone `pnpm exec tsx scripts/workers/*.ts`. In production `vercel.json` schedules **one** daily job (`/api/v1/cron/all`, 02:00) that fans out to all five in dependency order — Vercel's Hobby plan allows only two daily crons. The route accepts `GET` + `Authorization: Bearer` (what Vercel Cron sends) and `POST` + `x-cron-secret`. See `DEPLOYMENT.md` §4.

- **Rent Invoicer** — generates the next cycle's `RENT` invoice per `ACTIVE` lease (plus a separate `SERVICE_CHARGE` invoice when the lease has a service charge); advances one cycle per run when behind.
- **Overdue Flagger** — `UNPAID` + past-due → `OVERDUE`, one `PAYMENT_REMINDER` notice per invoice.
- **Maintenance Schedule Dispatcher** — due schedules generate a `MaintenanceRequest`, attributed to the unit's active tenant.
- **Access Code Expiry Janitor** — `ACTIVE` + past `validUntil` → `EXPIRED`.
- **Payment Reliability Scorer** — writes `Lease.paymentReliability`/`riskScore` via a documented heuristic (not real ML — no formula exists in the PRD).

**Not built**: a worker that charges `AutoPayMandate`s each cycle.

---

### 5. 🎨 Frontend Views (`app/components/`, `app/dashboard/`, `app/admin/`) — **100% WIRED**

- **Hydrated for display (Phase 9)**: every dashboard (`AdminDashboard`, `Dashboard`, `LandlordDashboard`, `TenantDashboard`, `VendorDashboard`), every breakdown/report page, property discovery/detail, maintenance board/detail, tenant management/detail/payment history, messaging, neighbourhood report and vendor job views read real data through the hook files in `hooks/` (24 today, built on the shared `useApiSubmit.ts`) and the typed `api.*` client. Where mock data was fabricated at a scale the real database can't back, the real view shows real small numbers and drops the unbackable section rather than inventing figures.
- **Write forms wired to real APIs**: `MaintenanceRequestForm`, `ScheduleViewing`, `ListProperty` (multi-unit, service charge, real media upload), `VendorCreateInvoice`, `AddTenantForm` (incl. tenant-invite flow and service charge), `PropertyApplicationForm` (3 steps, gated on a complete tenant profile — `CompleteProfileForm` at `/dashboard/profile/complete`), `AccountSettings`, plus Renew Lease / Send Notice / Send Invoice in `TenantDetail` and Setup Auto-Pay in `TenantDashboard`.
- **Role-scoped navigation**: `app/dashboard/DashboardChrome.tsx` (managers get "My Properties", tenants get "My Rentals", placed after the first three tabs so `MobileTabBar`'s primary-three assumption holds) and `app/admin/AdminChrome.tsx` (Overview, Properties moderation queue, User Management, Reports, Security audit log, Platform Settings). Mobile: floating bottom tab bar + avatar menu; admin sidebar drawer.
- **Still on mock data, deliberately out of scope**: `AIAssistant.tsx` and the 3 marketing `*FeaturePage.tsx` components — no AI capability or marketing-analytics backing exists in the schema.
- **Dev/test aids**: `app/dev/mock-checkout` (fake Paystack page that fires a properly-signed webhook), `app/components/dev/EmailInboxWidget.tsx` (floating "Sent Emails" button). Both are off unless their `NEXT_PUBLIC_*` flag is `"true"`; never enable on a real deployment.

---

### 6. 🧪 Automated Tests (`tests/`) — **100% COMPLETE**

- **Vitest — 247 tests across 15 files** (`tests/api/`: `auth`, `properties`, `maintenance`, `leases`, `financial`, `access-control`, `communications`, `vendors-and-admin`, `deferred-flows`, `orphaned-models`, `csv-excel-import-export`, `e-signature`, `notifications`, `setup`, `health`). Run with `pnpm test`.
- **Architecture**: real HTTP (`fetch`) against a real spawned `next dev` server, not direct handler imports — `getServerSession()` needs a real Next.js request context. `tests/setup/globalSetup.ts` drops and recreates a dedicated `proplity_test_db` and runs `prisma migrate deploy` before spawning the server, once per run. Configure via `.env.test` (gitignored; template `.env.test.example`) — never the same database as `.env`.
- **A real Next 16 constraint worked around**: one `next dev` per `distDir` — the test server sets `NEXT_TEST_DIST_DIR=.next-test` so it runs alongside a developer's own `pnpm dev`.
- **Fixtures** (`tests/helpers/fixtures.ts`) write directly via a test-only Prisma client, never through the API; `resetDb()` truncates every table per file, discovered dynamically. `authCookie(userId, role)` mints a real JWT bypassing login; `expiredAccessCookie()` mints an expired one for the logout-revocation test; `fillRateLimit` seeds `LoginAttempt` rows directly.
- **Playwright — 36 tests** (`tests/e2e/`, `pnpm test:e2e`): `smoke/` (marketing, auth forms), `flows/` (tenant, landlord, vendor, admin, login, session restore, featured properties, public-property CTA auth-awareness, dev email widget, mock payment), `responsive/` (mobile tab bar).
- **CI** (`.github/workflows/ci.yml`): three jobs on every push/PR to `dev`, `main` or `prod` — `Typecheck, format & build`, `Integration tests` (`postgres:18` service container), `E2E (Playwright)` (production build + seeded Postgres, one worker).
- **Deliberately not covered**: `/payments/initialize`'s live Paystack call, real Cloudinary uploads, and recurring auto-charging (not built).

---

## 🔑 Crucial Architectural & Business Rules

The full list lives in `CLAUDE.md` ("Non-negotiable rules," 12 entries, plus "Auth architecture," "Known gaps" and "Deliberately deferred"). Highlights:

1. **Access Code Deletion Safety** — never `prisma.accessCode.delete()`; always soft-revoke (`status: 'REVOKED', revokedAt: new Date()`).
2. **Verified Reviews FK Provenance** — `PropertyReview.leaseId IS NOT NULL`, set once at creation, never re-checked.
3. **Database-Level Invoice Number Generation** — `Invoice.invoiceNumber` is `dbgenerated`, never app-generated.
4. **Dynamic Metric Computation** — vendor reputation computed at query time (`AVG(VendorRating.rating)`), never cached.
5. **Unit-Level Property Price Filtering** — `Property` has no price column; filters go through `Unit.rentAmount`.
6. **Renewals are `Notice`, not a `LeaseStatus`** — no `PENDING_RENEWAL` value exists.
7. **`Lease.rentAmount` is per payment cycle, never multiplied by 12.**

---

## 👤 Seeded Test Accounts

All accounts seeded via `prisma/seed.ts` and `prisma/seed2.ts` share the default development password:
🔑 **`Password123!`**

| Role         | Email                       | Name / Entity               |
| ------------ | --------------------------- | --------------------------- |
| **ADMIN**    | `admin@proplity.com`        | System Admin                |
| **MANAGER**  | `manager@proplity.com`      | Alex Vance (Manager)        |
| **LANDLORD** | `landlord@proplity.com`     | Eleanor Sterling (Landlord) |
| **TENANT**   | `tenant@proplity.com`       | Jordan Hayes (Tenant)       |
| **TENANT**   | `adewale.j@email.com`       | Adewale Johnson             |
| **TENANT**   | `tunde@email.com`           | Tunde Bakare                |
| **VENDOR**   | `vendor@proplity.com`       | Apex Repairs & Plumbing     |
| **VENDOR**   | `john.electrical@email.com` | John Electricals            |
| **VENDOR**   | `aquafix@email.com`         | AquaFix Plumbers            |

---

## 🚀 How to Run & Verify

```bash
# 1. Start local dev server (App on http://localhost:3000)
pnpm dev

# 2. Seed the database (enriched dataset)
pnpm db:seed2

# 3. Type check + formatting (both enforced by CI)
pnpm typecheck
pnpm format:check

# 4. Production build check
pnpm build

# 5. Run a background worker manually (needs CRON_SECRET in .env)
pnpm exec tsx scripts/workers/rentInvoicer.ts
# or: curl -X POST localhost:3000/api/v1/cron/rent-invoicer -H "x-cron-secret: $CRON_SECRET"

# 6. API test suite (needs .env.test -- copy .env.test.example first)
pnpm test

# 7. UI test suite (needs a seeded DB and a running app; set E2E_BASE_URL)
pnpm test:e2e
```

To try rent payment without a Paystack key, set `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED="true"` (and leave `PAYSTACK_SECRET_KEY` unset); to read verification/reset emails without a provider, set `NEXT_PUBLIC_EMAIL_INBOX_ENABLED="true"`. Both are `NEXT_PUBLIC_*`, so restart/rebuild after changing them.

---

## 🩹 UI/UX Gap Audit (2026-09-28 → 2026-10-01, **complete**)

A full pass over every role's flow (add/manage/acquire/renew properties) surfaced a punch list of dead-end buttons, missing nav entries, and one real focus-loss bug. Confirmed against the code (not guessed), then worked through incrementally — see [[proplity-uiux-gap-audit]] in this session's memory for the full evidence trail and agreed designs on the larger items.

**Fixed (every item on the original punch list, plus the auth-review findings handled alongside it):**

- **"Renew Lease" wired up** (`TenantDetail.tsx`) — the renewal backend was already fully built (`PATCH /api/v1/leases/[id]` with a `renew` payload creates a new `ACTIVE` lease linked via `renewedFromId` and expires the old one), but nothing called it. Added `api.leases.renew`, `useRenewLease`, and an inline form (new dates/rent/deposit, defaulting to a same-length term after the current lease ends) that replaces the old `alert()` stub and navigates to the new lease's detail page on success.
- **"Send Notice" and "Send Invoice" wired up** (`TenantDetail.tsx`) — both backends were already fully built and unused from the frontend: `POST /api/v1/leases/[id]/notices` (type/content/status, DRAFT→SENT) had no API client method, hook, or caller at all; `POST /api/v1/invoices` (already used elsewhere for maintenance invoicing) had `useCreateInvoice` but no caller here. Added `api.leases.notices.create`, `useCreateNotice`, and a `Notice`/`CreateNoticeInput` type for the former; added an inline form for each (notice type + message; invoice type/amount/due date/description) replacing both `alert()` stubs. Also added the missing `SERVICE_CHARGE` value to `CreateInvoiceInput['type']`, which the Prisma enum already had but the frontend type didn't.
- `Register.tsx` — the password input lost focus on every keystroke (a `PasswordField` sub-component was declared inside the parent's render body, giving React a new function identity — and therefore a remount — every render). Hoisted to module scope.
- `AddTenantForm.tsx` — removed the "Security Deposit" and "Agency Fee" fields from the Lease Details step. Agency Fee was collected and shown in the review summary but never actually submitted anywhere (no backing schema field) — it did nothing. `Lease.deposit` (required, non-nullable) now always submits as `0`.
- `ScheduleViewing.tsx` + `POST /api/v1/properties/[id]/viewings` — scheduling a tour used to redirect immediately with no confirmation; the step-3 "Viewing Scheduled!" screen existed in the code but was dead (nothing ever set `step` to 3). Wired it up, and added a confirmation email (console-transport, same `sendEmail()` pattern as the moderation-decision email) since the confirmation screen promises one.
- **Admin property-approval discovery path** — added a "Properties" tab to `AdminChrome.tsx` and a new `/admin/properties` moderation queue page (status filter chips, defaults to Pending Review, search, links into the existing `PropertyDetail.tsx` approve/reject UI which was already built but unreachable). Also surfaced pending listings in `AdminDashboard.tsx`'s "Items Needing Attention" feed, clickable through to the queue. No new backend endpoint needed — `GET /api/v1/properties?scope=mine` already returns all properties for an ADMIN caller; only added `manager` to its `include` so the queue can show who submitted each listing.
- **Service charge, re-added** (migration `20260928085653_add_service_charge`) — `serviceCharge` on `Unit` (advertised, defaults `0`) and `Lease` (contracted, non-nullable, defaults `0`), plus `InvoiceType.SERVICE_CHARGE` restored to the enum. Billed as its **own** invoice line (initial invoice at lease creation in `app/api/v1/leases/route.ts`, recurring via `lib/workers/rentInvoicer.ts`), never merged into the `RENT` invoice's amount. `ListProperty.tsx` and `AddTenantForm.tsx` both collect it and display a combined "Total per cycle"; `TenantDashboard.tsx`'s rent tile shows the combined total with a rent/service-charge breakdown underneath when non-zero.
- **Multi-unit property listings** — `ListProperty.tsx`'s single hardcoded unit is now a repeatable list of unit cards (unit number/label, bedrooms, bathrooms, rent, service charge, sqft), with "+ Add Another Unit" and per-card remove. Submission creates the property once, then each unit via its own `createUnit` call (no bulk-create endpoint exists) — not atomic, so per-unit status (pending/creating/created/failed) is tracked and a "Retry Failed Units" action lets the manager recover from a partial failure without recreating the property.
- **Tenant profile + application form rework** (migrations `20260928092021_tenant_profile_fields`, `20260928092131_tenant_year_of_birth`) — `User` extended with `previousLandlordPhone/Email`, `idDocumentUrl`, `yearOfBirth` (joining the already-existing but previously unsurfaced `emergencyContactName/Relationship/Phone`). New `lib/tenantProfile.ts` (`isTenantProfileComplete`/`missingTenantProfileFields`) defines the gate: phone, year of birth, emergency contact, and ID document are required; previous landlord is deliberately optional (a first-time renter may not have one). New `/dashboard/profile/complete` page (`CompleteProfileForm.tsx`) collects it once, reusing the same direct-to-Cloudinary upload flow (`lib/uploadClient.ts`, now also accepting a `'profile'` folder) the application form's old document step used. `/dashboard/properties/[id]/apply` now redirects to that page (with `?next=`) before rendering the form at all if the profile is incomplete. `PropertyApplicationForm.tsx` itself dropped from 4 steps to 3: Personal Info/References/Documents are gone (identity prefilled read-only from the profile; references and ID now live there too); Employment step lost Lease Duration and Number of Occupants (both removed per explicit request, not moved anywhere — lease terms are the manager's call in `AddTenantForm`, not the applicant's).
- **`docs/proplity-step-by-step-role-guide.md` / `.pdf` / `out/proplity-guide.html` regenerated** to describe all of the above (profile gate + 3-step application, multi-unit listings, service charge, new admin Properties tab) — `out/scripts/generate_guide_pdf.mjs`'s hardcoded markdown/HTML content is the source of truth for these, edited directly rather than editing the generated files (they get overwritten on the next run). Screenshots recaptured via `out/scripts/capture_updated_flows.mjs` (tenant profile gate, simplified application form, multi-unit listing) and `out/scripts/capture_remaining.mjs` (Add Tenant service charge, admin Properties tab); both scripts now use positional/type-based Playwright selectors (`input[type="tel"]`, `.nth()`, etc.) instead of `getByLabel(...)`, since this codebase's `<label>` elements are plain visual siblings with no `htmlFor` — `getByLabel` silently hangs the full 30s timeout on every one.
- Local dev database moved off the now-gone standalone Postgres instance on port `5544` to a `proplity_test` database on the shared system Postgres cluster (port `5432`, role `roji`) — `.env`'s `DATABASE_URL` updated accordingly. Not committed (`.env` is gitignored); anyone else running this locally needs their own `DATABASE_URL` pointed at a reachable Postgres instance.
- **Role-scoped "Properties" nav, completed** — new `/dashboard/properties` page + "My Properties" sidebar tab for **managers** (a real searchable list with unit/occupancy counts, replacing the bare property-count tile their generic `Dashboard.tsx` had); new `/dashboard/rentals` page + "My Rentals" sidebar tab for **tenants** (their full lease history — current and past — `TenantDashboard.tsx` only ever showed the single _active_ lease via `useActiveLease`, with no record of expired/terminated ones once superseded). **Landlord deliberately skipped**: their `/dashboard` ("Portfolio" tab) already renders a full per-property list with occupancy and revenue (`LandlordDashboard.tsx`'s "Property Performance" section) — a second nav entry would just duplicate it. Rental-history rows link to `/dashboard/properties/[id]`, not the manager-only `/dashboard/tenants/[id]` lease console (Terminate/Renew/Activate buttons a tenant shouldn't see) — that route already branches to a read-only `PublicPropertyDetail` for the tenant role.
- **`ListProperty.tsx` media upload wired up** — the three "Upload Video"/"Upload Photos" buttons in the media step were dead `alert()` stubs, and a "(Demo: Simulate Upload Complete)" button faked success without ever uploading anything or attaching media to the created property (`CreatePropertyInput` didn't even carry `imageUrl`/`video360Url`/`exteriorPhotoUrl` before this). Reused the same direct-to-Cloudinary flow as `MaintenanceRequestForm.tsx`/`CompleteProfileForm.tsx` (`lib/uploadClient.ts`, now also accepting a `'properties'` folder); the 360° video and exterior-photos fields map 1:1 to the schema's single-value columns, while "Photos of Every Room" (a schema-unsupported gallery) uses its first upload as the property's `imageUrl` and keeps the rest only as a local selection count. Step 4's "Media Status" summary now reflects real upload state instead of always showing all-green checkmarks. Cloudinary isn't configured in this local environment, so the upload buttons show the same "not available" fallback banner `MaintenanceRequestForm` already uses — verified the surrounding form (property creation with the new optional fields, demo-button removal, status summary) live against the real dev server/DB instead.
- **Auth: logout no longer silently skips revocation for an idle session** — found by an independent auth review (`docs/auth-review-2026-09-30.md`, not authored in this session — a parallel Claude Code session's audit, left untouched/uncommitted since it isn't this session's work). Logout identifies whose refresh tokens to revoke by decoding `access_token` (the `refresh_token` cookie is deliberately scoped to `path=/api/v1/auth/refresh` and never reaches `/logout`). It used the strict `getServerSession()`, so an access token that had already expired (idle tab past 15 minutes) made `session` come back `null` — the `RefreshToken` DB row was never revoked even though the browser's cookies were cleared and the UI showed "logged out." A stolen/copied refresh token would then keep working for up to 30 days after the user believed they'd logged out. Fixed with a new `verifyTokenAllowExpired`/`getExpiredSession` (`lib/auth/jwt.ts`, `lib/auth/session.ts`) that accepts a signature-valid-but-expired JWT for this one identification purpose only, never for authorization — checked via jose's `err.code === 'ERR_JWT_EXPIRED'` rather than `instanceof errors.JWTExpired`, since Next.js can bundle `jose` into more than one module instance across the route-handler/library boundary and silently break `instanceof` across it (this is exactly what broke the first attempt at this fix, caught by a live logout test against a real DB before it shipped). New regression test in `tests/api/auth.test.ts` (`logout still revokes the refresh token when the access token has already expired`) proves the fix: refresh-token count goes from >0 to exactly 0 across the call. Also fixed the same review's finding #4: `validateCSRF`'s Origin-header branch (`lib/auth/csrf.ts`) had no `try/catch` around `new URL(origin)`, unlike its own Referer fallback two lines below — a malformed Origin surfaced as an unhandled 500 instead of the intended fail-closed 403.
- **Auth review findings #2 and #3, also fixed.** #2 (`lib/auth/rateLimit.ts`'s check-then-record race): replaced `checkRateLimit`/`recordAttempt` with `reserveAttempt`/`releaseAttempt` — an atomic check-and-insert guarded by a Postgres advisory lock scoped to the identifier (`pg_advisory_xact_lock(hashtext(identifier))`), called _before_ any slow work in all 6 call sites (`login`, `register`, `forgot-password`, `resend-verification`, `refresh`, `setup`). Preserves each route's exact pre-existing "which outcomes count against the limit" semantics (e.g. login only counts wrong-password attempts, not successful logins) via `releaseAttempt` deleting the reservation on a non-counting outcome — proved correct with a standalone script firing 10 truly-concurrent reservations at MAX_ATTEMPTS=5 and confirming exactly 5 succeed (the old code would have let all 10 through, since none had recorded yet when the others checked). Independently found and also fixed in the same pass: `refresh/route.ts` called `checkRateLimit` but never `recordAttempt` anywhere — its rate limit was silently dead in production, since no `LoginAttempt` row with a `refresh:` identifier was ever created. #3 (`getClientIp()` trusting the spoofable first `X-Forwarded-For` hop): switched to the _last_ hop — in a single-trusted-proxy topology (Vercel's edge, this deployment's target), each hop appends the IP it observed, so the last entry is the one the trusted edge actually saw; the first is whatever the client itself sent.
- **"Setup Auto-Pay" wired up** (`TenantDashboard.tsx`) — the backend (`AutoPayMandate` model, full CRUD at `/api/v1/payments/autopay`) already existed but nothing called it, and there's no card-entry UI anywhere in this codebase to collect a chargeable token from. Rather than fake one, added `GET /api/v1/payments/authorization`: it reads the tenant's own most recent Paystack `charge.success` webhook payload (already stored verbatim in `Payment.rawProviderPayload`) back out and, when the card was reusable, surfaces just the derived `authorization_code` — the same token Paystack's own "charge authorization" API takes for a repeat charge. The button now checks for that first: no saved card yet → tells the tenant to pay one invoice online first; a reusable card found → confirm-and-enable creates the mandate; an active mandate → shows the card's last 4 digits with a Cancel action (soft-cancel via the existing `DELETE`). `lib/payments/mockGateway.ts`'s local test payload now sets `authorization.reusable: true` (was hardcoded `false`, previously unread by any code) so this is testable without real Paystack keys. Live-verified end-to-end: no-card state → mock payment → authorization detected → mandate created (`201`) → active badge rendered → cancelled (`200`). Recurring auto-charging itself (a cron actually billing the saved mandate each cycle) is not built — same honestly-incomplete pattern as `AdCampaign`'s impression/click counters.
- **"Download Report" / "Schedule Review" wired up** (`LandlordDashboard.tsx`) — both were dead `alert()` stubs. "Download Report" needed no new backend: the dashboard already fetches this landlord's properties/units/invoices, so it's reshaped client-side into a per-property financial-summary CSV (`lib/csv.ts`'s existing `toCsv`) and handed back as a browser download. "Schedule Review" had no backend concept to wire at all — there's no meeting/appointment model anywhere in this codebase — so the real available action is starting a direct message to the property's manager to arrange one (the same idea as every other "Message Manager" entry point, filling the gap `useCreateConversation`'s own comment already flagged: a `DIRECT` conversation had no compose-UI entry point yet). Picks the manager from the landlord's properties (a select when there's more than one), sends an initial message, and both are disabled with an honest reason when there's no data to act on (no properties, no manager assigned). Live-verified end-to-end: real CSV contents, conversation dedup working correctly across repeat runs, message persisted, and navigation into the new thread.
- **`AdminDashboard.tsx`'s Security/Database/Settings tiles wired up** — the last cluster of dead `alert()` stubs from the original gap audit. "Settings" now navigates to the already-built `/admin/settings` page (it existed and was reachable from `AdminChrome`'s own sidebar, just not from this dashboard tile). "Security" is new: `GET /api/v1/admin/audit-logs` (ADMIN only) plus a new `/admin/security` page reading back the `AuditLog` model, which existed with exactly one writer (`setup/route.ts`'s `FIRST_RUN_SETUP` entry) and no reader anywhere — added to `AdminChrome`'s nav alongside the dashboard tile. "Database" (backups & logs) has no real backend to wire at all — there's no backup/restore mechanism or admin-visible query-log storage in this codebase — so rather than fake one, it now shows an honest inline explanation that this is managed at the infrastructure level, not from the app. This closes out the original UI/UX gap-audit punch list's dead-`alert()` cluster entirely (see [[proplity-uiux-gap-audit]]).

---

## 📄 Where to look next

- `docs/development-history/domain-api-implementation-plan.md` — the original full 6-phase domain-API spec (now complete).
- `docs/development-history/phases/*.md` — one detailed writeup per completed phase (what/why/verification), including the Phase 9 and Phase 10 sub-phase docs, the post-roadmap features, `ui-ux-gap-audit.md` and `auth-review-hardening.md`.
- `docs/development-history/phase-10-test-suite-plan.md` — the test suite's architecture and sub-phase breakdown.
- `docs/development-history/next-phase-analysis.md` — the analysis that proposed Phase 9 and Phase 10 (both now complete); Finding 4 (punch list) is what's left open from it.
- `docs/auth-review-2026-09-30.md` — the independent auth review and its four findings (all fixed).
- `docs/flow-guide.md`, `docs/testing-guide.md`, `docs/setup-guide.md`, `docs/proplity-step-by-step-role-guide.md` — click-by-click guides for each role, the QA checklist, and first-run setup.
- `DEPLOYMENT.md` and `PROJECT_STRUCTURE.md` — deploy/CI/cron setup and the file-tree reference.
- `CLAUDE.md` — the authoritative, always-current project reference; read it before making changes.
