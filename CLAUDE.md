# CLAUDE.md — Proplity

Project context for Claude Code. Read this before making changes.

Proplity is an AI-native rental/property management platform for the Nigerian market. Next.js 15 (App Router), TypeScript, PostgreSQL 18, Prisma ORM.

---

## Current state

| Subsystem | Status |
|---|---|
| Prisma schema (33 models, 8 modular files) | Done, migrated, seeded |
| Auth API (`/api/v1/auth/*`, 7 routes) | ~85% — see "Known bugs" below |
| Frontend UI (all 5 roles) | Built, reading from `app/store/*` mock data |
| Domain APIs (`/api/v1/properties`, `/leases`, etc.) | Not started — Phase 0 next |
| Email/transactional, background workers, Paystack | Not started |

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

### 5. `Lease.rentAmount` is per payment *cycle*, not per month
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

## Known bugs — fix before Phase 1

### Session dies on reload despite valid refresh token (highest impact)
`AuthContext.fetchUser()` uses raw `fetch` and gives up on 401. After 15 min, a page reload logs the user out even though their refresh token is good for 7 more days — and `useAuthRefresh(!!user)` never fires because `user` is null. The whole rotation system is bypassed on every page load.

Fix: attempt `/api/v1/auth/refresh` before `setUser(null)`, then retry `/me`. Or route `AuthContext` through `apiFetch`, which already has this logic.

### `/login` route doesn't exist
`useAuthRefresh.ts` and `apiClient.ts` (×2) redirect to `window.location.href = '/login'`, but `app/` has only `page.tsx`. Auth screens are client state inside `App.tsx`. All three redirects 404. Redirect to `/` instead.

### Hardcoded `JWT_SECRET` fallback
`lib/auth/jwt.ts` falls back to a literal string committed to the repo. If the env var is ever unset in production, anyone reading the repo can forge an admin token. Throw on missing instead. Same pattern in `db.ts` with the Postgres connection string.

### Demo login ships seeded credentials in the client bundle
`Login.tsx` `handleDemoLogin` now authenticates properly (good), but hardcodes `Password123!` and five emails into public JS. Gate with `process.env.NODE_ENV !== 'production'` before deploying.

### `RoleSwitcher` lets users reassign their own role
`App.tsx` — `onRoleChange={setCurrentRole}`. Server-side RBAC still holds, so it renders an admin UI that 403s on every request. Dev-only or remove.

---

## Deliberately deferred

- **Email** (`lib/email.ts`, forgot-password, reset-password, verification sends) — Phase 4. `ForgotPassword.tsx` is a UI shell that claims an email was sent; nothing is. `register` currently sets `status: ACTIVE` directly and creates no `VerificationToken`, so `/verify-email` can't succeed for real users. **When wiring email: flip `register` to `PENDING_VERIFICATION` and relax the `login` 403 in the same commit**, or every new signup is locked out.
- **Redis blocklist** for instant session revocation — 15-min TTL bounds exposure; revisit only if instant kill becomes a product requirement.
- **Real-time messaging** — v1 uses polling. WebSocket/SSE deferred.
- **`SERVICE_CHARGE` invoice type** — removed; only `ASSOCIATION_FEE` is in PRD scope. Additive to re-add later if a real requirement appears.
- **OAuth / social login / Clerk / Kinde** — designed (see `auth-implementation-plan.md` §9–10) but not built. Design principle if built: OAuth only authenticates; our own `RefreshToken` + `setAuthCookies` still issues the session. Never auto-link accounts by unverified email (account-takeover vector). PKCE + `state` are mandatory.
- **`Subscription` model** — exists in schema but is **not in the PRD**. Built from admin-UI mock evidence only. Confirm with product before building billing on it.

---

## Schema layout

`prisma/schema/` — multi-file:

| File | Contents |
|---|---|
| `base.prisma` | generator + datasource **only**, no models |
| `auth.prisma` | `User`, `VendorProfile`, `KycVerification`, `Note`, `Subscription`, `BankAccount`, `RefreshToken`, `VerificationToken`, `LoginAttempt` |
| `property.prisma` | `Property`, `Unit`, `NeighbourhoodReport`, `PropertyViewing`, `PropertyReview`, `Announcement`, `Violation`, `Equipment`, `ConditionReport`, `AccessCode`, `AccessLog` |
| `lease.prisma` | `Lease`, `Notice` |
| `operations.prisma` | `MaintenanceCategory`, `MaintenanceRequest`, `MaintenanceSchedule`, `VendorRating` |
| `financial.prisma` | `Invoice`, `Payment`, `AutoPayMandate` |
| `communication.prisma` | `Conversation`, `ConversationParticipant`, `Message` |
| `audit.prisma` | `AuditLog` |

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

## Next: Phase 0 — shared API infrastructure

Build before any domain route:
- `lib/api/withAuth.ts` — HOF wrapping handlers with `getServerSession()` + role check → 401/403
- `lib/api/pagination.ts` — parse `?page`/`?limit` or `?cursor`, return `{ data, meta }`
- `lib/api/errors.ts` — map Prisma `P2002`/`P2025` etc. to HTTP status
- `lib/api/validate.ts` — Zod wrapper, 400 with field errors

Then Phase 1 (Properties) → 2 (Maintenance) → 3 (Leases) → 4 (Financial) → 5 (Access) → 6 (Communications).

Phase 3 before 4: leases and maintenance both create invoices.

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
