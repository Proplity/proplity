# CLAUDE.md — Proplity

> New here or picking this up from another tool? Read `HANDOVER.md` first.

Project context for Claude Code. Read this before making changes.

Proplity is an AI-native rental/property management platform for the Nigerian market. Next.js 16.3.2 (App Router), TypeScript, PostgreSQL 18, Prisma ORM.

---

## Current state

All 8 phases of the domain-API roadmap (`docs/development-history/domain-api-implementation-plan.md`) plus Phase 9 (frontend read-path hydration, `docs/development-history/next-phase-analysis.md` Finding 2) and Phase 10 (automated test suite, Finding 3) are **complete**, and so is the post-roadmap work recorded under "Since the roadmap" below — 103 API routes, 57 page routes, 10 background workers (scheduled), 614 Vitest tests + 71 Playwright tests, 43 Prisma models, all live-tested against the real dev server and a real database. Full history in `docs/development-history/phases/*.md`, one doc per phase. Day-to-day state, counts and the changelog live in `CURRENT_STATE.md`.

| Subsystem                                                                                                                                                                                                    | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma schema (43 models, 11 files, 32 migrations)                                                                                                                                                           | Done, migrated, seeded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Auth API (`/api/v1/auth/*`, 10 routes)                                                                                                                                                                       | Done. `login`, `logout`, `refresh`, `register`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`, `me` (GET + PATCH, incl. the tenant-profile fields). Hardened after an independent review (2026-09-30) — see "Auth architecture"                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Domain APIs (properties, maintenance, leases, invoices/payments, access-codes, conversations, vendors, applications, manager-codes, bank-accounts, notifications, subscriptions, uploads, admin)             | Done — Phases 1–6, extended in Phase 9 and by the post-roadmap features below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Background workers (rent invoicer, overdue flagger, reminders, maintenance dispatcher, access-code janitor, payment-reliability scorer, property trust scorer, retention, storage janitor, auto-pay charger) | Done — Phase 8, **scheduled**: `vercel.json` runs `/api/v1/cron/all` daily (Hobby-plan limits mean one job fans out to all in dependency order). See `DEPLOYMENT.md` §4 and `docs/development-history/phases/domain-api-phase-8-background-workers.md`. The rent invoicer also emits the recurring `SERVICE_CHARGE` invoice line                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Paystack (checkout init, webhook, autopay)                                                                                                                                                                   | Done. `/payments/initialize`'s call to Paystack's live API has never run against a real test-mode account (no key provided; card payments show "not available yet" until `PAYSTACK_SECRET_KEY` is set, then switch on) — everything else is tested, and a **mock gateway** (`NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`, see below) exercises the real webhook path locally. Auto-pay: `AutoPayMandate` CRUD plus `GET /payments/authorization`, which derives a reusable card token from a past `charge.success` payload; the `autopay-charger` cron job charges due invoices on active mandates but is **off until `AUTOPAY_WORKER_ENABLED=true` and an admin switches it on in Platform Settings (ADR-0015)** and has never run against live Paystack |
| Email                                                                                                                                                                                                        | Real delivery via Resend when `RESEND_API_KEY` is set; otherwise console-transport (`lib/email.ts` logs instead of delivering; `sendEmail` returns `{ delivered }` so a caller can tell). The contact page's form emails `CONTACT_EMAIL`. Self-registration now sends a verification email and starts the account as `PENDING_VERIFICATION`                                                                                                                                                                                                                                                                                                                                                                                                      |
| File uploads                                                                                                                                                                                                 | Direct-to-Cloudinary (`lib/uploadClient.ts` + `POST /api/v1/uploads/sign`), folders `maintenance-requests`, `applications`, `profile`, `properties`. Cloudinary is the supported provider (the others are built but unverified, ISS-035). Without Cloudinary env vars the UI shows a "not available" state instead of silently dropping files                                                                                                                                                                                                                                                                                                                                                                                                    |
| Frontend UI (all 5 roles)                                                                                                                                                                                    | Done — every dashboard/detail component reads real data via the hook files in `hooks/` and the typed `api.*` client; every form is wired to a real API. The UI/UX gap audit (2026-09-28 → 10-01) removed every dead `alert()` stub. Only marketing/illustrative pages (`*FeaturePage.tsx`) and `AIAssistant.tsx` still touch `app/store/*` — deliberately out of scope, no real backing exists for either.                                                                                                                                                                                                                                                                                                                                       |
| Automated tests                                                                                                                                                                                              | Done — Vitest: 678 tests across 58 files under `tests/` (`pnpm test`; 110 of them are the mocked unit/fuzz/security/anomaly tests that `pnpm test:unit` runs alone); Playwright: 71 tests in 18 files in `tests/e2e/` (`pnpm test:e2e`). Both run in CI on every PR. See "Testing" below                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| In-app notifications (bell, feed, toast, sound)                                                                                                                                                              | Done, added after the domain-API roadmap. See `docs/development-history/phases/in-app-notifications.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| First-run setup wizard (`/setup`, `POST /api/v1/setup`)                                                                                                                                                      | Done, added after the domain-API roadmap. Bootstraps the first `ADMIN` on a fresh production database, then self-disables. See `docs/development-history/phases/first-run-setup-wizard.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Since the roadmap

Chronological, each with a phase doc under `docs/development-history/phases/` (older items) or a changelog entry in `CURRENT_STATE.md`:

- **Messaging wired end to end, mobile nav, Playwright suite, `docs/flow-guide.md`** — fixed the `useApiSubmit` stale-closure bug (see "Conventions").
- **Tenant self-registration, in-dashboard property detail, payment-history separation, mock payment gateway, dev email inbox widget, role operational guide.**
- **UI/UX gap audit (2026-09-28 → 10-01)** — service charge (`Unit`/`Lease.serviceCharge`, `InvoiceType.SERVICE_CHARGE`), multi-unit property listings, tenant profile gate + 3-step application, admin property-moderation queue, role-scoped "Properties" nav (manager "My Properties", tenant "My Rentals"), and every dead `alert()` stub wired: Renew Lease, Send Notice, Send Invoice, `ListProperty` media upload, tenant auto-pay, landlord report export / review scheduling, admin Security / Database / Settings tiles. See `docs/development-history/phases/ui-ux-gap-audit.md`.
- **Registration flow modernization (2026-10-10 → 11)** — landlord sign-up is 2 steps (banking/property moved to a post-login banner), native `<Link>` navigation in auth screens, email links that resolve to real pages and never trust the request `Host` in production (ADR-0005), emails normalised to lowercase (ADR-0006), manager invitations by email (rate-limited), `registration.spec.ts` covering all four self-registration roles. See `docs/development-history/phases/registration-flow-modernization-and-e2e.md` and `docs/tasks/0001-registration-flow-refactor-and-e2e.md`.
- **Auth hardening (2026-09-30)** — logout revocation for idle sessions, atomic rate limiting, last-hop client IP, CSRF Origin parsing. See `docs/auth-review-2026-09-30.md` and `docs/development-history/phases/auth-review-hardening.md`.
- **Repair follow-through (2026-10-19)** — vendor before/after photos (at least one after photo closes a job, where an upload provider is configured; ISS-116), the tenant's **Confirm fixed** / **Still a problem**, the team's **Approve work** / **Send back to vendor** / **Give to another vendor**, and an admin switch (`SystemSettings.requireTenantRepairConfirmation`, default on). It never touches payment. Rules shared by the vendor PATCH, the vendor invoice, the confirmation and the review live in `lib/maintenanceFlow.ts`; a new way to move a repair between statuses must go through it (open jobs only, claim with `updateMany`). Also fixed the repair page returning whole user rows (`vendor: true, tenant: true` leaked password hashes; select the fields a screen shows), unguarded status changes, message threads not following the vendor, and repair links that opened the manager page for tenants and vendors. See `docs/development-history/phases/repair-follow-through.md`.
- **Offline payments and receipts (2026-10-19)** — a "Paid another way" form (a tenant for their own invoices; the property team on a repair's vendor invoice) that records a bank transfer or cash payment with its reference and an optional receipt file, a transfers list (`/dashboard/reconciliation` for managers and landlords, `/admin/payments` for admins) where someone **other than** the person who recorded it confirms or rejects it, and a receipt for every payment (`Payment.receiptNumber`, database-generated like `invoiceNumber`; `GET /payments/[id]/receipt`, page `/receipts/[id]`, print or save as PDF; 404 for anyone who is not the payer, the payee, the property team or an admin). Confirming creates the `Payment`, pays the invoice and tells the recorder, the tenant and the vendor. **Nobody marks a tenant's or a vendor's invoice paid in one step** (ISS-117, decided 2026-10-20): **Record cash or transfer payment** on a tenant's record opens the same form and waits for a second person, and `POST /invoices/[id]/payments` answers 409 for any invoice with a lease or a repair. The rule is two admin switches in Platform Settings (`SystemSettings.requireSecondPersonForTenantPayments` and `...ForVendorPayments`, both default on, migration `20261020120000_payment_second_person_switches`): off, the **team's** own entry counts at once (`teamEntryNeedsSecondPerson` in `bankTransferService.ts`; audit row marked `confirmedByRecorder`); a tenant's own transfer always waits for the team. The team's forms learn the setting from `GET /settings/payment-rules`; a receipt shows a note only when a person typed one (ISS-118, `lib/payments/transferNote.ts`). Also fixed: the transfers list returned every submission to a vendor, and payment rows (with `rawProviderPayload`) were returned whole by the invoice and lease routes — **always query payments with `PUBLIC_PAYMENT_SELECT`** (`lib/api/paymentSelect.ts`). See `docs/development-history/phases/offline-payments-and-receipts.md` and ISS-103, ISS-111 to ISS-115.
- **Work orders and recurring-schedule screens (2026-10-19)** — the property team can raise a repair itself (`POST /maintenance/requests` for admin, manager, landlord; **Raise a repair** on the Maintenance board), on any unit it looks after, with or without a vendor: a repair may have **no tenant** (`MaintenanceRequest.tenantId` nullable, `createdById`), so nothing asks a tenant to confirm it or rate the vendor; **never assume `request.tenant`**. Recurring maintenance has a screen (`/dashboard/schedules`) and `PATCH`/`DELETE /maintenance/schedules/[id]`; the daily job raises a tenant-less work order for a vacant unit instead of skipping it; schedule dates keep their day of the month (`lib/maintenanceSchedule.ts`; 31 January plus a month used to give 3 March). The decisions were accepted by the owner on 2026-10-20 (ADR-0014). See `docs/development-history/phases/work-orders-and-recurring-schedules.md` and ISS-120 to ISS-124.
- **Contact form wired to a real endpoint (2026-10-20, ISS-133; owner chose this over replacing it with contact details):** the contact page used to say "Message sent!" and send nothing. `POST /api/v1/contact` is public: CSRF, then `reserveAttempt` (5 per hour per IP), then `contactSchema` (`lib/contact.ts`), then a honeypot check (a filled-in `website` field is answered with success and dropped), then `sendEmail({ to: CONTACT_EMAIL, replyTo: visitor })`. The visitor is told it was sent only when `messageWentOut` says so: the email was delivered, or it could only be logged on a developer's machine (no `RESEND_API_KEY`, not production). On a real deployment a console-only message is lost, so the route answers 502 and the page shows an error with the text kept; no `CONTACT_EMAIL` is a 503. `sendEmail` now returns `{ delivered }` and takes `replyTo`: **any new code that must not claim success on an undelivered email checks `delivered`**.
- **One booking per property and start time for viewings (2026-10-20, ISS-104; the owner chose this over per-property hours):** `POST /properties/[id]/viewings` takes an advisory lock for the property and Lagos day, then refuses with 409 `DUPLICATE_BOOKING` (this person already holds a time that day) or `SLOT_TAKEN` (another person holds that start time). Only `REQUESTED` and `CONFIRMED` hold a time (`VIEWING_HOLDING_STATUSES` in `lib/viewingSlots.ts`). The server accepts only half-hour starts, so a request for 10:00:30 cannot dodge the rule. `GET /properties/[id]/viewings/availability?date=YYYY-MM-DD` returns the booked start times of a Lagos day, never who booked them; the form (`ScheduleViewing.tsx`, `useViewingAvailability`) marks them "(booked)", lists them and disables them, and a 409 `SLOT_TAKEN` on confirm sends the person back to the time step with a fresh list. **Any new way to create or move a viewing must go through the same lock and holding statuses.**
- **Card payments say so when they cannot be used (2026-10-20, ISS-010; the owner chose "not taking card payments until a key is set", activating when the key is inserted):** `cardPaymentsAvailable()` (`lib/payments/availability.ts`) is true with `PAYSTACK_SECRET_KEY` set or the mock gateway on, and is read per request, so adding the key switches cards on with no rebuild. `GET /payments/availability` gives the answer to any signed-in person (`useCardPayments`); while it is `false` the tenant's **Pay Rent Online**, the team's **Pay** on a vendor invoice and a paid plan's checkout say "Card payments are not available yet", the auto-pay setup says it cannot be set up, and `POST /payments/initialize` answers 503 `CARD_PAYMENTS_UNAVAILABLE`. **Paid another way** (bank transfer or cash) never needs Paystack. Cloudinary is the one supported storage provider (owner, 2026-10-20, ISS-035): the S3-compatible, ImageKit and Vercel Blob providers are built but unverified and not supported.
- **Admin switches for auto-pay and retention, and the retention periods are settings (2026-10-20, ADR-0015 Accepted; migration `20261020143935_admin_switches_autopay_retention`):** the owner kept both off and asked for the switches (and, for retention, the periods) in Platform Settings. A job acts only when **both** gates are open: the deployment allows it (`AUTOPAY_WORKER_ENABLED=true` / `RETENTION_ENABLED=true`, unchanged) and an admin switched it on (`SystemSettings.autopayChargingEnabled` / `retentionEnabled`, default off); either closed means it only reports. `autopayChargingOn` / `retentionOn` / `deploymentAllows` in `lib/systemSettings.ts` are the one place that decides; the workers call them. The periods are `retentionAfterTenancyDays` (365) and `retentionAfterRejectionDays` (90); the API refuses under 30 and 7 days or over 3650 (`lib/retentionLimits.ts`). `GET/PATCH /admin/settings` now answer with `deploymentAllows` too and every change writes an audit row `SETTINGS_CHANGED` with old and new values. **A deployment that already had either flag on stops acting until an admin switches it on.** Tests that need a job to act set the row with `setSystemSettings`.

Roles: `ADMIN`, `MANAGER`, `LANDLORD`, `TENANT`, `VENDOR`.

---

## Project governance docs

- **ADRs** — `docs/adr/` (index in its README). One decision per file, never rewritten once accepted (supersede instead). Only a person accepts one; an agent may draft it as `Proposed`. Land the ADR in the same PR as the code.
- **Tasks** — `docs/tasks/` (`current-tasks.md` dashboard + numbered files). One file per work session/milestone; tick `[x]` only after the check is actually run; mark background processes `(running)` while they run.
- **Catalogs** — `docs/pages/`, `docs/components/`, `docs/functions/` (each starts at `index.md`): every page route, component, hook, `lib/` file and background worker with what it does and who it is for. Add a row in the same pass you add a screen, component or helper, and say so in the table's description when a role or a flag changes who can use it.
- **Issue register** — `docs/issues/` (`issues.md`, rubric P0–P3 in its README, `template.md` for detailed issues). Add a row in the same pass a problem is found; never delete rows.
- **Phase docs** — `docs/development-history/phases/`, one per completed feature.

## Commands

```bash
pnpm dev                          # dev server, localhost:3000
pnpm typecheck                    # tsc --noEmit (CI runs this)
pnpm lint                         # eslint . (CI runs this; errors fail, warnings do not)
pnpm format:check                 # prettier --check . (CI runs this; `pnpm format` to fix)
pnpm build                        # production build (CI runs this)
pnpm db:seed2                     # re-seed (enriched dataset); `pnpm db:seed` is the minimal one
pnpm db:migrate                   # prisma migrate dev — apply schema changes locally
pnpm db:generate                  # regenerate the Prisma client after schema edits
pnpm test                         # Vitest API suite (see "Testing" below)
pnpm test:e2e                     # Playwright UI suite (needs a seeded DB + running app)
```

Before opening a PR, run `pnpm typecheck && pnpm lint && pnpm format:check` — CI fails the whole PR on a single unformatted file, including generated ones (`docs/proplity-guide.html` is in `.prettierignore` for exactly that reason).

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

**Refresh rotation** (`/api/v1/auth/refresh`): atomic `updateMany` on `{ tokenHash, revokedAt: null, expiresAt: { gt: now } }`. If `count === 0` and the token exists with `revokedAt` set → **reuse detected** → revoke the entire `familyId`. This is the security-critical path; the atomicity is what prevents two concurrent refreshes both minting tokens. Don't refactor it into a read-then-write. The rotation also writes `replacedBy` in that same statement. A token rotated under 5 s ago (`lib/auth/refreshGrace.ts`) may be exchanged once more, claimed atomically (the claim needs the replacement still active, so sign-out, password change and suspension are never undone), because a refresh aborted by a reload loses its new cookie (ADR-0016, accepted 2026-10-21, ISS-134); later replays still revoke the family.

**Logout** (`/api/v1/auth/logout`): identifies whose refresh tokens to revoke by decoding `access_token` via `getExpiredSession()` — **not** `getServerSession()`. `verifyTokenAllowExpired()` (`lib/auth/jwt.ts`) accepts a signature-valid but _expired_ JWT, for this one cleanup purpose only, never for authorization. Using the strict helper silently skipped revocation for any tab idle past 15 minutes (browser looked logged out, the DB refresh token stayed valid). The expiry check is done with `err.code === 'ERR_JWT_EXPIRED'`, **not** `instanceof errors.JWTExpired` — Next.js can bundle `jose` into more than one module instance across the route-handler/library boundary and silently break `instanceof`.

**CSRF** (`lib/auth/csrf.ts`): Origin/Host match, `Referer` fallback, deny-by-default when both are missing; a malformed `Origin` header fails closed (403) rather than throwing. Applied to all mutating auth routes except `verify-email` and `reset-password` (see rule 3).

**Rate limiting** (`lib/auth/rateLimit.ts`): DB-backed via `LoginAttempt`, **atomic** via `reserveAttempt(identifier, userId?, maxAttempts?)` / `releaseAttempt(attemptId)`. `reserveAttempt` takes a Postgres advisory lock scoped to the identifier (`pg_advisory_xact_lock(hashtext(identifier))`) inside a transaction, counts the window, and inserts the reservation in one atomic step — the old check-then-record pair let N concurrent requests all pass the count check before any had recorded. It is called **before** any slow work (bcrypt, DB writes, email). A route that shouldn't count a given outcome (e.g. a successful login) calls `releaseAttempt` to delete the reservation, which preserves each route's "only failures count" semantics. Limits: 5 attempts / 5 min by default; `refresh` uses `REFRESH_MAX_ATTEMPTS = 30` because it is a periodic background call from every authenticated tab, not a credential-guessing surface (the first version of the fix used 5 and broke the E2E suite under CI's shared IP). Used by `login`, `register`, `forgot-password`, `resend-verification`, `refresh` and `setup`. `getClientIp()` returns the **last** `x-forwarded-for` hop, not the first: each hop appends the IP it saw, so with a single trusted proxy (Vercel's edge) the last entry is what the trusted edge observed and the first is whatever the client sent. Don't switch it back to `[0]` — that made every per-IP limit bypassable.

**Client refresh**: two mechanisms, both needed —

- `hooks/useAuthRefresh.ts` — proactive timer, 13 min, re-checks `/me` before redirecting (prevents cross-tab logout races)
- `lib/apiClient.ts` — reactive 401 interceptor with single-flight dedup (`refreshPromise`), catches what the timer misses when a tab is backgrounded and `setInterval` is throttled. When the refresh fails it sends the tab to `/login` **only if the person is still on the page that made the request** (`sendToLogin`, the path is stamped on the request): a slow request left behind by a page they had just left used to throw a visitor off the public home page (ISS-132, `tests/unit/apiClientRedirect.test.ts`)

**Edge guard** (`proxy.ts`, Next 16's rename of `middleware.ts`): only inspects the short-lived `access_token` cookie for `/dashboard/*` and `/admin/*`. A request after 15+ minutes idle is bounced to `/?from=…`; `app/HomeLanding.tsx` waits for `AuthContext`'s silent refresh and then returns the user to `from` (validated by `lib/safeRedirect.ts`, same-origin relative paths only, shared with `/login`).

**Registration**: `register` creates the user as `PENDING_VERIFICATION` with a 7-day `VerificationToken` and emails a link (`verify-email`); `login` 403s that status with a "verify your email" message and `resend-verification` re-sends. Self-registerable roles are `TENANT`, `LANDLORD`, `MANAGER`, `VENDOR` — **`ADMIN` can never be self-registered** (admins come from the `/setup` wizard or are provisioned out-of-band). A `MANAGER` sign-up must carry a valid, unredeemed landlord invite code (`ManagerInviteCode`, issued from the landlord dashboard; `GET /manager-codes/check` is a UX preview only — `register` re-validates and links it in the same transaction).

## Resolved (was "Known bugs — fix before Phase 1")

All fixed during the pages-separation phase — kept as a record, not a to-do: session-dies-on-reload (`AuthContext` now attempts `/api/v1/auth/refresh` before clearing `user`), `/login` 404 (all redirects go to `/`, which is a real route — auth screens are real pages now, not client state inside a deleted `App.tsx`), hardcoded `JWT_SECRET`/DB connection string (both throw if unset in production), demo login creds (gated behind `NODE_ENV !== 'production'`), `RoleSwitcher` (same gate, lives in `app/dashboard/DashboardChrome.tsx` now).

---

## Known gaps — deliberate, not bugs

Each of these was flagged during the phase that found it rather than silently guessed at, because building the wrong default would have been worse than leaving the gap open:

- **Auto-pay charging is built but switched off.** `lib/workers/autopayCharger.ts` (the `autopay-charger` job in `cron/all`) charges due invoices on active mandates (Paystack charge authorization, or the mock gateway), pauses a mandate after repeated declines and audit-logs each attempt; it only runs when `AUTOPAY_WORKER_ENABLED=true` and has never run against live Paystack. There is still no card-entry UI: `GET /payments/authorization` derives a reusable Paystack `authorization_code` from the tenant's own past `charge.success` payload, and building a card form is a PCI-scope decision.
- **`/payments/initialize`'s call to Paystack's live API has never run** against a real test-mode account — no key has been provided, so card payments are shown as "not available yet" until `PAYSTACK_SECRET_KEY` is set (see "Since the roadmap"); when it is, run one test-mode payment and its webhook before real money. The mock gateway covers everything downstream of it.
- **No meeting/appointment model.** The landlord dashboard's "Schedule Review" starts a direct message to the property's manager instead; there is no calendar object behind it. (See ISS-137.)
- **`AuditLog` coverage is partial.** 15 files write to it (first-run setup, admin user suspend/role change, vendor verification, invoice edits, manual payments, webhook payment anomalies, property merge/unmerge and transfer, neighbourhood reports, bank-transfer reconciliation, vendor payouts, the auto-pay charger, file retention and storage); coverage is broad but not every sensitive action is logged, so `/admin/security` is a growing, not a complete, trail. The "Database (backups & logs)" tile on the admin dashboard is an honest explanation that this is infrastructure-level, not an app feature — no backup/restore or query-log storage exists in the app. (See ISS-135.)
- **"Photos of Every Room" is a single column.** `Property` has `imageUrl`, `video360Url`, `exteriorPhotoUrl` only; the listing form accepts many room photos but persists the first as `imageUrl` and keeps the rest as a local count.
- **Rent Invoicer advances one billing cycle per run**, not all overdue cycles at once — a lease several cycles behind catches up gradually across multiple runs. Deliberate, not a bug — see `docs/development-history/phases/domain-api-phase-8-background-workers.md`.
- **`paymentReliabilityScorer.ts`'s scoring is a documented heuristic, not ML** — the PRD describes "late payment prediction" as an AI capability with no formula specified anywhere in the repo. The heuristic (on-time/late/missed ratio) is explicitly commented as a stand-in, not a finished feature.
- **Admin notifications** — admins are told in the app (and, for listing edits and new listings, by email) when a listing or an edit awaits review and when a vendor signs up (`notifyAdmins` in `lib/notifications.ts`).

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
- **Manager-initiated repairs (work orders) — built 2026-10-19; the defaults were accepted by the owner on 2026-10-20 (ADR-0014).** `MaintenanceRequest.tenantId` is optional and `createdById` says who raised it; admins, managers and landlords raise one on any unit they look after; the property team pays the vendor; no tenant confirmation, rating or notices. Not built: approval before work starts or a spending limit, a rating for work-order jobs, and a screen for admins.
- **Repair follow-through — built 2026-10-19** (see "Since the roadmap"). Not built: treating tenant silence as "confirmed" after 7 days (a suggestion only, never agreed; it would be a cron step). The agreed design said a dispute needs "reason and photos"; it was built as reason required, photos optional (up to 6), per the later handover.
- **Offline payments and receipts — built 2026-10-19** (see "Since the roadmap"). Not built: one transfer paying several invoices (record each), a receipt for cash that was never recorded, and undoing a confirmed entry from the screen (a correction is a new, opposite entry). Nothing checks the proof file against the amount; a person reads it before confirming. A one-person property needs an admin to confirm its entries.
- **Viewing availability:** viewings are a date plus a half-hour start time (Mon-Sat, 9:00-17:00 Lagos), one live booking per property and start time (built 2026-10-20, ISS-104; `REQUESTED` and `CONFIRMED` hold a time, a declined or cancelled viewing gives it back). There are no per-property viewing hours: every property uses the same window.
- **Recurring auto-charge for `AutoPayMandate`** — built, off by default (`AUTOPAY_WORKER_ENABLED` plus the Platform Settings switch); see "Known gaps".
- **OAuth / social login / Clerk / Kinde** — designed (see `docs/auth-implementation-plan.md` §9–10) but not built. Design principle if built: OAuth only authenticates; our own `RefreshToken` + `setAuthCookies` still issues the session. Never auto-link accounts by unverified email (account-takeover vector). PKCE + `state` are mandatory.
- **`Subscription` model** — exists in schema but is **not in the PRD**. Built from admin-UI mock evidence only; checkout is behind `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED` and off by default. Confirm with product before building billing on it.

---

## Schema layout

`prisma/schema/` — multi-file, 43 models, 11 files, 32 migrations:

| File                   | Contents                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.prisma`          | generator + datasource **only**, no models                                                                                                                                                                                                                                                                                          |
| `auth.prisma`          | `User` (incl. tenant-profile fields), `VendorProfile`, `KycVerification`, `Note`, `Subscription`, `ManagerInviteCode`, `BankAccount`, `RefreshToken`, `VerificationToken`, `PasswordResetToken`, `LoginAttempt`                                                                                                                     |
| `property.prisma`      | `Property`, `AdCampaign`, `Unit`, `NeighbourhoodReport`, `PropertyViewing`, `PropertyReview`, `Announcement`, `Violation`, `Equipment`, `ConditionReport`, `AccessCode`, `AccessLog`                                                                                                                                                |
| `lease.prisma`         | `Lease`, `LeaseSignature`, `Notice`, `Application`                                                                                                                                                                                                                                                                                  |
| `operations.prisma`    | `MaintenanceCategory`, `MaintenanceRequest`, `MaintenanceSchedule`, `VendorRating`                                                                                                                                                                                                                                                  |
| `financial.prisma`     | `Invoice`, `Payment`, `AutoPayMandate`, `BankTransferSubmission`, `VendorPayout`                                                                                                                                                                                                                                                    |
| `communication.prisma` | `Conversation`, `ConversationParticipant`, `Message`                                                                                                                                                                                                                                                                                |
| `audit.prisma`         | `AuditLog`                                                                                                                                                                                                                                                                                                                          |
| `notification.prisma`  | `Notification`                                                                                                                                                                                                                                                                                                                      |
| `system.prisma`        | `SystemSettings` (singleton, `id = 'global'`) — guards the `/setup` first-run admin wizard and holds platform toggles (`autoCompleteMaintenanceOnInvoice`, `requireTenantRepairConfirmation`, the two `requireSecondPersonFor…Payments` switches) Also the auto-pay and retention switches and the two retention periods (ADR-0015) |
| `storage.prisma`       | `StoredFile` (every uploaded file; served by the `/api/v1/files/[id]` gateway, ADR-0010)                                                                                                                                                                                                                                            |

Keep `base.prisma` config-only — new models go in a domain file.

**Enum values** (get these exactly right — past plans repeatedly invented values that don't exist):

- `UnitStatus`: `VACANT | OCCUPIED | MAINTENANCE | RESERVED` (not `UNDER_MAINTENANCE`)
- `LeaseStatus`: `PENDING | ACTIVE | EXPIRED | TERMINATED`
- `NoticeType`: `RENEWAL_OFFER | RENT_INCREASE | DEFAULT_NOTICE | EXPIRATION_ALERT | PAYMENT_REMINDER | TERMINATION_NOTICE`
- `InvoiceType`: `RENT | MAINTENANCE | SECURITY_DEPOSIT | UTILITY | LATE_FEE | ASSOCIATION_FEE | SUBSCRIPTION | SERVICE_CHARGE`
- `MaintenanceStatus`: `SUBMITTED | IN_PROGRESS | SCHEDULED | COMPLETED | CANCELLED`
- `RepairConfirmationStatus`: `NOT_REQUESTED | AWAITING_TENANT | CONFIRMED | DISPUTED`
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

Other shared modules worth knowing: `lib/maintenanceSchedule.ts` (schedule due dates and the intended day of the month, shared by the worker and the screen), `lib/api/paymentSelect.ts` (the only fields of a payment a screen may receive), `lib/receipts.ts` (`buildReceipt`, who may open a receipt), `lib/maintenanceFlow.ts` (repair rules: open statuses, finished-work evidence, what completing writes, vendor checks, keeping the message thread's vendor in step), `lib/uploadClient.ts` + `lib/cloudinary.ts` (signed direct-to-Cloudinary uploads), `lib/tenantProfile.ts` (the completeness gate for tenant applications), `lib/csv.ts` / `lib/xlsx.ts` (property/unit import-export), `lib/payments/mockGateway.ts` (local Paystack stand-in), `lib/payments/availability.ts` (whether cards can be used yet), `lib/notifications.ts` (`notifyUser`/`notifyUsers`/`notifyByEmail`, and the helpers new code should use: `notifyAndEmail` for one person, `notifyPropertyTeam` for a property's manager and landlord, `notifyAdmins`, `tellUnitTenant`; they never throw, so a failed notification cannot fail the action), `lib/dashboardAttention.ts` (the per-role "Needs your attention" list behind `GET /dashboard/attention`; add a row there when a new kind of task needs a person), `lib/viewingSlots.ts` (viewing dates and times, the Lagos day and start-time helpers and the statuses that hold a time, shared by the form and `POST .../viewings`), `lib/contact.ts` (the contact form's schema, recipient, email and the rule for when to say "sent"), `lib/systemSettings.ts`, `lib/appUrl.ts`, `lib/safeRedirect.ts`.

---

## Testing

`pnpm test` (Vitest, everything under `tests/`) — 678 tests across 58 files: 110 in the 18 files under `tests/{unit,fuzz,security,anomaly}/` (mocked Prisma, no server; `pnpm test:unit` runs just these) and 568 in the 40 files of `tests/api/`, roughly one per domain (`auth`, `properties`, `maintenance`, `leases`, `financial`, `access-control`, `communications`, `vendors-and-admin`, `deferred-flows`, `orphaned-models`, `csv-excel-import-export`, `e-signature`, `notifications`, `setup`, `health`, plus `files`, `storage-drivers`, `retention`, `viewings`, `application-and-viewing-flow`, `manager-links`, `vendor-verification`, `dashboard-summary`, `bank-reconciliation-and-payouts`, `repair-follow-through`, `offline-payments`, `work-orders-and-schedules`, `contact`, `security-sweep`, `security-sweep-2`, `thread-membership`, `listing-visibility`, `invites-and-passwords`, `review-eligibility`). Run in CI against a `postgres:18` service container on every PR (`.github/workflows/ci.yml`: `Typecheck, format & build`, `Integration tests`, `E2E (Playwright)`). Full plan and rationale in `docs/development-history/phase-10-test-suite-plan.md`; per-sub-phase writeups in `docs/development-history/phases/domain-api-phase-10-*.md`.

**Real HTTP against a real spawned server, not direct handler imports.** `getServerSession()` needs the Next.js request-scoped `AsyncLocalStorage` context, which doesn't exist if a route handler is imported and called directly — so `tests/setup/globalSetup.ts` spawns a real `next dev` process and every test hits it over `fetch` (`tests/helpers/client.ts`'s `apiFetch()`), the same way every phase's manual `curl` verification always has.

**A dedicated `proplity_test_db`**, not the seeded dev database — dropped and recreated on every `pnpm test` run (`tests/setup/globalSetup.ts`), migrated via `prisma migrate deploy`. Configure via `.env.test` (gitignored; copy `.env.test.example`). Never points at the same database as `.env`.

**Next 16 quirk worth knowing**: a single `next dev` process is allowed per `distDir` (an OS-level lockfile). The test server sets `NEXT_TEST_DIST_DIR=.next-test` (wired into `next.config.mjs`'s `distDir`) so it can run alongside a developer's own `pnpm dev` without conflict.

**Fixtures** (`tests/helpers/fixtures.ts`) write directly via a test-side Prisma client (`tests/helpers/db.ts`'s `testPrisma`, separate from the app's `lib/db.ts` singleton), never through the API — keeps each test's assertions about the route actually under test. `resetDb()` truncates every table (discovered dynamically from `information_schema`, not a hardcoded list) once per test file's `beforeAll`.

**Auth in tests**: `tests/helpers/auth.ts`'s `authCookie(userId, role)` mints a real JWT directly via the app's own `signAccessToken()`, bypassing login for every test file except `auth.test.ts` itself (where login is literally what's under test) — keeps other domains' tests fast and independent of the DB-backed login rate limiter. `expiredAccessCookie()` mints a validly-signed but already-expired token (used by the logout-revocation regression test), and `fillRateLimit` in `fixtures.ts` seeds `LoginAttempt` rows directly (note: a refresh-limit test must seed `REFRESH_MAX_ATTEMPTS`, not 5).

**Playwright UI suite** (`tests/e2e/`, `pnpm test:e2e`) — 71 tests in 18 files: `smoke/` (marketing, auth forms), `flows/` (per-role: tenant, landlord, vendor, admin; login; the contact form; booked viewing times; session restore after idle; featured-property popup; public-property CTA auth-awareness; the dev email-inbox widget; the mock payment round trip), `responsive/` (mobile tab bar; `layout.spec.ts`, which fails a page that scrolls sideways, cuts content off or scrolls sideways inside the dashboard's main area at 320, 390 and 768 px: **keep every new screen passing it**). Runs in CI as its own job against a production build and a seeded Postgres, one worker. Locally it needs `pnpm db:seed2` and a running app (`E2E_BASE_URL`). **`MobileTabBar` shows only the first 3 tabs directly** (the rest fold into "More"), which `responsive/mobile-nav.spec.ts` asserts — when adding a role-scoped nav tab, put it after the existing primary three or update that test deliberately.

**Known, deliberate gaps in coverage**: `/payments/initialize`'s actual call to Paystack's API (would be a live network call to an external service — matches the documented gap above), real Cloudinary uploads (not configured in dev/CI; the UI's "not available" fallback is what's exercised), and recurring auto-charging (not built).

---

## What's next

All 8 domain-API phases, background workers, frontend hydration (Phase 9), the automated test suite (Phase 10) and the UI/UX gap audit are done. Open items:

- **Finding 4 punch list** (`docs/development-history/next-phase-analysis.md`): a real Paystack test-mode key (to run `/payments/initialize` and the built, disabled auto-pay charger against the live API).
- **A broader auth/security audit** beyond the 2026-09-30 review (`docs/auth-review-2026-09-30.md`), looking for further hardening. (See ISS-136.)
- Closing the remaining `AuditLog` gaps: role changes, invoice edits, property transfers (`PROPERTY_TRANSFERRED`, ISS-135) and several other sensitive actions are logged now; sweep for others as part of the security audit (ISS-136).

---

## Conventions

- **Uploads** — always `uploadFile()` (`lib/uploadClient.ts`) and store the returned gateway URL `/api/v1/files/<id>`; never a provider URL. Every file is a `StoredFile` row served by `GET /api/v1/files/[id]`, which decides access and reads from the provider on that row. New upload folder ⇒ add it to `FOLDER_ACCESS` (`lib/fileRef.ts`) and `FOLDER_ROLES` (`lib/uploadPolicy.ts`). A record that accepts file URLs must call `assertOwnsFileUrls` (otherwise attaching someone else's URL grants read access). Provider is chosen by `STORAGE_PROVIDER` (`lib/storage/`, no fallback). See ADR-0010.
- **Emails** — validate inbound addresses with `emailSchema` and look users up with `findUserByEmail()` (`lib/auth/email.ts`); never `findUnique({ where: { email } })` on user input.
- **Links in emails** — always `appUrl(path, req)` from `lib/appUrl.ts`; never build a URL from `req.headers.host` yourself (ADR-0005).

- API version prefix `/api/v1/` on everything
- Route handlers: `validateCSRF` → rate limit → auth → validate → business logic
- Soft-delete/archive over hard delete throughout (`isPublished = false`, `status = REVOKED`, `revokedAt`)
- Prisma client is a singleton from `lib/db.ts` (`@prisma/adapter-pg` driver adapter) — don't instantiate `new PrismaClient()`
- Currency is NGN; `lib/utils.ts` has `fmtNaira()`
- **Write hooks go through `hooks/useApiSubmit.ts`** (`{ submit, submitting, error }`). `submit` is a plain per-render function on purpose: wrapping it in `useCallback(fn, [])` pinned whatever the hook closed over on first render and silently broke `useSendMessage(conversationId)` and `useCreateAdCampaign(propertyId)` once that id changed. Don't "optimise" it back.
- **Replacing a dead button**: check whether a backend already exists first (it usually does — Renew Lease, Send Notice/Invoice, auto-pay were all fully built server-side). If none exists, show an honest explanation or the closest real action (e.g. Schedule Review → direct message); never fake success with a demo button.
- Playwright selectors: this codebase's `<label>`s are plain siblings with no `htmlFor`, so `getByLabel(...)` silently waits out the full timeout — use type/placeholder/positional selectors.
- **Payments in a response** — `select: PUBLIC_PAYMENT_SELECT` (`lib/api/paymentSelect.ts`), never `payments: true` or a bare `include`: the row holds `rawProviderPayload` (payer email, card details) and a virtual account number. Likewise no `include: { user: true }` on any user relation (select the fields a screen shows).
- Prefer explicit enums/relations over booleans for anything with more than two real states — this codebase has repeatedly upgraded booleans (`isUsed` → `AccessCodeStatus`, `isVerified` → `leaseId` FK)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
