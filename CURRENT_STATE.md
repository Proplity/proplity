# 📊 Proplity — Current Project & Codebase State

> **Last Updated:** 2026-08-22
> **Status:** Full domain-API roadmap complete (Phase 0-pre through Phase 8) | Next: frontend read-path hydration and/or an automated test suite — see `out/next-phase-analysis.md`

---

## 🎯 Executive Snapshot

| Subsystem | Completion | Status Summary |
|---|:---:|---|
| **Database & Schema** | **100%** | 33 Prisma models across 8 modular schema files; 2 migrations applied; local PostgreSQL (`proplity_db`) fully configured and seeded. |
| **Authentication & Security** | **100%** | 7 REST endpoints `/api/v1/auth/*`, Edge JWT + opaque refresh tokens, CSRF, rate limiting, Axios interceptor, `AuthContext`. All known bugs from the pre-Phase-0 audit fixed. Self-registration email verification remains deliberately deferred (see below). |
| **Domain REST APIs** | **100%** | All 6 phases built and live-tested: `/api/v1/properties`, `/maintenance`, `/leases`, `/invoices` + `/payments`, `/access-codes`, `/conversations`. 34 API routes total. |
| **Background Workers** | **100% built, 0% scheduled** | 5 idempotent workers (rent invoicer, overdue flagger, maintenance dispatcher, access-code janitor, payment-reliability scorer), triggered via `POST /api/v1/cron/[job]` or `scripts/workers/*.ts`. Nothing calls them on a timer yet — no deployment target decided. |
| **Frontend UI Views** | **~15% wired, 85% mocked** | Complete, polished UI views for all 5 roles exist. 5 write-forms wired to real APIs (Phase 7: `MaintenanceRequestForm`, `ScheduleViewing`, `ListProperty`, `VendorCreateInvoice`, `AddTenantForm`). ~24 of 37 top-level components still read from `app/store/*` mock data for display. |
| **Paystack Integration** | **Built, partially verified** | Checkout initialization, HMAC-SHA512 webhook, autopay mandates all built. Webhook fully live-tested (self-signed test key). `/payments/initialize`'s actual call to Paystack's live API has never run — no real test-mode account provided yet. |
| **Email** | **Console-transport only** | `lib/email.ts` logs instead of delivering. Real, tested, and in production use for the Phase 7 tenant-invite flow. Self-registration (`register`) still has no verification step at all — separate, older, still-deferred gap. |
| **Automated Tests** | **0%** | No Jest/Vitest/Playwright/Cypress, no CI config. Every phase verified manually via `curl` against the live dev server and seeded database. |

---

## 🔍 Detailed Subsystem Breakdown

### 1. 🗄️ Database & Prisma ORM (`prisma/`) — **READY**
- **Architecture**: Modular Prisma schema layout (`prisma/schema/` with 8 domain files: `audit`, `auth`, `base`, `communication`, `financial`, `lease`, `operations`, `property`).
- **Database**: PostgreSQL 18 instance running locally on port `5432` pointing to `proplity_db`.
- **Migrations**:
  - `20260821115725_init_domain_schema` — initial schema.
  - `20260822172214_sync_schema_drift` — brought the live DB in line with `schema.prisma`/CLAUDE.md, which had drifted ahead of it (`Notice.viewedAt`, `NoticeType.TERMINATION_NOTICE`, dropped `InvoiceType.SERVICE_CHARGE`). Found and fixed during Phase 3 live testing.
- **Seed Scripts**:
  - `prisma/seed.ts`: Clean standard seed (1 property, 5 core demo users, 1 lease, 1 invoice).
  - `prisma/seed2.ts`: Enriched multi-property seed (4 properties across Lekki/VI/Yaba, 9 users, 5 units, 3 leases, gate access codes with audit logs, verified reviews, neighbourhood reports, invoices).
- **Live Database Row Counts** (`proplity_db`, from `seed2.ts` — unchanged since seeding; every phase's live-testing created and then cleaned up its own throwaway rows):
  - `User`: **9** | `Property`: **4** | `Unit`: **5** | `Lease`: **3**
  - `MaintenanceRequest`: **3** | `MaintenanceCategory`: **7** | `MaintenanceSchedule`: **0** | `VendorRating`: **2**
  - `AccessCode`: **2** | `AccessLog`: **2** | `PropertyReview`: **2** | `NeighbourhoodReport`: **2**
  - `Invoice`: **3** | `Payment`: **2** | `Note`: **1** | `Conversation`: **0** | `Message`: **0** | `AutoPayMandate`: **0**

---

### 2. 🔐 Authentication & Session Layer (`app/api/v1/auth/`, `lib/auth/`, `context/`) — **100% COMPLETE**
- **JWT & Tokens**: 15-minute Edge-compatible access tokens (`jose`) + 7-day opaque refresh tokens, hashed in `RefreshToken` with `familyId` rotation and reuse detection.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, path-scoped (`access_token` at `/`, `refresh_token` at `/api/v1/auth/refresh`).
- **Middleware & Guards**: CSRF header verification (`lib/auth/csrf.ts`, exempting only `verify-email`), DB-backed IP + account rate limiting (`lib/auth/rateLimit.ts`), `getServerSession()` server-component helper, and a live `proxy.ts` edge guard (Next 16 renamed `middleware.ts` → `proxy.ts`; this repo's had a dead-code version since before this engagement — now active).
- **Client Integration**: `lib/apiClient.ts` (Axios, single-flight 401-refresh dedup, plus a domain-grouped typed `api.*` client added in Phase 7), `context/AuthContext.tsx`, `hooks/useAuthRefresh.ts` (13-min proactive timer), demo-login buttons gated to non-production.
- **Tenant-invite flow (Phase 7, new)**: `POST /api/v1/leases` accepts `tenantEmail`+`tenantName` as an alternative to an existing `tenantId` — creates a `PENDING_VERIFICATION` user, a `VerificationToken`, and sends a console-logged invite email. `app/verify-email/page.tsx` (new) lets the invited tenant set a password and activate. Fully live-tested end to end, including login before/after verification.
- **Still deferred**: real email delivery (see Executive Snapshot), self-registration's own verification flow (`register` still sets `status: ACTIVE` directly).

---

### 3. ⚙️ Domain REST APIs (`app/api/v1/`) — **100% COMPLETE, LIVE-TESTED**

All 34 routes below were built phase-by-phase, each verified against the real dev server and seeded database (RBAC boundaries, business-rule enforcement, and cleanup of test data), with a full writeup per phase in `out/phases/`:

| Phase | Routes | Doc |
|---|---|---|
| 0 | `lib/api/withAuth.ts`, `pagination.ts`, `errors.ts`, `validate.ts` (shared infra, no routes) | `out/phases/domain-api-phase-0-*.md` |
| 1 — Properties & Units | `properties`, `properties/[id]`, `.../units`, `.../units/[unitId]`, `.../reviews`, `.../viewings`, `.../neighbourhood-report` (7) | `domain-api-phase-1-properties.md` |
| 2 — Maintenance & Operations | `maintenance/categories`, `maintenance/requests`, `.../[id]`, `.../[id]/rating`, `maintenance/schedules` (5) | `domain-api-phase-2-maintenance.md` |
| 3 — Leases & Tenancy | `leases`, `leases/[id]`, `.../notices`, `.../notes` (4) | `domain-api-phase-3-leases.md` |
| 4 — Financial & Payments | `invoices`, `invoices/[id]`, `payments/initialize`, `.../webhook`, `.../autopay` (5) | `domain-api-phase-4-financial.md` |
| 5 — Access Control | `access-codes`, `access-codes/[id]`, `access-codes/verify` (3) | `domain-api-phase-5-access-control.md` |
| 6 — Communications | `conversations`, `conversations/[id]/messages` (2) | `domain-api-phase-6-communications.md` |
| 7 — Frontend Integration | 5 forms wired + tenant-invite flow (no new API routes beyond the `leases`/`verify-email` extensions above) | `domain-api-phase-7-frontend-integration.md` |
| 8 — Background Workers | `cron/[job]` (1) | `domain-api-phase-8-background-workers.md` |

Plus `auth/*` (7 routes, pre-existing).

---

### 4. ⏱️ Background Workers (`lib/workers/`, `scripts/workers/`) — **BUILT, NOT SCHEDULED**

Five idempotent workers, each with real logic against the schema (not stubs), invoked from `POST /api/v1/cron/[job]` (guarded by `CRON_SECRET`) or a standalone `pnpm exec tsx scripts/workers/*.ts`:

- **Rent Invoicer** — generates the next cycle's `RENT` invoice per `ACTIVE` lease; advances one cycle per run when behind.
- **Overdue Flagger** — `UNPAID` + past-due → `OVERDUE`, one `PAYMENT_REMINDER` notice per invoice.
- **Maintenance Schedule Dispatcher** — due schedules generate a `MaintenanceRequest`, attributed to the unit's active tenant.
- **Access Code Expiry Janitor** — `ACTIVE` + past `validUntil` → `EXPIRED`.
- **Payment Reliability Scorer** — writes `Lease.paymentReliability`/`riskScore` via a documented heuristic (not real ML — no formula exists in the PRD).

**Not done**: actually scheduling these (Vercel Cron / crontab / CI) — depends on a deployment target not yet decided.

---

### 5. 🎨 Frontend Views (`app/components/`, `app/store/`) — **~15% WIRED**

- **Wired to real APIs (Phase 7)**: `MaintenanceRequestForm.tsx`, `ScheduleViewing.tsx`, `ListProperty.tsx`, `VendorCreateInvoice.tsx`, `AddTenantForm.tsx` — all 5 write to real backend routes, verified via `tsc`/`build`/SSR checks and full backend-logic live testing. **Not verified**: interactive browser click-through (no browser-automation tool available in this environment).
- **Still on mock data for display** (~24 of 37 top-level components): every dashboard (`AdminDashboard`, `Dashboard`, `LandlordDashboard`, `TenantDashboard`, `VendorDashboard`), every breakdown/report page, `PropertyDiscovery`/`PublicPropertyDetail`/`PropertyDetail`, `MaintenanceBoard`/`MaintenanceDetail`/`TenantMaintenanceRequests`, `TenantManagement`/`TenantDetail`/`TenantPaymentHistory`, `MessagingPortal`, `NeighbourhoodReport`, `VendorDashboard`/`VendorJobDetail`, `AIAssistant`, and the 4 marketing feature pages. Real `GET` routes exist for all of this data already — see `out/next-phase-analysis.md` for the proposed hydration phase.
- **New this phase**: `lib/apiClient.ts`'s domain-grouped `api.*` client, `lib/api/types.ts`, 5 hooks (`hooks/useProperties.ts`, `useMaintenanceRequests.ts`, `useLeases.ts`, `useInvoices.ts`, `useAccessCodes.ts`) built on a shared `useApiSubmit.ts` helper.

---

## 🔑 Crucial Architectural & Business Rules

The full list lives in `CLAUDE.md` ("Non-negotiable rules," 12 entries, plus "Known gaps" and "Deliberately deferred"). Highlights:

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

| Role | Email | Name / Entity |
|---|---|---|
| **ADMIN** | `admin@proplity.com` | System Admin |
| **MANAGER** | `manager@proplity.com` | Alex Vance (Manager) |
| **LANDLORD** | `landlord@proplity.com` | Eleanor Sterling (Landlord) |
| **TENANT** | `tenant@proplity.com` | Jordan Hayes (Tenant) |
| **TENANT** | `adewale.j@email.com` | Adewale Johnson |
| **TENANT** | `tunde@email.com` | Tunde Bakare |
| **VENDOR** | `vendor@proplity.com` | Apex Repairs & Plumbing |
| **VENDOR** | `john.electrical@email.com` | John Electricals |
| **VENDOR** | `aquafix@email.com` | AquaFix Plumbers |

---

## 🚀 How to Run & Verify

```bash
# 1. Start local dev server (App on http://localhost:3000)
pnpm dev

# 2. Re-seed the database
pnpm exec tsx prisma/seed2.ts

# 3. Type check codebase
pnpm exec tsc --noEmit

# 4. Production build check
pnpm build

# 5. Run a background worker manually (needs CRON_SECRET in .env)
pnpm exec tsx scripts/workers/rentInvoicer.ts
# or: curl -X POST localhost:3000/api/v1/cron/rent-invoicer -H "x-cron-secret: $CRON_SECRET"
```

---

## 📄 Where to look next

- `out/domain-api-implementation-plan.md` — the original full 6-phase domain-API spec (now complete).
- `out/phases/*.md` — one detailed writeup per completed phase (what/why/verification).
- `out/next-phase-analysis.md` — current prioritized proposal for what comes after Phase 8.
- `CLAUDE.md` — the authoritative, always-current project reference; read it before making changes.
