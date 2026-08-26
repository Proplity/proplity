# Phase 10, sub-phase 6 — Financial test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Sixth sub-phase of Finding 3. Covers `app/api/v1/invoices/*` and `app/api/v1/payments/*` (5 routes) — the domain with CLAUDE.md rule 11 (`invoiceNumber` is DB-generated) and the multi-FK "at least one of" validation rule, plus the one route reached by an external caller (Paystack's webhook) rather than a browser session.

## What was built

- **`tests/helpers/fixtures.ts`** — added `createInvoice()`.
- **`.env.test` / `.env.test.example`** — added `PAYSTACK_SECRET_KEY` (a local-only dummy value). The webhook route's HMAC-SHA512 signature verification never calls Paystack's network — any shared secret string works to sign and verify locally, exactly like Phase 4's original "self-signed test key" verification. This does **not** make `/payments/initialize`'s real Paystack call testable; that still needs a genuine test-mode account per CLAUDE.md's documented gap.
- **`tests/helpers/client.ts`** — added an `apiFetch` `rawBody` option (send this exact string instead of `JSON.stringify(body)`), needed so the webhook tests sign precisely the bytes actually sent rather than relying on a JSON stringify → parse → re-stringify round-trip staying byte-identical.
- **`tests/api/financial.test.ts`** (18 tests, 5 describe blocks):
  - **invoices: list scoping** — one combined test exercising all three of a TENANT's OR-branches at once (invoice via their lease, via their maintenance request, and a direct `userId` invoice that belongs to someone else stays invisible), a VENDOR seeing only invoices tied to their own assigned request, MANAGER scoped to their properties, ADMIN seeing everything.
  - **invoices: create** — TENANT *and* LANDLORD are both rejected outright (only `ADMIN`/`MANAGER`/`VENDOR` may create — landlord's absence here is deliberate, unlike most other lease-adjacent routes where `canManageProperty()` treats landlord and manager the same); the multi-FK guard (no `leaseId`/`maintenanceRequestId`/`userId` at all → 400); a VENDOR is restricted to `MAINTENANCE`-type invoices on a request actually assigned to them (wrong type → 403, someone else's request → 403); a real create confirms `invoiceNumber` comes back DB-generated (`INV-` prefix) with no application code ever setting it (rule 11).
  - **invoices: `[id]` access and PATCH** — `canAccessInvoice()`'s branches: lease tenant, lease-property manager, and (separately) a pure `userId`-owner with no lease/maintenance-request involved at all; a stranger gets 403. PATCH is `ADMIN`/`MANAGER` only.
  - **payments: initialize** — unauthenticated 401, missing-invoice 404, not-the-payer 403, already-`PAID` 409. The real success path (calling Paystack and getting back an `authorizationUrl`) is explicitly *not* attempted — doing so would be a genuine network call to an external service from inside an automated test, and CLAUDE.md already documents this exact call as never having run against a real account.
  - **payments: webhook** — the actual security boundary, tested directly: no signature header → 401; a syntactically-present but wrong signature → 401; a *valid* signature on a payload missing `metadata.invoiceId` → 400 (proves the route checks the signature before trusting anything in the body, matching its own comment); and the full happy path — a correctly-signed `charge.success` event creates a real `Payment` row and flips the `Invoice` to `PAID` (both verified directly via `testPrisma`, not just the response), with `amount` correctly converted from Paystack's kobo. A second delivery of the byte-identical signed payload (simulating Paystack's at-least-once redelivery) is confirmed **not** to create a second `Payment` row for the same `transactionRef` — the idempotency guard the route's own comment calls out.
  - **payments: autopay** — `TENANT`-only; creating a mandate on a lease that isn't the caller's own is 403; a full create → list → `DELETE` round trip confirms the mandate starts `ACTIVE`, appears in the caller's own list, and `DELETE` soft-cancels (`status: 'CANCELLED'`, row still exists via a direct `testPrisma` check afterward) rather than removing it — then confirms the now-cancelled mandate drops out of the active list.

## A design trade-off, made explicit rather than silently accepted

Configuring `PAYSTACK_SECRET_KEY` in `.env.test` is what unlocks the webhook's real signature-verification logic for testing — without it, the route's very first check (`if (!secretKey) return 503`) would short-circuit every webhook test before the interesting logic ever runs. The same env var also gates `/payments/initialize`'s "provider not configured" 503 branch, and with a key now configured, that branch is no longer reachable in this suite — `initialize`'s early-return branches (auth/404/403/409, all checked *before* the secret-key check in the route) are still fully covered, but the "not configured" 503 itself is not. Chose webhook coverage over that one branch: the webhook's HMAC verification is the actual security boundary CLAUDE.md calls out; `initialize`'s 503 is a single unconditional early return with essentially no logic to get wrong.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 5 files, 96/96 passing (78 carried over from 10.1–10.5 + 18 new).

## What's next

10.7 — Access Control & Communications: access-code soft-revoke-only (rule 1, `AccessLog` must survive), the verify endpoint, conversation create/list, message send, and the `unreadCount` lifecycle fixed in Phase 9.5.
