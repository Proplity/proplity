# CLAUDE.md — Proplity

Project context for Claude Code. Read this before making changes.

Proplity is an AI-native rental/property management platform for the Nigerian market. Next.js 16.3.2 (App Router), TypeScript, PostgreSQL 18, Prisma ORM.

---

## Current state

All 8 phases of the domain-API roadmap (`docs/development-history/domain-api-implementation-plan.md`) plus Phase 9 (frontend read-path hydration, `docs/development-history/next-phase-analysis.md` Finding 2) and Phase 10 (automated test suite, Finding 3) are **complete**, and so is the post-roadmap work recorded under "Since the roadmap" below — 73 API routes, 48 page routes, 5 background workers (scheduled), 247 Vitest tests + 36 Playwright tests, 40 Prisma models, all live-tested against the real dev server and a real database. Full history in `docs/development-history/phases/*.md`, one doc per phase. Day-to-day state, counts and the changelog live in `CURRENT_STATE.md`.

| Subsystem                                                                                                                                                                                        | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema (40 models, 10 files, 15 migrations)                                                                                                                                               | Done, migrated, seeded                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Auth API (`/api/v1/auth/*`, 10 routes)                                                                                                                                                           | Done. `login`, `logout`, `refresh`, `register`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`, `me` (GET + PATCH, incl. the tenant-profile fields). Hardened after an independent review (2026-09-30) — see "Auth architecture"                                                                                                                                                                                   |
| Domain APIs (properties, maintenance, leases, invoices/payments, access-codes, conversations, vendors, applications, manager-codes, bank-accounts, notifications, subscriptions, uploads, admin) | Done — Phases 1–6, extended in Phase 9 and by the post-roadmap features below                                                                                                                                                                                                                                                                                                                                                                                     |
| Background workers (rent invoicer, overdue flagger, maintenance dispatcher, access-code janitor, payment-reliability scorer)                                                                     | Done — Phase 8, **scheduled**: `vercel.json` runs `/api/v1/cron/all` daily (Hobby-plan limits mean one job fans out to all 5 in dependency order). See `DEPLOYMENT.md` §4 and `docs/development-history/phases/domain-api-phase-8-background-workers.md`. The rent invoicer also emits the recurring `SERVICE_CHARGE` invoice line                                                                                                                                |
| Paystack (checkout init, webhook, autopay)                                                                                                                                                       | Done. `/payments/initialize`'s call to Paystack's live API has never run against a real test-mode account (no key provided) — everything else is tested, and a **mock gateway** (`NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`, see below) exercises the real webhook path locally. Auto-pay: `AutoPayMandate` CRUD plus `GET /payments/authorization`, which derives a reusable card token from a past `charge.success` payload; **no cron actually charges mandates yet** |
| Email                                                                                                                                                                                            | Real delivery via Resend when `RESEND_API_KEY` is set; otherwise console-transport (`lib/email.ts` logs instead of delivering). Self-registration now sends a verification email and starts the account as `PENDING_VERIFICATION`                                                                                                                                                                                                                                 |
| File uploads                                                                                                                                                                                     | Direct-to-Cloudinary (`lib/uploadClient.ts` + `POST /api/v1/uploads/sign`), folders `maintenance-requests`, `applications`, `profile`, `properties`. Without Cloudinary env vars the UI shows a "not available" state instead of silently dropping files                                                                                                                                                                                                          |
| Frontend UI (all 5 roles)                                                                                                                                                                        | Done — every dashboard/detail component reads real data via the hook files in `hooks/` and the typed `api.*` client; every form is wired to a real API. The UI/UX gap audit (2026-09-28 → 10-01) removed every dead `alert()` stub. Only marketing/illustrative pages (`*FeaturePage.tsx`) and `AIAssistant.tsx` still touch `app/store/*` — deliberately out of scope, no real backing exists for either.                                                        |
| Automated tests                                                                                                                                                                                  | Done — Vitest: 247 tests across 15 files in `tests/api/` (`pnpm test`); Playwright: 36 tests in `tests/e2e/` (`pnpm test:e2e`). Both run in CI on every PR. See "Testing" below                                                                                                                                                                                                                                                                                   |
| In-app notifications (bell, feed, toast, sound)                                                                                                                                                  | Done, added after the domain-API roadmap. See `docs/development-history/phases/in-app-notifications.md`                                                                                                                                                                                                                                                                                                                                                           |
| First-run setup wizard (`/setup`, `POST /api/v1/setup`)                                                                                                                                          | Done, added after the domain-API roadmap. Bootstraps the first `ADMIN` on a fresh production database, then self-disables. See `docs/development-history/phases/first-run-setup-wizard.md`                                                                                                                                                                                                                                                                        |

### Since the roadmap

Chronological, each with a phase doc under `docs/development-history/phases/` (older items) or a changelog entry in `CURRENT_STATE.md`:

- **Messaging wired end to end, mobile nav, Playwright suite, `docs/flow-guide.md`** — fixed the `useApiSubmit` stale-closure bug (see "Conventions").
- **Tenant self-registration, in-dashboard property detail, payment-history separation, mock payment gateway, dev email inbox widget, role operational guide.**
- **UI/UX gap audit (2026-09-28 → 10-01)** — service charge (`Unit`/`Lease.serviceCharge`, `InvoiceType.SERVICE_CHARGE`), multi-unit property listings, tenant profile gate + 3-step application, admin property-moderation queue, role-scoped "Properties" nav (manager "My Properties", tenant "My Rentals"), and every dead `alert()` stub wired: Renew Lease, Send Notice, Send Invoice, `ListProperty` media upload, tenant auto-pay, landlord report export / review scheduling, admin Security / Database / Settings tiles. See `docs/development-history/phases/ui-ux-gap-audit.md`.
- **Auth hardening (2026-09-30)** — logout revocation for idle sessions, atomic rate limiting, last-hop client IP, CSRF Origin parsing. See `docs/auth-review-2026-09-30.md` and `docs/development-history/phases/auth-review-hardening.md`.

Roles: `ADMIN`, `MANAGER`, `LANDLORD`, `TENANT`, `VENDOR`.

---

## Commands

```bash
pnpm dev                          # dev server, localhost:3000
pnpm typecheck                    # tsc --noEmit (CI runs this)
pnpm format:check                 # prettier --check . (CI runs this; `pnpm format` to fix)
pnpm build                        # production build (CI runs this)
pnpm db:seed2                     # re-seed (enriched dataset); `pnpm db:seed` is the minimal one
pnpm db:migrate                   # prisma migrate dev — apply schema changes locally
pnpm db:generate                  # regenerate the Prisma client after schema edits
pnpm test                         # Vitest API suite (see "Testing" below)
pnpm test:e2e                     # Playwright UI suite (needs a seeded DB + running app)
```

Before opening a PR, run `pnpm typecheck && pnpm format:check` — CI fails the whole PR on a single unformatted file, including generated ones (`docs/proplity-guide.html` is in `.prettierignore` for exactly that reason).

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

### 3. `verify-email` and `reset-password` are deliberately CSRF-exempt

Both are reached by clicking a link in an email client — a cross-origin navigation by design. The single-use, time-limited token is the security boundary, not Origin matching. Adding `validateCSRF()` to either breaks the link. Every other new auth route (`forgot-password`, `resend-verification`, `PATCH /me`) is a normal same-origin form submit and _is_ CSRF-checked.

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

Known cosmetic quirk: because this default is a raw `dbgenerated()` SQL string, Postgres re-normalizes its stored text slightly differently than the schema's literal string compares against. Every `prisma migrate dev --create-only` since this field existed re-emits a no-op `ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT (...)` line restating the identical default. Harmless — don't mistake it for real drift when reviewing a new migration's diff.

### 12. `AccessLog` vs `AuditLog` — different tables, different purposes

- `AccessLog` → gate events (grant/deny/expired attempt) on a specific `AccessCode`
- `AuditLog` → generic cross-cutting: role changes, property transfers, invoice edits, admin overrides

---

## Auth architecture

Access token (JWT, `jose`, 15 min, Edge-compatible) + opaque refresh token (32 random bytes, SHA-256 hashed in `RefreshToken`, with a `familyId` for rotation/reuse detection). The refresh token lives **30 days** when `rememberMe` is true (the login default) or **1 day** when false (`login/route.ts`); rotation inherits the old row's `expiresAt` rather than extending it, and the cookie's `maxAge` is set to the remaining lifetime.

**Cookies** (`lib/auth/cookies.ts`):

- `access_token` — `path=/`, HttpOnly, SameSite=Lax
- `refresh_token` — `path=/api/v1/auth/refresh`, HttpOnly, SameSite=Lax

Cookie deletion **must match path exactly** or the browser ignores it. Because of that path scoping, the refresh cookie is **never sent to `/logout`** — see "Logout" below.

**Refresh rotation** (`/api/v1/auth/refresh`): atomic `updateMany` on `{ tokenHash, revokedAt: null, expiresAt: { gt: now } }`. If `count === 0` and the token exists with `revokedAt` set → **reuse detected** → revoke the entire `familyId`. This is the security-critical path; the atomicity is what prevents two concurrent refreshes both minting tokens. Don't refactor it into a read-then-write.

**Logout** (`/api/v1/auth/logout`): identifies whose refresh tokens to revoke by decoding `access_token` via `getExpiredSession()` — **not** `getServerSession()`. `verifyTokenAllowExpired()` (`lib/auth/jwt.ts`) accepts a signature-valid but _expired_ JWT, for this one cleanup purpose only, never for authorization. Using the strict helper silently skipped revocation for any tab idle past 15 minutes (browser looked logged out, the DB refresh token stayed valid). The expiry check is done with `err.code === 'ERR_JWT_EXPIRED'`, **not** `instanceof errors.JWTExpired` — Next.js can bundle `jose` into more than one module instance across the route-handler/library boundary and silently break `instanceof`.

**CSRF** (`lib/auth/csrf.ts`): Origin/Host match, `Referer` fallback, deny-by-default when both are missing; a malformed `Origin` header fails closed (403) rather than throwing. Applied to all mutating auth routes except `verify-email` and `reset-password` (see rule 3).

**Rate limiting** (`lib/auth/rateLimit.ts`): DB-backed via `LoginAttempt`, **atomic** via `reserveAttempt(identifier, userId?, maxAttempts?)` / `releaseAttempt(attemptId)`. `reserveAttempt` takes a Postgres advisory lock scoped to the identifier (`pg_advisory_xact_lock(hashtext(identifier))`) inside a transaction, counts the window, and inserts the reservation in one atomic step — the old check-then-record pair let N concurrent requests all pass the count check before any had recorded. It is called **before** any slow work (bcrypt, DB writes, email). A route that shouldn't count a given outcome (e.g. a successful login) calls `releaseAttempt` to delete the reservation, which preserves each route's "only failures count" semantics. Limits: 5 attempts / 5 min by default; `refresh` uses `REFRESH_MAX_ATTEMPTS = 30` because it is a periodic background call from every authenticated tab, not a credential-guessing surface (the first version of the fix used 5 and broke the E2E suite under CI's shared IP). Used by `login`, `register`, `forgot-password`, `resend-verification`, `refresh` and `setup`. `getClientIp()` returns the **last** `x-forwarded-for` hop, not the first: each hop appends the IP it saw, so with a single trusted proxy (Vercel's edge) the last entry is what the trusted edge observed and the first is whatever the client sent. Don't switch it back to `[0]` — that made every per-IP limit bypassable.

**Client refresh**: two mechanisms, both needed —

- `hooks/useAuthRefresh.ts` — proactive timer, 13 min, re-checks `/me` before redirecting (prevents cross-tab logout races)
- `lib/apiClient.ts` — reactive 401 interceptor with single-flight dedup (`refreshPromise`), catches what the timer misses when a tab is backgrounded and `setInterval` is throttled

**Edge guard** (`proxy.ts`, Next 16's rename of `middleware.ts`): only inspects the short-lived `access_token` cookie for `/dashboard/*` and `/admin/*`. A request after 15+ minutes idle is bounced to `/?from=…`; `app/HomeLanding.tsx` waits for `AuthContext`'s silent refresh and then returns the user to `from` (validated by `lib/safeRedirect.ts`, same-origin relative paths only, shared with `/login`).

**Registration**: `register` creates the user as `PENDING_VERIFICATION` with a 7-day `VerificationToken` and emails a link (`verify-email`); `login` 403s that status with a "verify your email" message and `resend-verification` re-sends. Self-registerable roles are `TENANT`, `LANDLORD`, `MANAGER`, `VENDOR` — **`ADMIN` can never be self-registered** (admins come from the `/setup` wizard or are provisioned out-of-band). A `MANAGER` sign-up must carry a valid, unredeemed landlord invite code (`ManagerInviteCode`, issued from the landlord dashboard; `GET /manager-codes/check` is a UX preview only — `register` re-validates and links it in the same transaction).

## Resolved (was "Known bugs — fix before Phase 1")

All fixed during the pages-separation phase — kept as a record, not a to-do: session-dies-on-reload (`AuthContext` now attempts `/api/v1/auth/refresh` before clearing `user`), `/login` 404 (all redirects go to `/`, which is a real route — auth screens are real pages now, not client state inside a deleted `App.tsx`), hardcoded `JWT_SECRET`/DB connection string (both throw if unset in production), demo login creds (gated behind `NODE_ENV !== 'production'`), `RoleSwitcher` (same gate, lives in `app/dashboard/DashboardChrome.tsx` now).

---

## Known gaps — deliberate, not bugs

Each of these was flagged during the phase that found it rather than silently guessed at, because building the wrong default would have been worse than leaving the gap open:

- **Auto-pay never actually charges.** `AutoPayMandate` rows are created and cancelled for real (and `GET /payments/authorization` derives a reusable Paystack `authorization_code` from the tenant's own past `charge.success` payload — there is no card-entry UI, and building one is a PCI-scope decision), but no worker bills a mandate each cycle. `nextChargeDate`/`lastChargedAt` stay unset.
- **`/payments/initialize`'s call to Paystack's live API has never run** against a real test-mode account — no key has been provided. The mock gateway covers everything downstream of it.
- **No meeting/appointment model.** The landlord dashboard's "Schedule Review" starts a direct message to the property's manager instead; there is no calendar object behind it.
- **`AuditLog` has one writer.** Only the first-run setup wizard writes to it, so `/admin/security` is a real viewer over a nearly-empty table. The "Database (backups & logs)" tile on the admin dashboard is an honest explanation that this is infrastructure-level, not an app feature — no backup/restore or query-log storage exists in the app.
- **"Photos of Every Room" is a single column.** `Property` has `imageUrl`, `video360Url`, `exteriorPhotoUrl` only; the listing form accepts many room photos but persists the first as `imageUrl` and keeps the rest as a local count.
- **Rent Invoicer advances one billing cycle per run**, not all overdue cycles at once — a lease several cycles behind catches up gradually across multiple runs. Deliberate, not a bug — see `docs/development-history/phases/domain-api-phase-8-background-workers.md`.
- **`paymentReliabilityScorer.ts`'s scoring is a documented heuristic, not ML** — the PRD describes "late payment prediction" as an AI capability with no formula specified anywhere in the repo. The heuristic (on-time/late/missed ratio) is explicitly commented as a stand-in, not a finished feature.
- **Admin notifications** — the screen is real, but no platform event currently triggers a notification _to_ an admin.

**Resolved since the original list** (kept so nobody re-reports them): `Unit.status` now moves to `OCCUPIED` on lease activation and back to `VACANT` on termination/expiry (`leases/[id]/route.ts`); `AccessCode` auto-transitions to `USED` when `singleUse` (default true) — reusable gate codes set `singleUse: false`; maintenance photos upload for real via Cloudinary; `VendorCreateInvoice` completes the job automatically via the admin-controlled `autoCompleteMaintenanceOnInvoice` setting (`/admin/settings`); background workers are scheduled (`vercel.json` → `/api/v1/cron/all` daily; the route accepts `GET` + `Authorization: Bearer` as sent by Vercel Cron as well as `POST` + `x-cron-secret`).

---

## Deployment

See `DEPLOYMENT.md` — Vercel + GitHub Actions, env vars, cron, migrations.

Two things there are easy to trip over:

- **`DATABASE_URL`, `JWT_SECRET` and `CRON_SECRET` are needed at BUILD time**, not just runtime. `lib/db.ts`, `lib/auth/jwt.ts` and `lib/workers/auth.ts` each throw at module load when their secret is missing under `NODE_ENV=production`, and `next build` sets that. A missing one fails the build, not the request.
- **Feature flags are `NEXT_PUBLIC_*`, so they are inlined at build time** — flipping `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`, `NEXT_PUBLIC_EMAIL_INBOX_ENABLED`, `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED`, `NEXT_PUBLIC_SETUP_REDIRECT_ENABLED` or the `NEXT_PUBLIC_CLOUDINARY_*` pair in Vercel needs a redeploy, not a restart. `.env.example` documents every variable.
- **Never enable the mock payment gateway or the dev email inbox on a real deployment.** `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED=true` only takes effect when `PAYSTACK_SECRET_KEY` is unset (a real key always wins), but `NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true` exposes every sent email through unauthenticated `GET/DELETE /api/v1/dev/emails`.
- **Never hardcode a base URL in an email.** Use `appUrl()` from `lib/appUrl.ts`; it resolves `NEXT_PUBLIC_APP_URL` → Vercel's own domain vars → localhost. Every outbound-email link used to be `http://localhost:3000`.

---

## Deliberately deferred

- **Real email delivery is built but only live when configured** — `lib/email.ts` sends via Resend when `RESEND_API_KEY` is set and falls back to console-transport otherwise. Self-registration verification, password reset, resend-verification and tenant invites all go through it.
- **Redis blocklist** for instant session revocation — 15-min TTL bounds exposure; revisit only if instant kill becomes a product requirement. (Logout does revoke the DB refresh token, so a signed-out session can't be silently renewed.)
- **Real-time messaging** — v1 uses polling (`useMessages`, 5 s). WebSocket/SSE deferred.
- **`SERVICE_CHARGE` invoice type** — ~~removed~~ **re-added 2026-09-28** (migration `20260928085653_add_service_charge`): `serviceCharge` on `Unit` (advertised) and `Lease` (contracted), generated as its own `InvoiceType.SERVICE_CHARGE` invoice line (initial + recurring via `lib/workers/rentInvoicer.ts`), never merged into `RENT`'s amount. `ASSOCIATION_FEE` remains separately in scope as before.
- **Add Tenant form's "Agency Fee" field** — removed 2026-09-28 (with "Security Deposit"). It was never wired to anything (captured in form state, never submitted, no schema field). If a real agency-fee requirement appears, it needs a schema field from scratch, not just a form field restored.
- **Recurring auto-charge for `AutoPayMandate`** — see "Known gaps".
- **OAuth / social login / Clerk / Kinde** — designed (see `docs/auth-implementation-plan.md` §9–10) but not built. Design principle if built: OAuth only authenticates; our own `RefreshToken` + `setAuthCookies` still issues the session. Never auto-link accounts by unverified email (account-takeover vector). PKCE + `state` are mandatory.
- **`Subscription` model** — exists in schema but is **not in the PRD**. Built from admin-UI mock evidence only; checkout is behind `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED` and off by default. Confirm with product before building billing on it.

---

## Schema layout

`prisma/schema/` — multi-file, 40 models, 15 migrations:

| File                   | Contents                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.prisma`          | generator + datasource **only**, no models                                                                                                                                                                      |
| `auth.prisma`          | `User` (incl. tenant-profile fields), `VendorProfile`, `KycVerification`, `Note`, `Subscription`, `ManagerInviteCode`, `BankAccount`, `RefreshToken`, `VerificationToken`, `PasswordResetToken`, `LoginAttempt` |
| `property.prisma`      | `Property`, `AdCampaign`, `Unit`, `NeighbourhoodReport`, `PropertyViewing`, `PropertyReview`, `Announcement`, `Violation`, `Equipment`, `ConditionReport`, `AccessCode`, `AccessLog`                            |
| `lease.prisma`         | `Lease`, `LeaseSignature`, `Notice`, `Application`                                                                                                                                                              |
| `operations.prisma`    | `MaintenanceCategory`, `MaintenanceRequest`, `MaintenanceSchedule`, `VendorRating`                                                                                                                              |
| `financial.prisma`     | `Invoice`, `Payment`, `AutoPayMandate`                                                                                                                                                                          |
| `communication.prisma` | `Conversation`, `ConversationParticipant`, `Message`                                                                                                                                                            |
| `audit.prisma`         | `AuditLog`                                                                                                                                                                                                      |
| `notification.prisma`  | `Notification`                                                                                                                                                                                                  |
| `system.prisma`        | `SystemSettings` (singleton, `id = 'global'`) — guards the `/setup` first-run admin wizard and holds platform toggles (`autoCompleteMaintenanceOnInvoice`)                                                      |

Keep `base.prisma` config-only — new models go in a domain file.

**Enum values** (get these exactly right — past plans repeatedly invented values that don't exist):

- `UnitStatus`: `VACANT | OCCUPIED | MAINTENANCE | RESERVED` (not `UNDER_MAINTENANCE`)
- `LeaseStatus`: `PENDING | ACTIVE | EXPIRED | TERMINATED`
- `NoticeType`: `RENEWAL_OFFER | RENT_INCREASE | DEFAULT_NOTICE | EXPIRATION_ALERT | PAYMENT_REMINDER | TERMINATION_NOTICE`
- `InvoiceType`: `RENT | MAINTENANCE | SECURITY_DEPOSIT | UTILITY | LATE_FEE | ASSOCIATION_FEE | SUBSCRIPTION | SERVICE_CHARGE`
- `MaintenanceStatus`: `SUBMITTED | IN_PROGRESS | SCHEDULED | COMPLETED | CANCELLED`
- `AutoPayStatus`: `ACTIVE | PAUSED | CANCELLED`
- `PaymentProvider`: `PAYSTACK | FLUTTERWAVE | BANK_TRANSFER | CASH | CHECK`

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

Other shared modules worth knowing: `lib/uploadClient.ts` + `lib/cloudinary.ts` (signed direct-to-Cloudinary uploads), `lib/tenantProfile.ts` (the completeness gate for tenant applications), `lib/csv.ts` / `lib/xlsx.ts` (property/unit import-export), `lib/payments/mockGateway.ts` (local Paystack stand-in), `lib/notifications.ts` (`notifyUser`/`notifyUsers`), `lib/systemSettings.ts`, `lib/appUrl.ts`, `lib/safeRedirect.ts`.

---

## Testing

`pnpm test` (Vitest, `tests/api/`) — 247 tests across 15 files, roughly one per domain (`auth`, `properties`, `maintenance`, `leases`, `financial`, `access-control`, `communications`, `vendors-and-admin`, `deferred-flows`, `orphaned-models`, `csv-excel-import-export`, `e-signature`, `notifications`, `setup`, `health`). Run in CI against a `postgres:18` service container on every PR (`.github/workflows/ci.yml`: `Typecheck, format & build`, `Integration tests`, `E2E (Playwright)`). Full plan and rationale in `docs/development-history/phase-10-test-suite-plan.md`; per-sub-phase writeups in `docs/development-history/phases/domain-api-phase-10-*.md`.

**Real HTTP against a real spawned server, not direct handler imports.** `getServerSession()` needs the Next.js request-scoped `AsyncLocalStorage` context, which doesn't exist if a route handler is imported and called directly — so `tests/setup/globalSetup.ts` spawns a real `next dev` process and every test hits it over `fetch` (`tests/helpers/client.ts`'s `apiFetch()`), the same way every phase's manual `curl` verification always has.

**A dedicated `proplity_test_db`**, not the seeded dev database — dropped and recreated on every `pnpm test` run (`tests/setup/globalSetup.ts`), migrated via `prisma migrate deploy`. Configure via `.env.test` (gitignored; copy `.env.test.example`). Never points at the same database as `.env`.

**Next 16 quirk worth knowing**: a single `next dev` process is allowed per `distDir` (an OS-level lockfile). The test server sets `NEXT_TEST_DIST_DIR=.next-test` (wired into `next.config.mjs`'s `distDir`) so it can run alongside a developer's own `pnpm dev` without conflict.

**Fixtures** (`tests/helpers/fixtures.ts`) write directly via a test-side Prisma client (`tests/helpers/db.ts`'s `testPrisma`, separate from the app's `lib/db.ts` singleton), never through the API — keeps each test's assertions about the route actually under test. `resetDb()` truncates every table (discovered dynamically from `information_schema`, not a hardcoded list) once per test file's `beforeAll`.

**Auth in tests**: `tests/helpers/auth.ts`'s `authCookie(userId, role)` mints a real JWT directly via the app's own `signAccessToken()`, bypassing login for every test file except `auth.test.ts` itself (where login is literally what's under test) — keeps other domains' tests fast and independent of the DB-backed login rate limiter. `expiredAccessCookie()` mints a validly-signed but already-expired token (used by the logout-revocation regression test), and `fillRateLimit` in `fixtures.ts` seeds `LoginAttempt` rows directly (note: a refresh-limit test must seed `REFRESH_MAX_ATTEMPTS`, not 5).

**Playwright UI suite** (`tests/e2e/`, `pnpm test:e2e`) — 36 tests: `smoke/` (marketing, auth forms), `flows/` (per-role: tenant, landlord, vendor, admin; login; session restore after idle; featured-property popup; public-property CTA auth-awareness; the dev email-inbox widget; the mock payment round trip), `responsive/` (mobile tab bar). Runs in CI as its own job against a production build and a seeded Postgres, one worker. Locally it needs `pnpm db:seed2` and a running app (`E2E_BASE_URL`). **`MobileTabBar` shows only the first 3 tabs directly** (the rest fold into "More"), which `responsive/mobile-nav.spec.ts` asserts — when adding a role-scoped nav tab, put it after the existing primary three or update that test deliberately.

**Known, deliberate gaps in coverage**: `/payments/initialize`'s actual call to Paystack's API (would be a live network call to an external service — matches the documented gap above), real Cloudinary uploads (not configured in dev/CI; the UI's "not available" fallback is what's exercised), and recurring auto-charging (not built).

---

## What's next

All 8 domain-API phases, background workers, frontend hydration (Phase 9), the automated test suite (Phase 10) and the UI/UX gap audit are done. Open items:

- **Finding 4 punch list** (`docs/development-history/next-phase-analysis.md`): a real Paystack test-mode key (to run `/payments/initialize` against the live API), and actually charging `AutoPayMandate`s on a schedule.
- **A broader auth/security audit** beyond the 2026-09-30 review (`docs/auth-review-2026-09-30.md`), looking for further hardening.
- Writing to `AuditLog` from the sensitive actions its schema comment lists (role changes, property transfers, invoice edits, admin overrides) — today only first-run setup writes to it.

---

## Conventions

- API version prefix `/api/v1/` on everything
- Route handlers: `validateCSRF` → rate limit → auth → validate → business logic
- Soft-delete/archive over hard delete throughout (`isPublished = false`, `status = REVOKED`, `revokedAt`)
- Prisma client is a singleton from `lib/db.ts` (`@prisma/adapter-pg` driver adapter) — don't instantiate `new PrismaClient()`
- Currency is NGN; `lib/utils.ts` has `fmtNaira()`
- **Write hooks go through `hooks/useApiSubmit.ts`** (`{ submit, submitting, error }`). `submit` is a plain per-render function on purpose: wrapping it in `useCallback(fn, [])` pinned whatever the hook closed over on first render and silently broke `useSendMessage(conversationId)` and `useCreateAdCampaign(propertyId)` once that id changed. Don't "optimise" it back.
- **Replacing a dead button**: check whether a backend already exists first (it usually does — Renew Lease, Send Notice/Invoice, auto-pay were all fully built server-side). If none exists, show an honest explanation or the closest real action (e.g. Schedule Review → direct message); never fake success with a demo button.
- Playwright selectors: this codebase's `<label>`s are plain siblings with no `htmlFor`, so `getByLabel(...)` silently waits out the full timeout — use type/placeholder/positional selectors.
- Prefer explicit enums/relations over booleans for anything with more than two real states — this codebase has repeatedly upgraded booleans (`isUsed` → `AccessCodeStatus`, `isVerified` → `leaseId` FK)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
