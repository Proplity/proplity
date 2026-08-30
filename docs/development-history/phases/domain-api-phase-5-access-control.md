# Phase: Domain API Phase 5 — Access Control & Visitor Management API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Fifth domain API: tenant-issued visitor access codes and gate-side verification, backing PRD §5.3's "full audit trail of access activity."

## What was built

Three routes, exactly as scoped in `docs/development-history/domain-api-implementation-plan.md`'s Phase 5 section:

- **`app/api/v1/access-codes/route.ts`** — `GET` (`?unitId=` required, optional `?status=`) for the unit's creating tenant or `canManageProperty()`; `POST` (`TENANT`, must have an `ACTIVE` lease on the unit — the same guard pattern as Phase 2's maintenance requests) enforces per-unit uniqueness among `ACTIVE` codes in application code, since `AccessCode.code` has no DB-level `@unique` (unlike `Invoice.invoiceNumber`) — a collision returns `409 CODE_CONFLICT` rather than silently overwriting or auto-regenerating.
- **`app/api/v1/access-codes/[id]/route.ts`** — `GET` (creator or `canManageProperty()`); `DELETE` is **soft-revoke only** (`status: 'REVOKED', revokedAt: new Date()`), gated the same way — never `prisma.accessCode.delete()`, since `AccessLog.accessCode` is `onDelete: Cascade` and a hard delete would wipe the unit's entire access audit trail (rule 1).
- **`app/api/v1/access-codes/verify/route.ts`** — `POST` (`ADMIN`/`MANAGER` — see role note below), looks up the most recently created matching code for the unit+code pair and classifies the attempt into the schema's full 4-value `AccessLogAction` (`GRANTED`/`DENIED`/`EXPIRED_ATTEMPT`/`REVOKED`), inserting one `AccessLog` row per attempt (never overwriting history) with `ipAddress` (via the existing `getClientIp()` from the rate-limit module) and `deviceInfo` (User-Agent).

## Two real ambiguities resolved, both forced by the schema rather than guessed

**1. What "DENIED" actually means.** The plan's text says "reserve generic `DENIED` for a genuinely unrecognized code," but `AccessLog.accessCodeId` is a **required FK** — there is no `AccessCode` row to attach a log entry to for a code that doesn't exist at all, so that reading is schema-impossible. Resolved instead as: no matching row → return a result with no `AccessLog` write (nothing to audit against, since there's no code to log against); `DENIED` is reserved for a code that **does** exist, isn't `REVOKED`, isn't expired, but still doesn't qualify — in practice this is `status: USED` (a single-use code presented again) or a `validFrom` still in the future. Verified live by both branches: an unrecognized code produces no log row (`NOT_FOUND` response only), and a code manually set to `USED` produces a real `DENIED` log entry.

**2. Whether verification should transition a code to `USED`.** The schema has `USED` as a distinct `AccessCodeStatus` alongside `ACTIVE`/`EXPIRED`/`REVOKED`, implying some codes are single-use — but there's no `singleUse` flag distinguishing those from a deliberately reusable "permanent gate code" (the schema comment's own example for `validUntil: null`). Auto-flipping every granted code to `USED` would silently break the permanent-code use case; not flipping any leaves single-use codes never actually consuming. **Not built** — flagged as a known follow-up below rather than guessed, since guessing wrong here corrupts data either way.

## Judgment call: `verify` role-gated to ADMIN/MANAGER

The plan doesn't specify auth for `verify`, and there's no dedicated device/kiosk auth mechanism anywhere in this codebase — the endpoint is realistically called by gate/security staff, not a random authenticated tenant. Gated to `ADMIN`/`MANAGER` (not `LANDLORD` or `TENANT`) as the closest fit to "staff operating the gate," flagged as a placeholder pending a real device-auth design rather than treated as a final answer.

## Known follow-up, not built here

Verified access codes never transition to `USED` (see ambiguity #2 above) — every code stays `ACTIVE` indefinitely until manually revoked or naturally past `validUntil`. Whichever product decision resolves single-use vs. reusable codes should also decide whether that's a flag on `AccessCode` or inferred some other way; this phase deliberately left it alone rather than picking a default that breaks one of the two real use cases.

## Verification performed

Full live end-to-end pass against the real dev server and seeded database, using 4 of the 5 demo roles (`VENDOR` used only as the "unrelated caller" negative case — access codes have no vendor use case):

- `POST /api/v1/access-codes` as a vendor with no lease on the unit → `403`; as the owning tenant, a permanent code (`validUntil: null`) → `201`; the identical `unitId`+`code` again while still `ACTIVE` → `409 CODE_CONFLICT`; a second, distinct, already-expired-window code → `201`
- `GET /api/v1/access-codes?unitId=...` as an unrelated vendor → `403`; as the owning tenant and as the property's manager → `200`
- `GET /api/v1/access-codes/[id]` as an unrelated vendor → `403`
- `POST /api/v1/access-codes/verify` as a tenant (not `ADMIN`/`MANAGER`) → `403`; as manager, all 4 `AccessLogAction` outcomes individually confirmed against real data: `GRANTED` (active, permanent, in-window), `EXPIRED_ATTEMPT` (past `validUntil`), `REVOKED` (after a real `DELETE` soft-revoke), `DENIED` (status manually set to `USED`) — each produced exactly one new `AccessLog` row with the correct action and a real `ipAddress`; a genuinely unrecognized code produced `NOT_FOUND` with **no** log row, confirmed by directly querying the table
- `DELETE /api/v1/access-codes/[id]` as an unrelated vendor → `403`; as the creating tenant → `200`; confirmed via direct DB read that the row still exists with `status: REVOKED` (soft-revoke, not a real delete)
- All test rows (2 access codes and their `AccessLog` entries) cleaned up afterward via a one-off script

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 3 new routes listed alongside the existing 56.

## Next up

Phase 6 — Communications API (`app/api/v1/conversations/*`), already spec'd in `docs/development-history/domain-api-implementation-plan.md`. This is the last domain-API phase before Phase 7 (frontend integration) and Phase 8 (background workers).
