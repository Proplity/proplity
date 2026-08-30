# Phase 10, sub-phase 2 — Auth domain test coverage

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

Second sub-phase of Finding 3 (`docs/development-history/next-phase-analysis.md`). Sub-phase 10.1 built the harness and proved it end-to-end with a 5-test login/me/logout smoke suite; this sub-phase fills in the rest of `/api/v1/auth/*` — register, refresh rotation, change-password, verify-email — with the real security/business-rule assertions CLAUDE.md documents for each.

## What was built

All added to the existing `tests/api/auth.test.ts` (one file per domain, per the plan) as four new `describe` blocks, each with its own `beforeAll(resetDb)` for isolation:

- **`register`** (4 tests) — CSRF rejection, invalid-payload 400, case-insensitive role mapping (`role: 'manager'` → `manager`; an unrecognized string falls back to `TENANT`), and a combined success/duplicate/rate-limit test: register once (200, `ACTIVE`, cookies set), then 5 duplicate-email attempts (409 each, consuming `register:<ip>`'s rate-limit budget since only the duplicate-email path calls `recordAttempt`), then a 6th (429).
- **`refresh rotation + reuse detection`** (4 tests) — the security-critical path CLAUDE.md flags explicitly: login → refresh (200, new cookie pair differs from the old one) → replay the *old*, now-rotated-away token (401, reuse detected) → confirm the legitimately-rotated token is now *also* dead (401), proving the whole `familyId` was revoked, not just the reused token. Plus missing-cookie 401 and CSRF-mismatch 403.
- **`change-password`** (4 tests) — unauthenticated 401, CSRF 403, wrong-current-password 400, and a full happy path: change succeeds → the refresh token minted at login is now revoked (subsequent `/refresh` with the same cookie → 401) → old password no longer logs in → new password does.
- **`verify-email`** (6 tests) — missing/unknown/expired token all 400; activates without touching the password when none is supplied (the tenant-invite path, where a password already exists); activates *and* sets a new password when one is supplied (the self-registration-email path this route was extended for); and a direct test of rule 3 — a request with a deliberately mismatched `Origin` still succeeds, proving the route's CSRF exemption is real, not just documented.
- **`tests/helpers/fixtures.ts`** additions — `createVerificationToken(userId, overrides)` (mirrors the route's own SHA-256 token hashing so the route can find what the test creates) and `fillRateLimit(identifier, count)` (seeds `LoginAttempt` rows directly, for testing a 429 branch that the refresh route itself has no legitimate way to trigger — it checks the rate limit but never calls `recordAttempt`, so nothing organically exhausts it).

Total: `tests/api/auth.test.ts` now has 23 tests across 5 describe blocks (the original login/me/logout smoke suite plus these four), all passing.

## A real environment detail, not a bug

The refresh-rate-limit test's first attempt (seeding `refresh:127.0.0.1` directly) failed — the route came back 401 ("Missing refresh token") instead of 429, meaning `checkRateLimit` found 0 matching rows despite 5 being seeded. Root cause: `getClientIp()`'s hardcoded `'127.0.0.1'` fallback only applies when `x-forwarded-for` is truly absent, but Next's own dev server sets that header to the real loopback address for a local request — `::1` (IPv6), not `127.0.0.1` — since Node's `fetch` connects to `localhost` over IPv6 first. The seeded rows' identifier (`refresh:127.0.0.1`) never matched what the app actually queried (`refresh:::1`).

Not a bug in the app — `getClientIp()` behaves exactly as documented (CLAUDE.md already notes the header is client-suppliable behind a misconfigured proxy; this is the same mechanism, just observed from the dev server's own loopback behavior). Fixed on the test side: the test now discovers the real IP the server sees by triggering one genuine recorded login attempt first and reading its identifier back, instead of assuming a literal string.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — 23/23 passing, ~24s wall time.
- Re-ran `pnpm build` — unaffected (no app code changed this sub-phase, only `tests/`).

## What's next

10.3 — Properties & Units: `scope=mine`, public unauthenticated browsing, price filter through `Unit.rentAmount`, `sqft`↔`squareFeet` alias, `canManageProperty()` gating, verified-review `leaseId` rule, moderation status. First sub-phase needing new fixture factories (`createProperty`, `createUnit`) beyond `createUser`.
