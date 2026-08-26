# Phase 10: Automated Test Suite — plan

**Status:** planning, not yet built. Addresses Finding 3 of `out/next-phase-analysis.md` — zero automated test coverage; every one of the first 9 phases was verified by hand against the live dev server and then thrown away.

## Goal

Turn the manual `curl`-against-live-dev-server-then-clean-up verification style this project has used for every phase into something that persists as regression protection: a real HTTP-level test suite hitting the actual 36 API routes, with real RBAC and business-rule assertions, runnable with one command and safe to run repeatedly without touching the seeded dev database.

Not in scope for this phase: component/UI tests (no browser-automation tool available in this environment, same caveat as every frontend phase), CI wiring (no `.github/workflows` exists yet — a natural follow-up once the suite itself is trustworthy, not bundled in here), and testing the live Paystack API call (still blocked on a real test-mode account per Finding 4 — the webhook and everything else *is* in scope).

## Key decisions

**Runner: Vitest.** No test runner exists in the repo today. Vitest over Jest — native ESM/TS, no transform config needed, fast, and the project's `tsx`-based scripts already lean toward the same tooling family.

**Real HTTP against a real running server, not direct handler imports.** `getServerSession()` → `lib/auth/session.ts` calls `next/headers`'s `cookies()`, which requires the Next.js request-scoped `AsyncLocalStorage` context — it throws when a route handler is imported and invoked directly outside an actual request. Every route in this codebase either calls `getServerSession()` directly or goes through `withAuth()`, which does the same — so direct-import testing is off the table for essentially every route. Tests instead run against a real `next dev` process (started once per test run, on its own port) using native `fetch`, mirroring exactly what the manual `curl` verification has done in every phase so far, just made repeatable.

**A dedicated `proplity_test_db`, not the seeded dev database.** Confirmed the `postgres` role has `CREATEDB`. Test runs drop/recreate this database and apply `prisma migrate deploy` at the start of every run, so tests never risk the real seed data (`User: 9, Property: 4, ...` — the baseline every phase doc has carefully preserved) and never depend on its exact contents either. `.env.test` (gitignored, alongside a committed `.env.test.example` template) points at it; the test-run `next dev` process loads `.env.test` instead of `.env`.

**Two Prisma clients, cleanly separated.** The app-under-test uses its normal singleton (`lib/db.ts`) inside the spawned server process, pointed at the test DB via env. Tests themselves get their own plain `PrismaClient` (`tests/helpers/db.ts`) against the same test DB, used only for fixture setup/teardown and out-of-band assertions (e.g. confirming a soft-revoke didn't cascade-delete `AccessLog` rows) — never imported into application code.

**Fixtures via direct Prisma writes, not via the API.** Faster and keeps each test file's assertions about *the route under test* rather than a chain of setup routes. A `tests/helpers/fixtures.ts` factory module provides `createUser(role, overrides)`, `createProperty()`, `createUnit()`, `createLease()`, `createInvoice()`, `createMaintenanceRequest()`, `createAccessCode()`, `createConversation()`, each returning real rows with sane defaults so a test only has to override what it cares about.

**Auth in tests: mint a JWT directly, don't re-run login for every test.** `tests/helpers/auth.ts` exports `authCookie(userId, role)` — calls the app's own `signAccessToken()` (`lib/auth/jwt.ts`) and returns a ready-to-send `access_token=...` cookie string. This avoids hammering the DB-backed rate limiter (`LoginAttempt`, 5/5min) and keeps every non-auth test file fast and independent of login's own correctness. `tests/api/auth.test.ts` is the one file that *does* exercise real `POST /login` end-to-end, since that route is itself under test there.

**CSRF: tests must send a matching `Origin` header.** `validateCSRF()` compares `Origin`'s host against `Host`; Node's `fetch` doesn't set `Origin` automatically the way a browser does, so the test client (`tests/helpers/client.ts`) sets `Origin: http://localhost:<testPort>` on every mutating request. A dedicated CSRF test (missing/mismatched Origin → 403) still lives in `auth.test.ts`, since CSRF is exercised on every mutating auth route except `verify-email`.

**Isolation between test files: truncate-and-reseed, not shared state.** `resetDb()` (`tests/helpers/db.ts`) truncates every app table (`TRUNCATE ... RESTART IDENTITY CASCADE`, full table list pulled from the schema) and runs once per test file's `beforeAll`, not per-test — fast enough given each file's fixtures are self-contained, and avoids 36 routes' worth of tests silently depending on execution order.

## Directory layout

```
tests/
  setup/
    globalSetup.ts       # Vitest globalSetup: drop/create proplity_test_db, prisma migrate deploy
  helpers/
    db.ts                # testPrisma client + resetDb()
    fixtures.ts           # createUser/createProperty/createUnit/createLease/createInvoice/...
    auth.ts               # authCookie(userId, role)
    server.ts             # spawns `next dev` on a test port against .env.test, waits for ready, exposes baseUrl
    client.ts             # apiFetch(path, {method, body, cookie}) — sets Origin, parses JSON, exposes status
  api/
    auth.test.ts
    properties.test.ts
    maintenance.test.ts
    leases.test.ts
    financial.test.ts     # invoices + payments (webhook, autopay)
    access-control.test.ts # access-codes + verify
    communications.test.ts # conversations + messages
    vendors-and-admin.test.ts # vendors, admin/users, cron guard
```

`vitest.config.ts` at the repo root: `globalSetup: ['tests/setup/globalSetup.ts']`, `environment: 'node'`, generous timeouts (server boot + real Postgres round-trips), `testTimeout`/`hookTimeout` raised (dev-server first-compile can be slow).

## npm scripts

```json
"test": "vitest run",
"test:watch": "vitest"
```
`globalSetup` handles DB prep automatically on every `vitest run` — no separate `pretest` step needed. The spawned `next dev` test server is started/stopped from within the same globalSetup (one process for the whole run, not per file), since routes only need to compile once.

## Sub-phase breakdown

Mirroring Phase 9's rhythm — one sub-phase per commit, each with a phase doc, `tsc --noEmit` clean, and the full suite passing (not just the new file) before moving on:

- **10.1 — Infrastructure.** Vitest config, `globalSetup`, all `tests/helpers/*`, `.env.test.example`, npm scripts. Proven with one smoke file (`auth.test.ts`'s login/me/logout/CSRF-rejection cases) exercising the full harness end to end.
- **10.2 — Auth, rest of it.** Register, refresh rotation + reuse-detection revokes the family, change-password, verify-email (incl. its CSRF exemption), rate limiting, role-casing (`withAuth({roles:['MANAGER']})` uppercase-only).
- **10.3 — Properties & Units.** `scope=mine`, public unauthenticated browsing, price filter through `Unit.rentAmount`, `sqft`↔`squareFeet` alias, `canManageProperty()` gating, verified-review `leaseId` rule, moderation status.
- **10.4 — Maintenance & Operations.** `MaintenanceRequest.categoryId` nullable vs. `MaintenanceSchedule.categoryId` required, priority defaults, vendor assignment + `vendorNotes` patch path, rating, category table CRUD.
- **10.5 — Leases & Tenancy.** Tenant-invite flow (creates `PENDING_VERIFICATION` user + `VerificationToken`), notices, notes, `rentAmount` never multiplied by payment frequency, renewals modeled as `Notice` not a `LeaseStatus` value.
- **10.6 — Financial.** Invoice multi-FK "at least one of" validation, `invoiceNumber` uniqueness/db-generation, payment webhook HMAC-SHA512 verification (valid/invalid signature), autopay mandate creation.
- **10.7 — Access Control & Communications.** Access-code creation/verify, rule 1 (revoke never deletes, `AccessLog` survives), conversation create/list, message send, `unreadCount` lifecycle (grows then clears on read — the Phase 9.5 fix).
- **10.8 — Cross-cutting.** Vendor reputation computed at query time (not cached), `GET /admin/users` role gate + `propertiesCount`, `CRON_SECRET` guard on `POST /cron/[job]`.

## Verification per sub-phase

`pnpm exec tsc --noEmit` → `pnpm test` (full suite, not just the new file) → phase doc → commit. Final sub-phase also gets a closing doc-sync pass on `CLAUDE.md`/`CURRENT_STATE.md`/`PROJECT_STRUCTURE.md` (adds a "Testing" section), matching the pattern used after Phase 9.
