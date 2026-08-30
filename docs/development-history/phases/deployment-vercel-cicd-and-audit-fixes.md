# Vercel deployment prep, GitHub Actions CI/CD, and six audit fixes

**Status:** Code complete, build/typecheck/format verified. **Test suite not executed — see "Verification performed".** **Date:** 2026-08-30.

## Why

The user asked to prepare the repo for deployment on Vercel and set up CI/CD. Mid-phase they surfaced a four-agent audit outline (security, API routes, public pages, dashboard) from an earlier session and asked for it to be checked; the verified subset was then fixed in the same pass.

The audit outline was **partly stale by the time it was reviewed** — its item 25 ("background workers still built-but-unscheduled, no cron config exists anywhere") had already been resolved by this phase's own `vercel.json`. Findings from a prior session's tree should be re-verified against the working tree before being acted on, not taken at face value.

## What was built

### Part 1 — deployment blockers found by actually running the build

`node_modules` was stale on arrival: it held Next 14.2.15 / React 18.3.1 from an `npm install` dated 2026-08-05, while `package.json` specified Next 16.3.2 / React 19.2.8 / Prisma 7.9.1. Nothing below was trustworthy until `pnpm install --frozen-lockfile` replaced it.

| Blocker | Consequence if shipped |
|---|---|
| No `prisma generate` on install or build | Vercel caches `node_modules`; the generated client would ship stale or missing |
| `prisma.config.ts` used `env('DATABASE_URL')`, which throws at config load | `PrismaConfigEnvError` broke `generate` outright when the var was absent |
| Cron route was `POST` + `x-cron-secret` only | Vercel Cron sends `GET` + `Authorization: Bearer`; every scheduled run would 405 |
| Both `package-lock.json` and `pnpm-lock.yaml` committed | Vercel may select npm and install a different tree than the one tested |
| `typescript.ignoreBuildErrors: true` | Masked type errors; removing it immediately exposed a real one (below) |
| `lint` script ran `next lint` | Removed in Next 16 — the script errored out. No ESLint config exists anywhere in the repo |
| No `engines` / `packageManager` | Node and pnpm versions unpinned on the build machine |

Fixes: `postinstall: prisma generate`; `prisma.config.ts` reads `process.env` directly and omits the `datasource` key entirely when no URL is present (`generate` needs no database, so it must not throw); `packageManager: pnpm@10.28.0` and `engines.node >= 20.9.0`; `package-lock.json` and `install.log` untracked and gitignored; `lint` replaced with `typecheck`.

**`DIRECT_URL` was added** (`prisma.config.ts`, read only by the CLI). `prisma migrate deploy` takes a session-level advisory lock that a transaction-mode pooler silently drops, so migrations need an unpooled connection while the app runtime keeps the pooled one. Falls back to `DATABASE_URL`, so a single-URL setup needs no configuration. The database host was undecided at the time of writing, so this is deliberately provider-agnostic.

**Removing `ignoreBuildErrors` surfaced a real error**: `timingSafeEqual` in `lib/workers/auth.ts` rejected `Buffer`, which no longer structurally satisfies `Uint8Array` under this repo's `@types/node`. Fixed with `TextEncoder`. This is the argument against re-adding the flag.

**A speculative fix that had to be reverted:** an `outputFileTracingIncludes` entry for `@prisma/client` was added on the theory that pnpm's nested store confuses Next's serverless tracer. Its glob matched a sibling *directory* (`@prisma/client-runtime-utils`), which Turbopack tried to read as a file and panicked on. `serverExternalPackages` already covers this. A comment in `next.config.mjs` records why it must not be re-added.

### Part 2 — Vercel + GitHub Actions

`vercel.json` pins framework, install/build commands, region (`fra1`, closest to the Nigerian market), the cron schedule, and `maxDuration: 60` for the cron function.

**Cron under the Hobby plan.** Hobby allows 2 cron jobs at once-a-day granularity; there are 5 workers. So one daily schedule hits a new `all` job that fans out to every worker **in dependency order** — invoicing must create the cycle's invoices before the overdue flagger judges what is late, and both must land before payment reliability is rescored. One worker failing does not abort the rest (independent sweeps; one outage should not silently skip four other jobs); failures are collected and the response is a 500 if any occurred, so a partial failure shows red in Vercel's cron log rather than a false green. Per-worker Pro schedules are documented in `DEPLOYMENT.md` §4 for after an upgrade.

`verifyCronSecret` now accepts `Authorization: Bearer` (Vercel Cron's fixed, non-configurable scheme) **and** the original `x-cron-secret` (crontab/CI/curl), compared with `timingSafeEqual`.

**Pipeline** (`.github/workflows/ci.yml`): `quality` + `test` → `migrate` → `deploy`, the last two gated to `main`. Migrations run in CI, not the Vercel build, so preview deploys never touch the production database — this was an explicit user decision. `vercel.json` sets `git.deploymentEnabled.main = false` so Actions owns production; that is what makes "migrate before deploy" actually ordered, since Vercel's Git integration cannot sequence it. `concurrency` cancels superseded branch runs but **never on main**, so a deploy is never killed mid-migration. `preview.yml` deploys PR previews without waiting for tests and skips forks (no secrets).

**`JWT_SECRET`, `DATABASE_URL` and `CRON_SECRET` are required at BUILD time**, not just runtime — `next build` sets `NODE_ENV=production`, and `lib/db.ts`, `lib/auth/jwt.ts` and `lib/workers/auth.ts` each throw at module load without them. Confirmed by reproducing the failure. This is a deliberate fail-fast guard and was documented rather than removed.

### Part 3 — audit findings verified, then fixed

Nine findings were checked against the code first. Four details in the outline were wrong; two of those made a finding *worse* than reported:

- **`GET /properties/[id]` was understated.** Not merely missing an `isPublished` filter — the handler was a bare `export async function GET`, never wrapped in `withAuth`, so it was fully unauthenticated and also returned complete `units` data.
- **The access-code route's stated `min(4)` check did not exist**; its schema was a bare `z.string()`.
- **Rate limiting was overstated** as covering 5 of 59 route files; it covers 3 (`login`, `register`, `refresh`).
- **Severity ordering was adjusted.** The outline put access-code scoping first, but that requires a valid ADMIN/MANAGER session (staff privilege escalation), whereas the property leak is exploitable by an unauthenticated stranger. The property leak was fixed first.

| # | Fix | File |
|---|---|---|
| 2 | Unpublished properties no longer publicly readable | `app/api/v1/properties/[id]/route.ts` |
| 1 | Access-code verify scoped to the property | `app/api/v1/access-codes/verify/route.ts` |
| 6 | Base URL for outbound email links | `lib/appUrl.ts` + 4 call sites |
| 22 | Health check endpoint | `app/api/v1/health/route.ts` |
| 3 | Manager-code redemption made atomic | `app/api/v1/manager-codes/redeem/route.ts` |
| 10 | Unit double-booking guard | `app/api/v1/leases/[id]/route.ts` |

**#2 — three-tier visibility.** Published stays fully public (property discovery browses it logged-out and must keep working). Unpublished requires the manager/landlord/ADMIN — **or a sitting tenant**. That carve-out matters: a landlord can unpublish a property that still has occupants, and the tenant-facing page reads this same endpoint, so fixing the leak naively would have locked tenants out of their own home. Returns 404, not 403 — a 403 confirms the id exists, which is the fact being protected.

**#1 — property scoping.** Now loads the unit's property and gates on `canManageProperty()`, matching every sibling access-code route, plus the `min(4)` floor the create route already applies (verified). The damage was not only an information leak: a `GRANTED` single-use code is *consumed*, so a stranger manager could burn a tenant's code and write to their access audit trail.

**#6 — `lib/appUrl.ts`.** Resolves `NEXT_PUBLIC_APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → localhost. The Vercel production var is preferred over `VERCEL_URL` deliberately: `VERCEL_URL` changes every deploy, so an emailed link built from it rots. All four hardcoded `http://localhost:3000` links (register, tenant-invite, and two in property-moderation) migrated.

**#3 — atomic redemption.** A single `updateMany` with `status: 'ACTIVE', linkedManagerId: null` in the `WHERE`, so the database picks the winner — the same pattern used for refresh-token rotation. The pre-write read now survives only to distinguish "revoked" from "already claimed" in the error message, and on a loss the row is re-read so the caller gets the reason true *now*.

**#10 — guarded at activation, not creation.** Leases default to `PENDING`, so creating one on an occupied unit is harmless and legitimate — next year's lease is normally signed before this year's ends. Blocking creation would have broken lease succession while fixing nothing. Both activation paths are covered: `status → ACTIVE`, and `renew` (excluding the lease being renewed *from*, which is set `EXPIRED` moments later). The guard throws `UnitAlreadyOccupiedError` rather than returning a response, because returning from inside `$transaction` would commit the `lease.update` that already ran; it maps to a 409 carrying `conflictingLeaseId`.

**Known limit on #10:** the guard runs inside a transaction, but Postgres defaults to READ COMMITTED, so two *simultaneous* activations of different pending leases could still both pass. The race-proof completion is a partial unique index (`CREATE UNIQUE INDEX ... ON "Lease"("unitId") WHERE status = 'ACTIVE'`). Deliberately not added: it needs a migration, and shipping an untested migration into a pipeline that auto-applies migrations to production is not a blind risk worth taking. `#3`'s `updateMany` has no such caveat — it is race-proof at the database.

### A pre-existing test asserted the vulnerability

`tests/api/properties.test.ts`'s soft-archive test probed `GET /properties/[id]` **unauthenticated** to prove the row survives a DELETE — which silently also asserted that anyone holding the id could read an unpublished property. The intent (soft-delete, not hard-delete) is still valid, so the probe was changed to use the manager's cookie and an assertion added that anonymous now gets 404.

Before writing the new access-code tests, every existing `verify` test's fixtures were checked: all use `createProperty({ managerId: manager.id })`, so scoping passes, and the one short code (`'x'`) sits in a TENANT test rejected by role *before* validation. No other breakage.

## Verification performed

- `pnpm typecheck` — clean, re-run after every edit. This is now meaningful because `ignoreBuildErrors` was removed.
- `pnpm format:check` — clean. The user ran `pnpm format` across the tree mid-phase (124 files); `prettier-plugin-tailwindcss` reorders Tailwind class names, so that pass edited JSX rather than only whitespace, and typecheck + build were re-run afterwards because of it. The CI step was then promoted from `continue-on-error` to a real gate.
- `pnpm build` — 57/57 pages, `/api/v1/health` and `/api/v1/cron/[job]` present in the manifest.
- **Clean-room install** with every env var unset — `postinstall`'s `prisma generate` succeeds, confirming the Vercel install path.
- **Cron auth, 8/8 cases** — Bearer correct/wrong, `x-cron-secret` correct/wrong, no headers, missing `Bearer ` prefix, empty bearer, length-mismatched prefix. (An initial version of this harness set `process.env` *after* an ESM import; hoisting meant the module had already read the old value. Set it externally.)
- **Cron route over real HTTP** — 401 unauthenticated on both `GET` and `POST`; both credential schemes reach dispatch (404 on an unknown job), proving the gate passes. `GET` previously 405'd.
- **`appUrl` precedence, 7/7 cases** — including trailing-slash stripping and each fallback rung.
- **Health endpoint against an unreachable database** — 503 in 278 ms, no error detail in the body.

**Not performed: `pnpm test`.** The suite needs a real Postgres; local credentials were unavailable (`postgres/postgres` fails auth, no `rojitech` role, no passwordless sudo to create one). **The 20 new tests in this phase are unexecuted** and will first run in CI against its `postgres:18` service container. Suite total is now 214 `it` blocks, up from 194.

New tests: 7 for property-detail visibility (published/anon, unpublished/anon, unpublished/logged-in stranger, own manager, ADMIN, sitting tenant, tenant-of-another-property), 4 for access-code scoping (including that a rejected cross-property attempt neither burns the single-use code nor writes an audit row), 2 for manager-code concurrency (two redemptions fired with `Promise.all`, asserting exactly `[200, 409]` and that the persisted winner matches the 200 response), 5 for double-booking (409 + `conflictingLeaseId`, rollback leaves the lease `PENDING`, creation still allowed, activation succeeds after termination, idempotent re-PATCH), 2 for health.

## What's next

Blocked on user decisions:

- **Password reset does not exist** (audit #4) — `ForgotPassword.tsx` only calls `setSubmitted(true)`; no `forgot-password`/`reset-password` route was ever built. `proplity_progress.md` listed both under "Phase 4" and they were never reached. Needs a real email provider first, so it is genuinely blocked, not merely unstarted.
- **Contact form discards every submission** (audit #5) — no fetch, no route. Needs a decision on destination (DB table, forwarded email, webhook).
- **Email is still console-transport** — the *links* inside those emails are now correct in every environment; only delivery is missing.

Ready to do, no decisions needed: the partial unique index for #10 (needs a database to test the migration); landing-page fake data (audit #7/#8 — hardcoded ids 1–6 that always 404 against real cuids); `TenantDetail.tsx` role gating (#11); units-import validation (#13).

Still open from the audit and untouched here: no error tracking/observability anywhere (#23); rate limiting on 3 of 59 route files (#24); no in-app or push notifications (#16); no resident directory (#17); `NeighbourhoodReport` has no create endpoint (#18); zero test coverage on `neighbourhood-report` and `viewings` (#28).
