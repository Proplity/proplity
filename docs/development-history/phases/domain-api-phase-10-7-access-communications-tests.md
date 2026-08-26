# Phase 10, sub-phase 7 — Access Control & Communications test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Seventh sub-phase of Finding 3. Covers `app/api/v1/access-codes/*` (3 routes) and `app/api/v1/conversations/*` (2 routes) — the domain with CLAUDE.md's rule 1 (never hard-delete an `AccessCode`, `AccessLog` must survive) and the `unreadCount` gap Phase 9.5 fixed, now locked in as a regression test.

## What was built

- **`tests/helpers/fixtures.ts`** — added `createAccessCode()`, `createConversation()`.
- **`tests/api/access-control.test.ts`** (13 tests, 4 describe blocks):
  - **list** — `unitId` required (400 without), 404 for an unknown unit, allowed for the managing owner and the unit's active-lease tenant, forbidden for an unrelated tenant.
  - **create** — `TENANT`-only route; requires an `ACTIVE` lease on the unit; a duplicate `ACTIVE` code on the *same* unit is refused (409, the app-level uniqueness check the route's own comment explains is standing in for a real DB constraint), while the identical code string on a *different* unit is fine — confirming the conflict check is correctly scoped per-unit, not global.
  - **`[id]` GET/DELETE — rule 1 directly** — creator and managing owner can view; a stranger is forbidden. The DELETE test is the one built specifically to prove rule 1: it first drives a **real** `AccessLog` row into existence through the actual `verify` endpoint (not a raw fixture insert, so the assertion is about real route-produced audit data), then revokes the code and confirms via `testPrisma`: the response is `status: 'REVOKED'` with `revokedAt` set, the `AccessCode` row itself still exists, and the `AccessLog` count for that code is unchanged — nothing cascaded away.
  - **verify** — `ADMIN`/`MANAGER` only; an unknown code returns `{granted: false, reason: 'NOT_FOUND'}` and creates **no** `AccessLog` row at all (there's no `accessCodeId` to attach one to, confirmed by comparing the global log count before/after); then one test per real outcome branch the route computes — a currently-valid `ACTIVE` code grants and logs `GRANTED` (with the log row fetched back and its `action` checked directly), a `REVOKED` code logs `REVOKED`, a code past `validUntil` logs `EXPIRED_ATTEMPT`, and a code whose `validFrom` is still in the future logs `DENIED`.
- **`tests/api/communications.test.ts`** (8 tests, 4 describe blocks):
  - **`MAINTENANCE_THREAD`** — `maintenanceRequestId` required (400), 404 for an unknown request, forbidden for a caller who is neither the tenant/vendor/property-manager on that request; a real create is checked against `testPrisma` for the *exact* derived participant set (tenant + vendor + manager, no more, no fewer). A second test proves the one-thread-per-request idempotency (`maintenanceRequestId` is `@unique` on `Conversation`): POSTing twice for the same request returns the same conversation id both times, and the DB only ever has one row for it.
  - **`LEASE_THREAD` / `COMMUNITY_DISCUSSION`** — `LEASE_THREAD` forbids a stranger and derives tenant + manager + landlord as participants (checked directly). `COMMUNITY_DISCUSSION` requires either management or an active lease on the property to even create the board, and the created board's participant set is checked to include every active tenant on the property, not just the creator.
  - **`DIRECT` dedup, and list** — empty `participantIds` is 400; the caller is auto-added even though only the other participant's id was supplied; POSTing the same 1:1 pair twice returns the existing thread rather than spawning a duplicate (checked both via the response id and a direct `testPrisma` count). `GET /conversations` is confirmed to return conversations only for an actual participant — a similarly-privileged but uninvolved user gets an empty list, not an error, just nothing.
  - **messages, participant gating + the `unreadCount` lifecycle** — a non-participant is 403 on both reading and sending. The lifecycle test is the direct regression check for Phase 9.5's fix: sender sends a message, the recipient's own `GET /conversations` shows `unreadCount: 1` for that thread; the recipient then reads the thread (`GET .../messages`), and a follow-up `GET /conversations` shows `unreadCount: 0` — proving `lastReadAt` actually advances on read, not just that it exists as a column; a reply from the recipient then correctly flips the *original sender's* `unreadCount` back to 1, confirming the read-marker is genuinely per-participant, not a single shared flag.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 7 files, 117/117 passing (96 carried over from 10.1–10.6 + 21 new).

## What's next

10.8 — the final sub-phase: cross-cutting routes not tied to a single domain-API phase — vendor reputation (computed at query time, rule 8), `GET /admin/users`, and the `CRON_SECRET` guard on `POST /cron/[job]`. Closes out Finding 3.
