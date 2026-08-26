# Phase 10, sub-phase 1 — Automated test infrastructure

**Status:** Complete and verified. **Date:** 2026-08-23.

## Why

First sub-phase of Finding 3 from `out/next-phase-analysis.md` (zero automated test coverage — every prior phase was verified by hand against the live dev server, then thrown away). Full plan in `out/phase-10-test-suite-plan.md`. This sub-phase builds the harness only: no route coverage yet beyond a smoke test proving every piece works end to end.

## What was built

- **Vitest** (`vitest`, new devDependency) — no test runner existed in the repo before this.
- **`vitest.config.mts`** — `globalSetup`/`setupFiles` wiring, `fileParallelism: false` (test files share one DB and truncate it, so must run sequentially), generous timeouts for real server-boot + real Postgres round-trips.
- **`.env.test.example`** (committed template) / **`.env.test`** (gitignored, added `.env.test` explicitly to `.gitignore` since the existing `.env*.local` pattern didn't cover it) — points at a **separate** `proplity_test_db`, distinct `JWT_SECRET`/`CRON_SECRET`.
- **`tests/setup/globalSetup.ts`** — runs once per `pnpm test`: drops and recreates `proplity_test_db`, applies `prisma migrate deploy` against it, spawns a real `next dev` server against `.env.test`, waits for it to answer, tears it down after.
- **`tests/setup/loadEnv.ts`** — a Vitest `setupFiles` entry loading `.env.test` into each test-worker process (a different process than `globalSetup`), so helpers that import app code directly (e.g. to mint a JWT) see the right secrets.
- **`tests/helpers/db.ts`** — a test-side `PrismaClient` (own driver-adapter construction, matching `lib/db.ts`'s pattern) plus `resetDb()`, which truncates every table it finds in `information_schema` rather than a hardcoded list, so it can't silently go stale as the schema grows.
- **`tests/helpers/fixtures.ts`** — `createUser()` factory (`Password123!`, bcrypt-hashed, matching the seeded dev accounts' convention). More factories (`createProperty`, `createLease`, etc.) get added in the sub-phases that actually need them, not built speculatively here.
- **`tests/helpers/auth.ts`** — `authCookie(userId, role)` mints a real JWT directly via the app's own `signAccessToken()`, bypassing the login route for every test file except `auth.test.ts` itself. Keeps the DB-backed login rate limiter (5/5min) out of every other domain's test runs.
- **`tests/helpers/client.ts`** — `apiFetch()` against the real spawned server over HTTP (native `fetch`), setting `Origin` on every request (Node's `fetch` doesn't send it the way a browser does, and `validateCSRF()` requires it), plus `cookieHeaderFrom()` to round-trip `Set-Cookie` values from a login response into the next request's `Cookie` header.
- **`tests/api/auth.test.ts`** — 5 smoke tests: CSRF rejection on a mismatched Origin, invalid-credentials 401, `PENDING_VERIFICATION` account blocked at login, a full login → cookies set → `/me` → `/logout` round trip, and unauthenticated `/me` → 401.
- **`package.json`** — `pnpm test` (`vitest run`), `pnpm test:watch`.

## A real Next 16 constraint discovered and worked around

Next 16 enforces a single `next dev` process per `distDir` via an OS-level lockfile at `<distDir>/lock` — a second `next dev` in the same project directory refuses to start, even on a different port, and reports the existing server's PID. The first attempt at spawning the test server collided with an already-running `pnpm dev` session and failed outright ("Another next dev server is already running").

Fixed by making `distDir` conditional in `next.config.mjs`: `distDir: process.env.NEXT_TEST_DIST_DIR || '.next'`. The test harness sets `NEXT_TEST_DIST_DIR=.next-test` only on the spawned test server's own environment — a developer's regular `pnpm dev` never sees that variable and keeps using `.next` untouched. Verified directly: ran the test suite, confirmed the dev-database row counts (`User: 9, Property: 4`) were unaffected, and confirmed `pnpm build` still succeeds with the conditional `distDir` in place. `.next-test/` added to `.gitignore`.

One small, accepted side effect: the first time `next dev` runs against the new `.next-test` distDir, it auto-appends two `include` globs to `tsconfig.json` (`.next-test/dev/types/**/*.ts`, `.next-test/dev/dev/types/**/*.ts`) — Next's own TypeScript-detection behavior, additive and harmless, committed alongside this sub-phase rather than fighting it.

## Why HTTP against a real server, not direct handler imports

`getServerSession()` (`lib/auth/session.ts`) calls `next/headers`'s `cookies()`, which requires the Next.js request-scoped `AsyncLocalStorage` context set up by an actual incoming request — it throws if a route handler is imported and called directly outside of one. Since every route in this codebase goes through `getServerSession()` or `withAuth()` (which wraps it), direct-import testing was never viable here. Real HTTP against a real spawned server is the only approach that exercises the actual auth path — and it's also just a repeatable version of the `curl`-against-live-dev-server verification every phase has already been doing by hand.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — 1 file, 5 tests, all passing, ~13s wall time (includes DB recreate + migrate + server boot).
- `pnpm build` — still succeeds with the conditional `distDir`.
- Confirmed the dev database (`proplity_db`) row counts are untouched after a full test run (`User: 9, Property: 4`) — the test suite only ever touches `proplity_test_db`.
- Confirmed no residual server process is left running after `pnpm test` exits (globalSetup's teardown `server.kill('SIGTERM')`).

## What's next

Sub-phases 10.2–10.8 add real RBAC/business-rule coverage per domain (auth's remaining routes, properties, maintenance, leases, financial, access-control/communications, then the cross-cutting vendors/admin/cron routes), each its own commit + phase doc, per `out/phase-10-test-suite-plan.md`.
