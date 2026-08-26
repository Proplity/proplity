# Phase 10, sub-phase 5 — Leases & Tenancy test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Fifth sub-phase of Finding 3. Covers `app/api/v1/leases/*` (4 routes) — the domain with the tenant-invite flow (the most complex single POST handler in the API) and two of CLAUDE.md's most emphasized rules: rule 5 (`rentAmount` per cycle, never multiplied) and rule 6 (renewals are `Notice`, not a `LeaseStatus`).

## What was built

`tests/api/leases.test.ts` (19 tests, 6 describe blocks), no new fixtures needed beyond what 10.3/10.4 already added:

- **list** — VENDOR rejected outright (not in the route's allowed roles at all); TENANT sees only their own lease, MANAGER only leases on their own properties, ADMIN sees every lease.
- **create** — TENANT/VENDOR rejected; `canManageProperty()` gating on the target unit's property (a manager can't lease out a unit they don't own); the existing-`tenantId` path rejects an id that isn't a real `TENANT` user (400); a real create round-trip confirms the auto-created initial invoice's `amount` equals `rentAmount` **exactly** (rule 5 — this is the one place in the API that could have silently multiplied by a payment-frequency factor, and doesn't). The `tenantEmail` path gets three separate tests: reusing an existing `TENANT` account by email (no duplicate created), inviting a genuinely new email (creates a `PENDING_VERIFICATION` user plus a `VerificationToken` row — verified directly via `testPrisma`, since the raw invite token is only ever sent through the console-transport email and can't be recovered from its one-way SHA-256 hash in the DB to drive a real verify round-trip in this test), and rejecting an email that belongs to an existing *non*-`TENANT` account (400).
- **`[id]` read access** — owning tenant and managing owner both get 200; an unrelated tenant gets 403.
- **`[id]` PATCH** — TENANT rejected outright (route-level role restriction, ownership is irrelevant); a non-owning manager rejected; the owning manager can update `status`; an empty body is a 400 ("no valid update provided"); and the renewal test locks in rule 6 directly: `PATCH .../renew` creates a **new** `Lease` row with `renewedFromId` pointing at the old one, the new lease starts `ACTIVE`, and the old lease is re-fetched via `testPrisma` afterward and confirmed `EXPIRED` — there is no `PENDING_RENEWAL` status anywhere in this flow, by construction.
- **notices** — creation is managing-owner-only; the owning tenant attempting to create (no `id` in the body) is 403, since the route's create branch is staff-only regardless of who's asking. The tenant *can* respond to an existing notice, but only with one of the allowed statuses (`VIEWED`/`ACCEPTED`/`REJECTED`/`COUNTERED`) — setting `SENT` as the tenant is 403, setting `VIEWED` stamps `viewedAt`, and setting `ACCEPTED` stamps `respondedAt`, both checked directly on the response body. GET is forbidden for a caller who is neither the owning tenant nor the managing owner.
- **notes** — the one route in this domain scoped to `['ADMIN', 'MANAGER']` only, **deliberately excluding LANDLORD** (an explicit comment in the route source, distinct from every other lease route where `canManageProperty()` treats LANDLORD the same as MANAGER). Tested directly: a LANDLORD who owns the property still gets 403 on both GET and POST `.../notes`, alongside TENANT. MANAGER can create and list.

## Errors and fixes

The invite test originally tried to prove the new `PENDING_VERIFICATION` account is "blocked from login until verified" by POSTing `/auth/login` with an arbitrary password and expecting 403. That's wrong: `login`'s own logic checks password validity (via `bcrypt.compare`) *before* it ever checks account status, so a wrong password on *any* account returns 401 regardless of status -- the arbitrary password made the test assert the wrong branch. Since the invite route never returns the real randomly-generated password to any caller (by design -- it's not meant to be known), there's no way to drive a genuine 403 login round-trip against this specific invited user from a test. Fixed by dropping the login attempt and keeping only the two real, verifiable claims this route is responsible for: the DB row's `status` and the `VerificationToken`'s existence. Login's actual `PENDING_VERIFICATION` → 403 behavior is already covered, correctly, in `auth.test.ts` (10.2) using a fixture user with a known password.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 4 files, 78/78 passing (59 carried over from 10.1–10.4 + 19 new).

## What's next

10.6 — Financial: `Invoice`'s multi-FK "at least one of" validation, `invoiceNumber`'s db-generated uniqueness, the payment webhook's HMAC-SHA512 verification, and autopay mandates.
