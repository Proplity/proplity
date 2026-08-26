# Proplity — Domain API & Integration: Full Step-by-Step Plan

> Companion to `out/proplity_progress.md`. This is the finetuned version of the proposed 8-phase domain API plan, verified line-by-line against `CLAUDE.md`, `CURRENT_STATE.md`, `PROJECT_STRUCTURE.md`, `docs/PRD.md`, and all 8 `prisma/schema/*.prisma` files as of 2026-08-22.

## Context

The user supplied a proposed 8-phase implementation plan (shared API infra → six domain API phases → frontend wiring → background workers) and asked for it to be analysed against the real codebase and finetuned.

Direct inspection of the repo (not assumed from the proposal) found:

1. **The working tree already carries substantial uncommitted work** fixing 4 of the 5 "Known bugs" listed in `CLAUDE.md` — sitting unstaged/staged, unverified as a unit, mixed in with two new untracked docs. `CLAUDE.md` says these must be fixed *before Phase 1*, yet the proposed plan never mentions them. One bug (`RoleSwitcher`) is still unfixed; one fix (`lib/db.ts`) is inconsistent with its sibling fix in `lib/auth/jwt.ts`. This has to be closed and committed before anything else stacks on it.
2. **Every model/field/enum name the proposed plan references was cross-checked against the actual `prisma/schema/*.prisma` files** (all 8 files read in full, not sampled). The proposed plan is accurate — no invented fields, matching `CLAUDE.md`'s specific warning that "past plans repeatedly invented values that don't exist." A handful of precision gaps were found where the plan is directionally right but under-specifies something the schema models more richly than the plan describes (e.g. `AccessLogAction` has 4 states, not the 2 the plan uses).
3. `lib/api/` does not exist yet — Phase 0 is genuinely, entirely unbuilt, matching `CURRENT_STATE.md`'s own status line ("Domain REST APIs — 0% (Next)").
4. `pnpm exec tsc --noEmit` is currently clean (0 errors) — a known-good baseline to preserve through every step below.

This document sequences the full path from current state through Phase 6, in the order `CLAUDE.md` mandates (0 → 1 → 2 → 3 → 4 → 5 → 6, with 3 required before 4 since leases and maintenance both create invoices), with the bug-fix cleanup as Phase 0-pre. Phases 7 (frontend wiring) and 8 (workers) are included per the original proposal but stay high-level, since they depend on the shape of the domain routes below and are naturally scoped once those exist.

---

## Phase 0-pre — Close the in-flight auth bug fixes

Verified against `CLAUDE.md`'s "Known bugs" list, file by file via `git diff`:

| # | Bug | Found state | Step |
|---|---|---|---|
| 1 | Session dies on reload | **Already fixed.** `context/AuthContext.tsx` → `fetchUser()` now calls `POST /api/v1/auth/refresh` on a 401 before clearing `user`, then retries `/me`. | none |
| 2 | `/login` 404 | **Already fixed.** `hooks/useAuthRefresh.ts` and `lib/apiClient.ts` (both redirect sites) now go to `/`. | none |
| 3 | Demo login ships creds in bundle | **Already fixed.** `app/components/Auth/Login.tsx` wraps the whole demo-button block in `process.env.NODE_ENV !== 'production'`. | none |
| 4 | Hardcoded `JWT_SECRET` | **Fixed.** `lib/auth/jwt.ts` throws if `JWT_SECRET` is unset and `NODE_ENV === 'production'`; dev fallback string changed off the old literal. | none |
| 5a | Hardcoded DB connection string | **Not fixed.** `lib/db.ts` only edited the fallback string's DB name (`proplity` → `proplity_db`); never got the "throw in production if unset" guard `jwt.ts` received. | **Step 1** |
| 5b | `RoleSwitcher` reassigns own role | **Not fixed.** `app/App.tsx:657` still renders `<RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />` unconditionally. | **Step 2** |

**Step 1 — `lib/db.ts`**: mirror the `jwt.ts` pattern exactly.
```ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: DATABASE_URL environment variable is not defined in production!');
}
const resolvedConnectionString =
  connectionString || 'postgresql://postgres:postgres@localhost:5432/proplity_db?schema=public';
```
(then use `resolvedConnectionString` in `new pg.Pool(...)`)

**Step 2 — `app/App.tsx`**: wrap the RoleSwitcher render at line 657 the same way the demo-login block in `Login.tsx` is already wrapped:
```tsx
{process.env.NODE_ENV !== 'production' && (
  <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />
)}
```

**Step 3 — Verify**: `pnpm exec tsc --noEmit` (must stay 0 errors) then `pnpm build`.

**Step 4 — Commit** in two commits (working tree currently mixes bug fixes with new docs):
1. Auth bug fixes: `app/App.tsx`, `app/components/Auth/Login.tsx`, `context/AuthContext.tsx`, `hooks/useAuthRefresh.ts`, `lib/apiClient.ts`, `lib/auth/cookies.ts`, `lib/auth/jwt.ts`, `lib/db.ts`, `app/api/v1/auth/login/route.ts`
2. Docs: `CURRENT_STATE.md`, `PROJECT_STRUCTURE.md`, `CLAUDE.md` (if untracked)

Exact `git add`/`git commit` invocations run only after a fresh `git status`/`git diff` check at execution time, and only with explicit confirmation — no destructive or blind staging.

---

## Phase 0 — Shared API Infrastructure

`lib/api/` does not exist. Build four files, reusing the existing working auth primitives rather than reinventing them — `getServerSession()` in `lib/auth/session.ts` already returns `{ sub, role }` with uppercase `Role`, and there's no Edge `middleware.ts` in this repo (confirmed absent), so route-level guards are the established pattern.

### Step 1 — `lib/api/withAuth.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { Role } from '@prisma/client';

type Handler = (req: NextRequest, ctx: { session: { sub: string; role: Role } }, routeCtx?: any) => Promise<NextResponse>;

export function withAuth(handler: Handler, opts?: { roles?: Role[] }) {
  return async (req: NextRequest, routeCtx?: any) => {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (opts?.roles && !opts.roles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, { session }, routeCtx);
  };
}
```
`opts.roles` always uppercase Prisma `Role` values — never lowercase, per `CLAUDE.md` rule 2.

### Step 2 — `lib/api/pagination.ts`
```ts
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, hasMore: page * limit < total };
}
```
Cursor variant added if/when a route needs it (Phase 6 messages are the one candidate — cursor-based per the proposal).

### Step 3 — `lib/api/errors.ts`
```ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export function handleApiError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Duplicate record', code: 'P2002' }, { status: 409 });
    if (err.code === 'P2025') return NextResponse.json({ error: 'Record not found', code: 'P2025' }, { status: 404 });
    if (err.code === 'P2003') return NextResponse.json({ error: 'Invalid reference', code: 'P2003' }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Step 4 — `lib/api/validate.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function validateBody<T extends z.ZodType>(req: NextRequest, schema: T) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { success: false as const, response: NextResponse.json({ error: 'Invalid payload', details: parsed.error.format() }, { status: 400 }) };
  }
  return { success: true as const, data: parsed.data as z.infer<T> };
}
```
Centralizes the pattern already used ad hoc in `register/route.ts`.

### Step 5 — Verify
No new dependency needed (`zod ^4.4.3` already installed). Confirm `pnpm exec tsc --noEmit` stays clean. Smoke-test by importing all four into a throwaway script or a single no-op route, then delete the scaffold — real verification happens once Phase 1's first route consumes them.

---

## Phase 1 — Properties & Units API

- **`app/api/v1/properties/route.ts`**
  - `GET`: paginated (`parsePagination`), filters `city`, `state`, `type`, `trustScoreMin` → `trustScore: { gte }`, `powerReliabilityMin` → `powerReliabilityScore: { gte }`, `floodRiskMax` → `floodRiskScore: { lte }`, `minPrice`/`maxPrice`/`minBedrooms` via `units: { some: { rentAmount: {...}, bedrooms: {...} } }` (rule 9). Serialize each unit's `squareFeet` as `sqft` in the response (rule 10) — never accept `squareFeet` on input, only `sqft`.
  - `POST`: `withAuth(handler, { roles: ['ADMIN','MANAGER','LANDLORD'] })`. Required `name`, `address`, `city`, `state`, `type`. **Refinement over the original proposal**: `Property.moderationStatus` defaults `PENDING_REVIEW` (schema default) — since the AI moderation pipeline (PRD §6.2.1) isn't built, enforce in this route that `isPublished` can only be set `true` if `moderationStatus === 'APPROVED'`; until an admin/AI flips that, new listings stay unpublished regardless of what the caller sends for `isPublished`.

- **`app/api/v1/properties/[id]/route.ts`**
  - `GET`: property + units + latest `NeighbourhoodReport` (`orderBy: generatedAt desc, take: 1`) + `PropertyReview[]` with verified badge derived from `leaseId !== null` (rule 4) + aggregate rating.
  - `PATCH`: RBAC — caller is `property.managerId`/`landlordId` or `ADMIN`.
  - `DELETE`: soft-archive only — `update({ isPublished: false })`, never `prisma.property.delete()`.

- **`app/api/v1/properties/[id]/units/route.ts`**
  - `GET`: filter by `status` (`VACANT|OCCUPIED|MAINTENANCE|RESERVED` — exact enum, not `UNDER_MAINTENANCE`).
  - `POST`: required `unitNumber`, `bedrooms`, `bathrooms`, `rentAmount`; optional `listedPaymentFrequency` (default `ANNUAL`), `amenities[]`, `sqft` → persisted to `squareFeet`. RBAC: property manager/landlord/admin.

- **`app/api/v1/properties/[id]/units/[unitId]/route.ts`** — GET/PATCH/DELETE, same RBAC, `status` PATCH restricted to the 4 valid enum values.

- **`app/api/v1/properties/[id]/reviews/route.ts`**
  - `GET`: `?verified=true` → `WHERE leaseId IS NOT NULL`.
  - `POST`: any authenticated user. At creation time, query `Lease` for `tenantId = session.sub` on any `Unit` of this property; if found set `leaseId` to that lease's id (verified). This lookup happens **once, here** — never re-checked at read time (rule 4).

- **`app/api/v1/properties/[id]/viewings/route.ts`**
  - `GET`: manager/landlord sees all; others see their own (`requestedById = session.sub`).
  - `POST`: required `scheduledAt`, optional `unitId`/`notes`. Guard against duplicate same-user/same-day/same-property bookings before insert.

- **`app/api/v1/properties/[id]/neighbourhood-report/route.ts`** — `GET` latest report only (`generatedAt desc`, `take: 1`).

---

## Phase 2 — Maintenance & Operations API

- **`app/api/v1/maintenance/categories/route.ts`** — `GET` (`isActive = true`), `POST`/`PATCH` (`ADMIN` only, `PATCH` toggles `isActive`).

- **`app/api/v1/maintenance/requests/route.ts`**
  - `GET`, role-scoped: `TENANT` → `tenantId = session.sub`; `VENDOR` → `vendorId = session.sub`; `MANAGER`/`ADMIN` → all requests on managed properties.
  - `POST` (`TENANT` only): required `unitId`, `title`, `description`; optional `categoryId` (nullable — AI triage assigns it later per schema comment), `priority`, `mediaUrls[]`. Validate the tenant has an active lease on that unit before allowing submission.

- **`app/api/v1/maintenance/requests/[id]/route.ts`**
  - `GET`: full detail incl. timeline, vendor, linked `Conversation`.
  - `PATCH`, three sub-operations by role:
    - Triage (`MANAGER`/`ADMIN`): set `categoryId`, `priority`, `vendorId`, `scheduledFor`.
    - Status update (`VENDOR`, must be the assigned `vendorId`): `IN_PROGRESS → COMPLETED` with `completionProofUrl`, `finalCost`; on completion, auto-create the `MAINTENANCE`-type `Invoice` (`maintenanceRequestId` set, `leaseId`/`userId` left null — satisfies the "at least one of" rule since `maintenanceRequestId` counts).
    - Cancel (`MANAGER`/`TENANT` who owns it): status → `CANCELLED`.

- **`app/api/v1/maintenance/requests/[id]/rating/route.ts`** — `POST` (`TENANT` who owns the request). Required `rating` 1–5, optional `comment`. Enforce request `status === 'COMPLETED'`; rely on schema's `maintenanceRequestId @unique` on `VendorRating` to prevent double-rating (surface the resulting `P2002` via `handleApiError` as a clean 409, don't pre-check separately).

- **`app/api/v1/maintenance/schedules/route.ts`** — `GET` list; `POST` (`MANAGER`/`ADMIN`): `unitId`, `categoryId` (required per schema — schedules are staff-created for a known category, unlike requests), `frequency`, `nextDueDate`, optional `equipmentId`.

---

## Phase 3 — Leases & Tenancy API

- **`app/api/v1/leases/route.ts`**
  - `GET`: filter `status` (`PENDING|ACTIVE|EXPIRED|TERMINATED`), role-scoped, include `paymentReliability`, `riskScore`, `riskScoreUpdatedAt`.
  - `POST` (`MANAGER`/`LANDLORD`/`ADMIN`): required `unitId`, `tenantId`, `startDate`, `endDate`, `rentAmount` (this is the full amount for the cycle — rule 5, never multiply by 12), `paymentFrequency`. On success, create the initial `RENT` invoice in the same transaction.

- **`app/api/v1/leases/[id]/route.ts`**
  - `GET`: full detail; tenant's emergency contact serialized as the 3 flat fields (`emergencyContactName`, `emergencyContactRelationship`, `emergencyContactPhone`) — there is no nested object in the schema.
  - `PATCH`: status transitions and renewal execution. Renewal = create a **new** `Lease` with `renewedFromId` pointing at the old one, set old lease `status = EXPIRED` — never a `PENDING_RENEWAL` status value, it doesn't exist (rule 6).

- **`app/api/v1/leases/[id]/notices/route.ts`** — `GET`/`POST` across all 6 `NoticeType` values (`RENEWAL_OFFER`, `RENT_INCREASE`, `DEFAULT_NOTICE`, `EXPIRATION_ALERT`, `PAYMENT_REMINDER`, `TERMINATION_NOTICE`), tracking `sentAt`/`viewedAt`/`respondedAt`/`status`. "Leases in renewal" query = `Lease.status = ACTIVE AND Notice(type: RENEWAL_OFFER, status IN [SENT, VIEWED, COUNTERED])` exactly as rule 6 specifies.

- **`app/api/v1/leases/[id]/notes/route.ts`** — `GET`/`POST`, `MANAGER`/`ADMIN` only. `Note.leaseId` is optional in the schema (notes can also just be about a user) — this route always sets it.

---

## Phase 4 — Financial, Invoicing & Payments API

- **`app/api/v1/invoices/route.ts`**
  - `GET`: filter `type` (7 `InvoiceType` values incl. `ASSOCIATION_FEE`, **not** `SERVICE_CHARGE` — removed per rule 12/CLAUDE.md), `status`, `dueDate`.
  - `POST`: RBAC `MANAGER`/`ADMIN` unrestricted; `VENDOR` restricted to `type: MAINTENANCE` **and** must be the `vendorId` assigned on the referenced `maintenanceRequestId` (tightened from the original proposal's "any vendor"). App-level validation: at least one of `leaseId`/`maintenanceRequestId`/`userId` must be set — Prisma can't express this as a constraint (rule "Multi-FK models"). `invoiceNumber` is never set by application code — it's `dbgenerated` (rule 11); on the rare `P2002` collision, retry the insert once.

- **`app/api/v1/invoices/[id]/route.ts`** — `GET` detail + payments; `PATCH` status/amount, `MANAGER`/`ADMIN` only.

- **`app/api/v1/payments/initialize/route.ts`** — `POST`: create Paystack checkout tx ref, pending `Payment` row (`provider: PAYSTACK`).

- **`app/api/v1/payments/webhook/route.ts`** — `POST`, HMAC SHA-512 verification against `PAYSTACK_SECRET_KEY` before touching the body. On `charge.success`: set `Payment.paidAt`, `Invoice.status = PAID`, store the raw payload in `Payment.rawProviderPayload` (exact field name confirmed in schema).

- **`app/api/v1/payments/autopay/route.ts`** — `GET` active `AutoPayMandate` for tenant; `POST` register (`paymentMethodToken`, never raw card data — schema comment is explicit about this); `DELETE` soft-cancel (`status = CANCELLED`, never a hard delete).

---

## Phase 5 — Access Control & Visitor Management API

> **Never `prisma.accessCode.delete()`** — `AccessLog.accessCode` is `onDelete: Cascade`; a hard delete wipes the audit trail (rule 1).

- **`app/api/v1/access-codes/route.ts`**
  - `GET`: active/historical codes for a unit.
  - `POST` (`TENANT`): `unitId`, `code`, `validFrom`, optional `validUntil` (null = permanent). **Note**: unlike `Invoice.invoiceNumber`, `AccessCode.code` has no DB-level `@unique` constraint — generation must handle collision-avoidance in application code (retry-on-conflict against an app-level uniqueness check, scoped at minimum by unit + active status).

- **`app/api/v1/access-codes/[id]/route.ts`**
  - `GET` details.
  - `DELETE` — **soft-revoke only**: `update({ status: 'REVOKED', revokedAt: new Date() })`. RBAC: creator or property manager.

- **`app/api/v1/access-codes/verify/route.ts`** — `POST`: validate `status === ACTIVE`, `validFrom <= now`, `validUntil == null || validUntil >= now`. Insert an `AccessLog` row. **Refinement over the original proposal**: `AccessLogAction` has 4 values (`GRANTED|DENIED|EXPIRED_ATTEMPT|REVOKED`), not 2 — use `EXPIRED_ATTEMPT` specifically when the code is past `validUntil`, `REVOKED` when someone tries a revoked code, and reserve generic `DENIED` for a genuinely unrecognized code. This distinction is the entire point of the enum per the schema comment ("full audit trail of access activity," PRD §5.3).

---

## Phase 6 — Communications API

- **`app/api/v1/conversations/route.ts`**
  - `GET`: threads for `session.sub` via `ConversationParticipant`, with unread counts (`lastReadAt` vs latest `Message.createdAt`).
  - `POST`: **Refinement over the original proposal** — the schema's `ConversationType` has 5 values (`DIRECT`, `MAINTENANCE_THREAD`, `LEASE_THREAD`, `COMMUNITY_DISCUSSION`, `SUPPORT`), and the original proposal only covers creation linked to `leaseId`/`maintenanceRequestId`. Also support `propertyId`-linked creation (`COMMUNITY_DISCUSSION`) and unlinked creation (`DIRECT`/`SUPPORT`, participants only) — decide the exact contract (which fields are required per type) when this route is actually built.

- **`app/api/v1/conversations/[id]/messages/route.ts`** — `GET` cursor-paginated (via `lib/api/pagination.ts`'s cursor mode); `POST` — RBAC: caller must be a `ConversationParticipant`.

---

## Phase 7 — Frontend Integration & State Hydration

Per the original proposal, scoped once Phases 1–6 exist:
- Extend `lib/apiClient.ts` with domain-grouped typed methods.
- New hooks: `hooks/useProperties.ts`, `useMaintenanceRequests.ts`, `useLeases.ts`, `useInvoices.ts`, `useAccessCodes.ts`.
- Wire forms to their routes: `MaintenanceRequestForm.tsx` → `POST /maintenance/requests`, `ScheduleViewing.tsx` → `POST /properties/[id]/viewings`, `VendorCreateInvoice.tsx` → `POST /invoices`, `ListProperty.tsx` → `POST /properties`, `AddTenantForm.tsx` → `POST /leases`.

## Phase 8 — Background Workers & Cron Jobs

Per the original proposal: Rent Invoicer, Overdue Flagger (unpaid + past `dueDate` → `OVERDUE`, issue `PAYMENT_REMINDER`), Maintenance Schedule Dispatcher (`nextDueDate` → new `MaintenanceRequest`), Access Code Expiry Janitor, Payment Reliability Scorer (writes `Lease.paymentReliability`/`riskScore`/`riskScoreUpdatedAt`).

---

## Also noted, no action needed right now

- `register/route.ts` still sets `status: UserStatus.ACTIVE` directly (not `PENDING_VERIFICATION`) — matches `CLAUDE.md`'s "Deliberately deferred" note exactly; correct as-is until the email phase (flip `register` to `PENDING_VERIFICATION` and relax `login`'s 403 in the same commit, per that note).
- `package.json` shows Next.js `14.2.15`; `CLAUDE.md`'s header says "Next.js 15" — a stale doc claim, not a code issue.
- `docs/auth-walkthrough.md` is stale (references `/api/auth/*` not `/api/v1/auth/*`, and a `middleware.ts` that no longer exists in this repo) — historical record only.

---

## Verification Plan

- After Phase 0-pre: `pnpm exec tsc --noEmit` (0 errors), `pnpm build`, manual check that `RoleSwitcher` is absent under `NODE_ENV=production` and present in dev, manual check that a page reload with an expired access token but valid refresh token keeps the session alive.
- After Phase 0: no runtime surface yet — smoke test via a throwaway import, delete after.
- After each domain phase (1–6): `pnpm exec tsc --noEmit`, `pnpm build`, then manual RBAC boundary tests per role (Tenant/Manager/Landlord/Vendor/Admin) against the new routes, plus the two schema-invariant checks called out in `CLAUDE.md`: soft-revoke on `DELETE /access-codes/[id]` (confirm `AccessLog` rows persist after), and unit-relation price filtering on `GET /properties`.
- Final: `pnpm exec prisma generate` (confirm all 33 models still compile — no schema changes are planned in this pass, this is a regression check).
