# 📊 Proplity — Current Project & Codebase State

> **Last Updated:** August 2026  
> **Status:** Phase 1 & 2 Completed (Schemas, Seed, Auth Core) | Phase 3 Pending (Domain APIs)

---

## 🎯 Executive Snapshot

| Subsystem | Completion | Status Summary |
|---|:---:|---|
| **Database & Schema** | **100%** | 33 Prisma models across 8 modular schema files; initial migration applied; local PostgreSQL (`proplity_db`) fully configured and seeded. |
| **Authentication & Security** | **85%** | Core auth functional (7 REST endpoints `/api/v1/auth/*`, Edge JWT + opaque refresh tokens, CSRF, rate limiting, Axios interceptor, `AuthContext`). Pending: transactional email service (`lib/email.ts`), forgot/reset password API routes, and live email verification sending. |
| **Frontend UI Views** | **95%** | Complete, polished UI views for all 5 roles (Admin, Landlord, Manager, Tenant, Vendor); currently reading from `app/store/` mock data. Quick demo login buttons authenticate against real seeded accounts (`Password123!`) to ensure active JWT sessions. |
| **Domain REST APIs** | **0% (Next)** | Planned across 6 phases (`/api/v1/properties`, `/maintenance`, `/leases`, `/invoices`, `/access-codes`, `/conversations`). |
| **Integrations & Workers** | **0% (Planned)** | Paystack webhook & checkout initialization, cron jobs (rent invoicer, overdue flagger, access code expiry). |

---

## 🔍 Detailed Subsystem Breakdown

### 1. 🗄️ Database & Prisma ORM (`prisma/`) — **READY**
- **Architecture**: Modular Prisma schema layout (`prisma/schema/` with 8 domain files: `audit`, `auth`, `base`, `communication`, `financial`, `lease`, `operations`, `property`).
- **Database**: PostgreSQL 18 instance running locally on port `5432` pointing to `proplity_db`.
- **Active Migration**: `20260821115725_init_domain_schema` applied.
- **Seed Scripts**:
  - `prisma/seed.ts`: Clean standard seed populating 1 property, 5 core demo users, 1 lease, and 1 invoice.
  - `prisma/seed2.ts`: Enriched multi-property seed populating 4 properties (Lekki, VI, Yaba), 9 users, 5 units, 3 leases, 2 gate access codes with scan audit logs, 2 verified reviews, 2 neighborhood reports, and 3 invoices.
  - Both seed scripts feature safe, repeatable table cleanups (`deleteMany()`).
- **Live Database Audit Counts (`proplity_db`)**:
  - `User`: **9** | `Property`: **4** | `Unit`: **5** | `Lease`: **3**
  - `MaintenanceRequest`: **3** | `MaintenanceCategory`: **7** | `VendorRating`: **2**
  - `AccessCode`: **2** | `AccessLog`: **2** | `PropertyReview`: **2**
  - `NeighbourhoodReport`: **2** | `Invoice`: **3** | `Payment`: **2** | `Note`: **1**

---

### 2. 🔐 Authentication & Session Layer (`app/api/v1/auth/`, `lib/auth/`, `context/`) — **85% COMPLETE**
- **JWT & Tokens**:
  - Stateless 15-minute access tokens issued using `jose` (Edge-runtime compatible).
  - 7-day opaque refresh tokens stored hashed in the `RefreshToken` table with `familyId` token rotation and reuse detection.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax` path-scoped cookies (`access_token` scoped to `/`, `refresh_token` scoped to `/api/v1/auth/refresh`).
- **Middleware & Guards**:
  - CSRF header verification on mutating requests (`lib/auth/csrf.ts`).
  - Database-backed IP + account rate limiting (`lib/auth/rateLimit.ts`).
  - Server Component session helper `getServerSession()` (`lib/auth/session.ts`).
- **Client Integration & Demo Login**:
  - `lib/apiClient.ts`: Axios instance with single-flight token refresh deduplication on `401 Unauthorized` responses.
  - `context/AuthContext.tsx`: React Context providing reactive `user`, `login`, `register`, `logout`, and `refreshUser`. Automatically normalizes roles to lowercase `UserRole`.
  - `Login.tsx`: Quick demo access buttons execute real authenticated logins using seeded demo credentials (issuing valid HTTP-only JWT cookies).
  - `hooks/useAuthRefresh.ts`: Background silent token refresh hook.
- **Pending Auth Features (Phase 4)**:
  - Transactional email transport (`lib/email.ts`) using Resend/SendGrid.
  - `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` endpoints.
  - Connecting `ForgotPassword.tsx` UI form to the backend reset endpoint.
  - Live email delivery for `VerificationToken` on user registration.

---

### 3. 🎨 Frontend Views & Mock Data State (`app/components/`, `app/store/`) — **MOCKED**
- **Role Dashboards**:
  - `AdminDashboard.tsx` & `AdminBreakdownPage.tsx`: Platform health, user growth, revenue charts.
  - `Dashboard.tsx` & `DashboardBreakdownPage.tsx`: Property manager operations hub (occupancy, rent, tickets).
  - `LandlordDashboard.tsx`: Landlord portfolio yield, asset valuation, and revenue metrics.
  - `TenantDashboard.tsx`: Tenant portal (active lease, pay rent button, guest access codes, maintenance requests).
  - `VendorDashboard.tsx`: Service provider work order pipeline, active jobs, and earnings.
- **Feature Portals & Wizards**:
  - `PropertyDiscovery.tsx` & `PublicPropertyDetail.tsx`: Public real estate listing explorer with map filters and viewing appointment scheduler (`ScheduleViewing.tsx`).
  - `MaintenanceBoard.tsx` & `MaintenanceDetail.tsx`: Kanban triage board and ticket chat.
  - `ListProperty.tsx`: Multi-step landlord/manager property creation wizard.
  - `AddTenantForm.tsx`: Tenant onboarding and lease agreement generation wizard.
  - `MessagingPortal.tsx`: In-app tenant-to-manager messaging interface.
  - `AIAssistant.tsx`: AI-driven property copilot drawer.
- **Current Data Source**: All components above currently render static mock data imported from `app/store/*` (`mockData.ts`, `propertyDetailData.ts`, `tenantDashboardData.ts`, etc.).

---

### 4. ⚙️ Domain API Handlers (`app/api/v1/`) — **PENDING IMPLEMENTATION**
The domain backend API endpoints are planned and ready to be built in sequence:
- **Phase 0**: Shared API Infrastructure (`withAuth` RBAC middleware, pagination helper, error mapper, Zod validator).
- **Phase 1**: `/api/v1/properties` (CRUD, multi-attribute unit price filtering, reviews, viewings, neighborhood reports).
- **Phase 2**: `/api/v1/maintenance` (Categories, request submission, manager triage, vendor status updates & completion proof, ratings).
- **Phase 3**: `/api/v1/leases` & `/api/v1/tenants` (Active lease management, renewal notices, termination notices, staff notes).
- **Phase 4**: `/api/v1/invoices` & `/api/v1/payments` (Billing ledger, Paystack checkout initialization, HMAC SHA-512 webhook listener, autopay mandates).
- **Phase 5**: `/api/v1/access-codes` (Guest code generation, security gate verification, soft-revocation audit safety).
- **Phase 6**: `/api/v1/conversations` (Contextual messaging threads and cursor-based message history).

---

## 🔑 Crucial Architectural & Business Rules

1. **Access Code Deletion Safety**:
   `AccessLog` has an `onDelete: Cascade` relationship with `AccessCode`. Therefore, **never execute `prisma.accessCode.delete()`**. All deletions are handled as **soft-revokes**:
   ```typescript
   await prisma.accessCode.update({
     where: { id },
     data: { status: 'REVOKED', revokedAt: new Date() }
   });
   ```

2. **Verified Reviews FK Provenance**:
   Property reviews do not use a boolean `isVerified` flag. A review is verified if `PropertyReview.leaseId` is set at creation time (linking the tenant's active or prior lease on that property).

3. **Database-Level Invoice Number Generation**:
   `Invoice.invoiceNumber` is auto-generated directly inside PostgreSQL via:
   ```prisma
   invoiceNumber String @unique @default(dbgenerated("('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)))"))
   ```

4. **Dynamic Metric Computation**:
   Vendor reputation score is **computed dynamically at query time** (`AVG(VendorRating.rating)`) rather than stored in a stale, cached column on `VendorProfile`.

5. **Unit-Level Property Price Filtering**:
   `Property` has no scalar price column. Filters for `minPrice` / `maxPrice` query against the relational `Unit.rentAmount` values.

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
```
