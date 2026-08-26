# Phase: Domain API Phase 3 — Leases & Tenancy API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Third domain API: lease creation, status transitions, renewal (rule 6's `Notice`-driven negotiation model), and the notice/note sub-resources that back the PRD's "AI-drafted renewal/rent-increase/default notices" workflow.

## What was built

Four routes, exactly as scoped in `out/domain-api-implementation-plan.md`'s Phase 3 section:

- **`app/api/v1/leases/route.ts`** — `GET` role-scoped (`TENANT` → own, `MANAGER`/`LANDLORD` → leases on units of properties they manage/own, `ADMIN` → all; `VENDOR` excluded entirely — no legitimate use case); `POST` (`ADMIN`/`MANAGER`/`LANDLORD`, ownership-checked via `canManageProperty()` on the unit's property) validates the `tenantId` actually references a `TENANT`-role user, then creates the `Lease` and its initial `RENT` `Invoice` in one interactive `$transaction` (`rentAmount` used as-is — the full cycle amount, never multiplied, per rule 5).
- **`app/api/v1/leases/[id]/route.ts`** — `GET` (owner tenant, or `canManageProperty()` on the unit's property) returns full detail including the tenant's three flat emergency-contact fields (no nested object exists in the schema, so nothing to transform beyond an explicit field-select that excludes `passwordHash`), notices, invoices, and both renewal-chain directions (`renewedFrom`/`renewedInto`). `PATCH` (`ADMIN`/`MANAGER`/`LANDLORD`, ownership-checked) branches into a plain status transition or a `renew` operation — renewal creates a **new** `Lease` with `renewedFromId` pointing at the old one and `status: 'ACTIVE'`, sets the old lease to `EXPIRED`, both in one transaction. No `PENDING_RENEWAL` status is used anywhere (rule 6).
- **`app/api/v1/leases/[id]/notices/route.ts`** — `GET` (owner tenant or manager/landlord/admin); `POST` does double duty as create-or-update in a single file (matching the plan's one-file scoping, no `[noticeId]` subroute): creating a notice is a staff-only action (`canManageProperty()`); updating one splits further — the owning tenant may only move `status` to `VIEWED`/`ACCEPTED`/`REJECTED`/`COUNTERED` (auto-stamping `viewedAt`/`respondedAt`), while staff can update any field including transitioning to `SENT` (auto-stamps `sentAt`).
- **`app/api/v1/leases/[id]/notes/route.ts`** — `GET`/`POST`, `MANAGER`/`ADMIN` only exactly as scoped (deliberately **not** extended to `LANDLORD`, unlike the maintenance-list judgment call in Phase 2 — the plan explicitly enumerated only two roles here, not left it ambiguous). Always sets `leaseId`, since `Note.leaseId` is optional at the schema level for notes that are just about a user.

## Real bug found and fixed: schema drift between `schema.prisma` and the actual database

Live testing (`GET /api/v1/leases/[id]`) failed with a `500` the moment the query touched `Notice` — Postgres error `P2022: The column Notice.viewedAt does not exist`. `schema.prisma` already declared the field (and CLAUDE.md's own enum reference already lists `TERMINATION_NOTICE` as a valid `NoticeType`), but no migration had ever been generated for either change. Confirmed via `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` that the live database was missing exactly the changes CLAUDE.md already documents as intended:
- `Notice.viewedAt` column (never migrated)
- `NoticeType` enum missing `TERMINATION_NOTICE` (never migrated)
- `InvoiceType` enum still had `SERVICE_CHARGE` (CLAUDE.md's "Deliberately deferred" section says this was already removed from scope — schema agreed, DB didn't)
- A cosmetic `Invoice.invoiceNumber` default-expression reformat with no functional difference

Checked for any `Invoice` rows using `SERVICE_CHARGE` before dropping it from the enum (`0` found — safe). Wrote the diff's exact SQL into a new migration (`prisma/migrations/20260822172214_sync_schema_drift/migration.sql`) and applied it with `prisma migrate deploy` (non-interactive-safe; `migrate dev` refuses to run in this environment). `prisma migrate status` now reports the database up to date, and the failing query succeeds. This was pre-existing drift, not something introduced by this phase's work — but it blocked Phase 3 from being testable at all, so fixing it was in scope.

## Known follow-up, not built here

Creating or activating a `Lease` does **not** currently update the unit's `UnitStatus` (e.g. `VACANT` → `OCCUPIED`). The plan's spec for lease creation didn't call for it, and the correct state-transition rules (when exactly to move to `OCCUPIED`, what happens on `TERMINATED`/`EXPIRED`, whether `RESERVED` factors in) aren't defined anywhere yet — flagging rather than guessing, since a wrong guess here would show vacant units as unavailable or vice versa on the public listing.

## Verification performed

Full live end-to-end pass against the real dev server and seeded database, using all 5 demo accounts:

- `POST /api/v1/leases` as `tenant@proplity.com` → `403`; `tenantId` pointing at a `MANAGER` user → `400`; as the unit's actual owning `manager@proplity.com` → `201` with the initial `RENT` invoice nested in the response (`invoiceNumber` DB-generated, `amount` = `rentAmount` untouched)
- `GET /api/v1/leases/[id]` as owner tenant → `200`, confirmed tenant object exposes exactly the 3 flat emergency-contact fields plus safe profile fields (no `passwordHash`); as an unrelated vendor → `403`; unauthenticated → `401`
- `GET /api/v1/leases` scoping confirmed by role via real counts (`TENANT` sees only own, `ADMIN` sees all)
- `PATCH .../[id]` plain status transition (`PENDING` → `ACTIVE`) as the owning manager → `200`
- `PATCH .../[id]` with `renew` → `201`, new lease `status: ACTIVE` with `renewedFromId` set correctly; re-fetched old lease confirmed `status: EXPIRED`
- `POST .../notices` create as tenant → `403`; as manager with `status: SENT` → `201`, `sentAt` stamped; created a `TERMINATION_NOTICE` (the enum value fixed by the migration) → `201`
- `POST .../notices` update: tenant marks `VIEWED` → `200`, `viewedAt` stamped; tenant attempts `DRAFT` → `403`; tenant `COUNTERED` → `200`, `respondedAt` stamped
- Directly verified rule 6's "leases in renewal" query (`Lease.status = ACTIVE AND Notice(type: RENEWAL_OFFER, status IN [SENT, VIEWED, COUNTERED])`) against the live database — returned exactly the lease under test
- `POST .../notes` as `landlord@proplity.com` → `403` (confirming the literal "MANAGER/ADMIN only" scoping, no `LANDLORD` extension here); as manager → `201`; `GET` as tenant → `403`; as admin → `200`
- All test rows (3 leases across the create/renew chain, their invoices, notices, and note) cleaned up afterward via a one-off script

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 4 new routes listed alongside the existing 46.

## Next up

Phase 4 — Financial, Invoicing & Payments API (`app/api/v1/invoices/*`), already spec'd in `out/domain-api-implementation-plan.md`.
