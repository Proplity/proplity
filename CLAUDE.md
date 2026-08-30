# CLAUDE.md — Proplity

Project context for Claude Code. Read this before making changes.

Proplity is an AI-native rental/property management platform for the Nigerian market. Next.js 16.3.2 (App Router), TypeScript, PostgreSQL 18, Prisma ORM.

---

## Current state

All 8 phases of the domain-API roadmap (`docs/development-history/domain-api-implementation-plan.md`) plus Phase 9 (frontend read-path hydration, `docs/development-history/next-phase-analysis.md` Finding 2) and Phase 10 (automated test suite, Finding 3) are **complete** — 36 API routes, 35 page routes, 5 background workers, 214 automated tests, all live-tested against the real dev server and seeded database. Full history in `docs/development-history/phases/*.md`, one doc per phase.

| Subsystem                                                                                                                    | Status                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema (33 models, 8 modular files, 2 migrations)                                                                     | Done, migrated, seeded                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Auth API (`/api/v1/auth/*`, 7 routes)                                                                                        | Done — all known bugs from the pre-Phase-0 audit fixed                                                                                                                                                                                                                                                                                                                                                                                  |
| Domain APIs (properties, maintenance, leases, invoices/payments, access-codes, conversations, +vendors, +admin/users)        | Done — Phases 1–6, extended in Phase 9                                                                                                                                                                                                                                                                                                                                                                                                  |
| Background workers (rent invoicer, overdue flagger, maintenance dispatcher, access-code janitor, payment-reliability scorer) | Done — Phase 8, **scheduled** as of the deployment phase: `vercel.json` runs `/api/v1/cron/all` daily (Hobby-plan limits mean one job fans out to all 5 in dependency order). See `DEPLOYMENT.md` §4 and `docs/development-history/phases/domain-api-phase-8-background-workers.md`                                                                                                                                                     |
| Paystack (checkout init, webhook, autopay)                                                                                   | Done, but `/payments/initialize`'s actual call to Paystack's API has never run against a real test-mode account — everything else is fully tested                                                                                                                                                                                                                                                                                       |
| Email                                                                                                                        | Console-transport only (`lib/email.ts` logs instead of delivering) — real for the tenant-invite flow (Phase 7), not yet swapped for a real provider. Self-registration (`register`) still has no verification flow at all (separate, older gap, see "Deliberately deferred")                                                                                                                                                            |
| Frontend UI (all 5 roles)                                                                                                    | Done — Phase 9. All 20 originally-catalogued mock-data dashboard/detail components now read real data via 10 hook files and a typed `api.*` client; 6 forms wired to real APIs (5 from Phase 7, `AddTenantForm`'s invite flow) plus the 20 hydrated for display. Only marketing/illustrative pages (`*FeaturePage.tsx`) and `AIAssistant.tsx` still touch `app/store/*` — deliberately out of scope, no real backing exists for either. |
| Automated tests                                                                                                              | Done — Phase 10, extended since. Vitest, 214 tests across 13 files, `pnpm test`, run in CI on every PR. Real HTTP against a real spawned `next dev` server + a dedicated `proplity_test_db` (dropped/recreated per run) — see "Testing" below                                                                                                                                                                                           |

Roles: `ADMIN`, `MANAGER`, `LANDLORD`, `TENANT`, `VENDOR`.

---

## Commands

```bash
pnpm dev                          # dev server, localhost:3000
pnpm exec tsc --noEmit            # type check
pnpm build                        # production build
pnpm exec tsx prisma/seed2.ts     # re-seed (enriched dataset)
pnpm exec prisma migrate dev      # apply schema changes
pnpm exec prisma generate         # regenerate client after schema edits
pnpm test                         # run the automated test suite (see "Testing" below)
```

Seeded dev accounts all use password `Password123!` — `admin@`, `manager@`, `landlord@`, `tenant@`, `vendor@proplity.com`.

---

## Non-negotiable rules

These were each arrived at deliberately after review. Don't "fix" them back.

### 1. Never `prisma.accessCode.delete()`

`AccessLog.accessCode` has `onDelete: Cascade`. A real delete wipes the entire gate-access audit trail, which is a PRD requirement (§5.3 "full audit trail of access activity"). All deletion is soft-revoke:

```typescript
await prisma.accessCode.update({
  where: { id },
  data: { status: 'REVOKED', revokedAt: new Date() },
});
```

### 2. Role casing: uppercase server-side, lowercase client-side

- JWT payload / `getServerSession()` → **uppercase** Prisma `Role` (`'MANAGER'`)
- API JSON responses → **lowercase** (`role: user.role.toLowerCase()`)
- `AuthContext.normalizeUser()` enforces lowercase at the client boundary

`withAuth({ roles })` must compare against **uppercase**. Writing `roles: ['manager']` will silently 403 everything.

### 3. `verify-email` is deliberately CSRF-exempt

It's reached by clicking a link in an email client — a cross-origin navigation by design. The single-use, time-limited token is the security boundary. Adding `validateCSRF()` there breaks verification links.

### 4. Verified reviews use `PropertyReview.leaseId`, not a boolean

Set **once at creation time** (query for any `Lease` where `tenantId = session.sub` on a unit of this property). Never re-checked at read time — a review shouldn't lose its badge when the lease later expires. `leaseId IS NOT NULL` = verified.

### 5. `Lease.rentAmount` is per payment _cycle_, not per month

An `ANNUAL` lease's `rentAmount` is the full year's rent. Renamed from `monthlyRent` precisely because that was ambiguous. Don't multiply by 12 anywhere.

### 6. Renewals are `Notice`, not a `LeaseStatus`

`LeaseStatus` is `PENDING | ACTIVE | EXPIRED | TERMINATED` — there is no `PENDING_RENEWAL`, on purpose. A lease under renewal negotiation is still `ACTIVE`.

"Leases in renewal" =

```
Lease.status = ACTIVE AND Notice(type: RENEWAL_OFFER, status IN [SENT, VIEWED, COUNTERED])
```

On acceptance: create a **new** `Lease` with `renewedFromId` → old lease, set old to `EXPIRED`.

Rationale: a renewal is a multi-step negotiation (offer → counter → offer → accept) over weeks. That's naturally one-to-many, which `Notice` already models. Collapsing it into one enum value on `Lease` loses the history.

### 7. Maintenance category nullability differs by model — intentional

- `MaintenanceRequest.categoryId` — **nullable**. Tenants submit before AI triage assigns a category (PRD §5.1).
- `MaintenanceSchedule.categoryId` — **required**. Staff create these deliberately for a known category.

`MaintenanceCategory` is a **table**, not an enum (admin-editable without a migration). Seven seeded defaults: Plumbing, Electrical, HVAC, Structural, Appliance, Cleaning, Other.

### 8. Vendor reputation is computed at query time

No cached `reputationScore` column on `VendorProfile` — use `AVG(VendorRating.rating)`. Only add a cached column if profiling shows it's a real bottleneck.

### 9. `Property` has no price column

Rent lives on `Unit.rentAmount`. Price filters go through the relation:

```typescript
units: { some: { rentAmount: { gte: minPrice, lte: maxPrice } } }
```

### 10. `sqft` (API) ↔ `squareFeet` (DB)

DB column is `squareFeet`. API accepts and returns `sqft`. Alias at the serialization boundary only — don't accept both on input.

### 11. `invoiceNumber` is DB-generated

```prisma
@default(dbgenerated("('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)))"))
```

No application code generates it. It's `@unique`, so handle the (vanishingly rare) collision as a retry on insert conflict.

### 12. `AccessLog` vs `AuditLog` — different tables, different purposes

- `AccessLog` → gate events (grant/deny/expired attempt) on a specific `AccessCode`
- `AuditLog` → generic cross-cutting: role changes, property transfers, invoice edits, admin overrides

---

## Auth architecture

Access token (JWT, `jose`, 15 min, Edge-compatible) + opaque refresh token (32 random bytes, SHA-256 hashed in DB, 7 days).

**Cookies** (`lib/auth/cookies.ts`):

- `access_token` — `path=/`, HttpOnly, SameSite=Lax
- `refresh_token` — `path=/api/v1/auth/refresh`, HttpOnly, SameSite=Lax

Cookie deletion **must match path exactly** or the browser ignores it.

**Refresh rotation** (`/api/v1/auth/refresh`): atomic `updateMany` on `{ tokenHash, revokedAt: null, expiresAt: { gt: now } }`. If `count === 0` and the token exists with `revokedAt` set → **reuse detected** → revoke the entire `familyId`. This is the security-critical path; the atomicity is what prevents two concurrent refreshes both minting tokens. Don't refactor it into a read-then-write.

**CSRF** (`lib/auth/csrf.ts`): Origin/Host match, `Referer` fallback, deny-by-default when both are missing. Applied to all mutating auth routes except `verify-email` (see rule 3).

**Rate limiting** (`lib/auth/rateLimit.ts`): DB-backed via `LoginAttempt`, 5 attempts / 5 min. `getClientIp()` splits the `x-forwarded-for` proxy chain — note that header is client-suppliable behind a misconfigured proxy.

**Client refresh**: two mechanisms, both needed —

- `hooks/useAuthRefresh.ts` — proactive timer, 13 min, re-checks `/me` before redirecting (prevents cross-tab logout races)
- `lib/apiClient.ts` — reactive 401 interceptor with single-flight dedup (`refreshPromise`), catches what the timer misses when a tab is backgrounded and `setInterval` is throttled

---

## Resolved (was "Known bugs — fix before Phase 1")

All fixed during the pages-separation phase — kept as a record, not a to-do: session-dies-on-reload (`AuthContext` now attempts `/api/v1/auth/refresh` before clearing `user`), `/login` 404 (all redirects go to `/`, which is a real route — auth screens are real pages now, not client state inside a deleted `App.tsx`), hardcoded `JWT_SECRET`/DB connection string (both throw if unset in production), demo login creds (gated behind `NODE_ENV !== 'production'`), `RoleSwitcher` (same gate, lives in `app/dashboard/DashboardChrome.tsx` now).

---

## Known gaps — deliberate, not bugs

Each of these was flagged during the phase that found it rather than silently guessed at, because building the wrong default would have been worse than leaving the gap open:

- **`Unit.status` doesn't update when a lease is created or activated** (Phase 3) — a newly-tenanted unit stays `VACANT` in the data model. The exact state-transition rules (when to move to `OCCUPIED`, what happens on `TERMINATED`/`EXPIRED`) were never defined.
- **`AccessCode` never auto-transitions to `USED`** (Phase 5) — the schema has a `USED` status but no flag distinguishing a single-use guest code from a deliberately reusable permanent one. Guessing either default risks breaking the other use case.
- **Maintenance request image upload is display-only** (Phase 7) — no file-storage endpoint exists anywhere; `mediaUrls` is always submitted empty.
- **`VendorCreateInvoice`'s submit never PATCHes the maintenance request to `COMPLETED`** (Phase 9.4) — it only creates the invoice, so a completed job can keep showing as open in stat counts until someone separately updates its status. Flagged during vendor-view hydration, left alone as outside that sub-phase's declared scope.
- ~~**Background workers (Phase 8) are built and tested but not scheduled anywhere**~~ — **resolved.** `vercel.json` runs `/api/v1/cron/all` daily (Vercel's Hobby plan allows only 2 daily crons, fewer than the 5 workers, so one scheduled job fans out to all of them in dependency order). The route now accepts `GET` + `Authorization: Bearer` (what Vercel Cron sends) as well as the original `POST` + `x-cron-secret`. See `DEPLOYMENT.md` §4.
- **Rent Invoicer advances one billing cycle per run**, not all overdue cycles at once — a lease several cycles behind catches up gradually across multiple runs. Deliberate, not a bug — see `docs/development-history/phases/domain-api-phase-8-background-workers.md`.
- **`paymentReliabilityScorer.ts`'s scoring is a documented heuristic, not ML** — the PRD describes "late payment prediction" as an AI capability with no formula specified anywhere in the repo. The heuristic (on-time/late/missed ratio) is explicitly commented as a stand-in, not a finished feature.

---

## Deployment

See `DEPLOYMENT.md` — Vercel + GitHub Actions, env vars, cron, migrations.

Two things there are easy to trip over:

- **`DATABASE_URL`, `JWT_SECRET` and `CRON_SECRET` are needed at BUILD time**, not just runtime. `lib/db.ts`, `lib/auth/jwt.ts` and `lib/workers/auth.ts` each throw at module load when their secret is missing under `NODE_ENV=production`, and `next build` sets that. A missing one fails the build, not the request.
- **Never hardcode a base URL in an email.** Use `appUrl()` from `lib/appUrl.ts`; it resolves `NEXT_PUBLIC_APP_URL` → Vercel's own domain vars → localhost. Every outbound-email link used to be `http://localhost:3000`.

---

## Deliberately deferred

- **Real email delivery** — `lib/email.ts` exists and works (console-transport: logs instead of sending), used by the Phase 7 tenant-invite flow. Swapping in a real provider (Resend/Postmark/SES) is a one-function change now that the interface exists. Separately, **self-registration still has no verification flow**: `register` sets `status: ACTIVE` directly and creates no `VerificationToken`. **When wiring real self-registration email: flip `register` to `PENDING_VERIFICATION` and relax the `login` 403 in the same commit**, or every new signup is locked out. (`app/api/v1/auth/verify-email/route.ts` already accepts an optional `password` alongside `token`, and `app/verify-email/page.tsx` already exists — both were built for the tenant-invite flow and are reusable here.)
- **Redis blocklist** for instant session revocation — 15-min TTL bounds exposure; revisit only if instant kill becomes a product requirement.
- **Real-time messaging** — v1 uses polling. WebSocket/SSE deferred.
- **`SERVICE_CHARGE` invoice type** — removed; only `ASSOCIATION_FEE` is in PRD scope. Additive to re-add later if a real requirement appears.
- **OAuth / social login / Clerk / Kinde** — designed (see `auth-implementation-plan.md` §9–10) but not built. Design principle if built: OAuth only authenticates; our own `RefreshToken` + `setAuthCookies` still issues the session. Never auto-link accounts by unverified email (account-takeover vector). PKCE + `state` are mandatory.
- **`Subscription` model** — exists in schema but is **not in the PRD**. Built from admin-UI mock evidence only. Confirm with product before building billing on it.
- **Actually scheduling the Phase 8 background workers** — see "Known gaps" above.
- **Automated test suite** — no Jest/Vitest/Playwright/Cypress anywhere, no CI. Every phase was verified manually via `curl` against the live dev server.

---

## Schema layout

`prisma/schema/` — multi-file:

| File                   | Contents                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.prisma`          | generator + datasource **only**, no models                                                                                                                             |
| `auth.prisma`          | `User`, `VendorProfile`, `KycVerification`, `Note`, `Subscription`, `BankAccount`, `RefreshToken`, `VerificationToken`, `LoginAttempt`                                 |
| `property.prisma`      | `Property`, `Unit`, `NeighbourhoodReport`, `PropertyViewing`, `PropertyReview`, `Announcement`, `Violation`, `Equipment`, `ConditionReport`, `AccessCode`, `AccessLog` |
| `lease.prisma`         | `Lease`, `Notice`                                                                                                                                                      |
| `operations.prisma`    | `MaintenanceCategory`, `MaintenanceRequest`, `MaintenanceSchedule`, `VendorRating`                                                                                     |
| `financial.prisma`     | `Invoice`, `Payment`, `AutoPayMandate`                                                                                                                                 |
| `communication.prisma` | `Conversation`, `ConversationParticipant`, `Message`                                                                                                                   |
| `audit.prisma`         | `AuditLog`                                                                                                                                                             |

Keep `base.prisma` config-only — new models go in a domain file.

**Enum values** (get these exactly right — past plans repeatedly invented values that don't exist):

- `UnitStatus`: `VACANT | OCCUPIED | MAINTENANCE | RESERVED` (not `UNDER_MAINTENANCE`)
- `LeaseStatus`: `PENDING | ACTIVE | EXPIRED | TERMINATED`
- `NoticeType`: `RENEWAL_OFFER | RENT_INCREASE | DEFAULT_NOTICE | EXPIRATION_ALERT | PAYMENT_REMINDER | TERMINATION_NOTICE`
- `InvoiceType`: `RENT | MAINTENANCE | SECURITY_DEPOSIT | UTILITY | LATE_FEE | ASSOCIATION_FEE | SUBSCRIPTION`
- `MaintenanceStatus`: `SUBMITTED | IN_PROGRESS | SCHEDULED | COMPLETED | CANCELLED`

Check the schema file before using an enum value — don't infer it from a plan doc.

**Multi-FK models needing app-level validation** (Prisma can't express "at least one of"):

- `Invoice` — one of `leaseId` / `maintenanceRequestId` / `userId`
- `Equipment` — one of `unitId` / `propertyId`

---

## Shared API infrastructure (`lib/api/`)

Built in Phase 0, used by every domain route since:

- `lib/api/withAuth.ts` — HOF wrapping handlers with `getServerSession()` + role check → 401/403
- `lib/api/pagination.ts` — `parsePagination`/`buildMeta` (page/limit) and `parseCursorPagination`/`buildCursorMeta` (cursor mode, added in Phase 6 for message history)
- `lib/api/errors.ts` — maps Prisma `P2002`/`P2025`/`P2003` to HTTP status
- `lib/api/validate.ts` — Zod wrapper, 400 with field errors
- `lib/api/propertyAccess.ts` — `canManageProperty()` (ADMIN or the property's own manager/landlord) and `serializeUnit()` (`squareFeet` → `sqft`), reused across properties, leases, maintenance, and invoices

---

## Testing

`pnpm test` (Vitest, `tests/`) — 214 tests across 13 files, roughly one per domain. Run in CI against a `postgres:18` service container on every PR (`.github/workflows/ci.yml`). Full plan and rationale in `docs/development-history/phase-10-test-suite-plan.md`; per-sub-phase writeups in `docs/development-history/phases/domain-api-phase-10-*.md`.

**Real HTTP against a real spawned server, not direct handler imports.** `getServerSession()` needs the Next.js request-scoped `AsyncLocalStorage` context, which doesn't exist if a route handler is imported and called directly — so `tests/setup/globalSetup.ts` spawns a real `next dev` process and every test hits it over `fetch` (`tests/helpers/client.ts`'s `apiFetch()`), the same way every phase's manual `curl` verification always has.

**A dedicated `proplity_test_db`**, not the seeded dev database — dropped and recreated on every `pnpm test` run (`tests/setup/globalSetup.ts`), migrated via `prisma migrate deploy`. Configure via `.env.test` (gitignored; copy `.env.test.example`). Never points at the same database as `.env`.

**Next 16 quirk worth knowing**: a single `next dev` process is allowed per `distDir` (an OS-level lockfile). The test server sets `NEXT_TEST_DIST_DIR=.next-test` (wired into `next.config.mjs`'s `distDir`) so it can run alongside a developer's own `pnpm dev` without conflict.

**Fixtures** (`tests/helpers/fixtures.ts`) write directly via a test-side Prisma client (`tests/helpers/db.ts`'s `testPrisma`, separate from the app's `lib/db.ts` singleton), never through the API — keeps each test's assertions about the route actually under test. `resetDb()` truncates every table (discovered dynamically from `information_schema`, not a hardcoded list) once per test file's `beforeAll`.

**Auth in tests**: `tests/helpers/auth.ts`'s `authCookie(userId, role)` mints a real JWT directly via the app's own `signAccessToken()`, bypassing login for every test file except `auth.test.ts` itself (where login is literally what's under test) — keeps other domains' tests fast and independent of the DB-backed login rate limiter.

**Known, deliberate gaps in coverage**: `/payments/initialize`'s actual call to Paystack's API (would be a live network call to an external service — matches the documented gap above) and any interactive browser behavior (no browser-automation tool available in this environment).

---

## What's next

All 6 domain-API phases, background workers, frontend hydration (Phase 9), and the automated test suite (Phase 10) are done. See `docs/development-history/next-phase-analysis.md` for the original prioritized proposal — only Finding 4 remains: a punch list of real Paystack test-mode key, real email provider, cron scheduling, and the `Unit.status`/`AccessCode.USED` gaps.

---

## Conventions

- API version prefix `/api/v1/` on everything
- Route handlers: `validateCSRF` → rate limit → auth → validate → business logic
- Soft-delete/archive over hard delete throughout (`isPublished = false`, `status = REVOKED`, `revokedAt`)
- Prisma client is a singleton from `lib/db.ts` (`@prisma/adapter-pg` driver adapter) — don't instantiate `new PrismaClient()`
- Currency is NGN; `lib/utils.ts` has `fmtNaira()`
- Prefer explicit enums/relations over booleans for anything with more than two real states — this codebase has repeatedly upgraded booleans (`isUsed` → `AccessCodeStatus`, `isVerified` → `leaseId` FK)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
