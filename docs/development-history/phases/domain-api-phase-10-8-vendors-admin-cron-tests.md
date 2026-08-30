# Phase 10, sub-phase 8 — Vendors, Admin Users & Cron test coverage

**Status:** Complete and verified. **Date:** 2026-08-23. **Final sub-phase of Phase 10.**

## Why

Eighth and final sub-phase of Finding 3 (`docs/development-history/next-phase-analysis.md`). Covers the three routes that don't belong to any single domain-API phase: `GET /vendors` and `GET /admin/users` (both built during Phase 9's frontend hydration to backfill listing capabilities that never existed), and `POST /cron/[job]` (Phase 8's background-worker dispatcher). This closes out Finding 3 — every one of the 36 API routes now has automated regression coverage.

## What was built

`tests/api/vendors-and-admin.test.ts` (9 tests, 3 describe blocks), no new fixtures needed:

- **vendors** — `TENANT`/`VENDOR` callers rejected (`ADMIN`/`MANAGER`/`LANDLORD` only); the core test is a direct proof of rule 8 ("no cached `reputationScore` column, compute at query time"): a vendor with 3 assigned jobs (2 `COMPLETED`, 1 `IN_PROGRESS`) and one `VendorRating` of 4 comes back with `totalJobs: 3`, `jobsDone: 2`, `completionRate: 67` (`Math.round(2/3 * 100)`), `rating: 4` — all computed live from real `MaintenanceRequest`/`VendorRating` rows, not read off a stored field. A `SUSPENDED` vendor is confirmed absent from the list entirely (`where: {status: 'ACTIVE'}`); a vendor with zero jobs and zero ratings correctly comes back with `completionRate: null`/`rating: null` rather than `0` (a real difference — `0%` completion means jobs were assigned and none finished, `null` means no jobs exist to judge yet); and a vendor with no `VendorProfile` row falls back to their own `name` as `businessName`.
- **admin/users** — non-`ADMIN` rejected; a real list confirms `passwordHash` is `undefined` on every row (the route's `select` whitelist makes this structurally impossible to get wrong, but it's cheap to assert directly); `propertiesCount` is checked against a manager who actually manages 2 real properties (`= 2`) alongside a tenant with none (`= 0`); `?role=` filtering is checked to return only matching rows.
- **cron** — no secret header → 401; wrong secret → 401; an unknown `:job` segment → 404, with the response's `knownJobs` list checked to actually contain a real job name (not just any array); and the one test that runs a **real worker** end-to-end rather than mocking it: `access-code-expiry-janitor` against a real `AccessCode` fixture seeded `ACTIVE` with a `validUntil` in the past — the route call returns `{expired: 1}` (or more, since `beforeAll`'s `resetDb()` scopes this to just this file's data), the code's `status` is confirmed `EXPIRED` via `testPrisma` afterward, and running the exact same request again returns `{expired: 0}` — proving the worker is genuinely idempotent, not just "doesn't crash twice."

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 8 files, 126/126 passing (117 carried over from 10.1–10.7 + 9 new).

## Phase 10 complete

This closes Finding 3 from `docs/development-history/next-phase-analysis.md`. Every one of the 36 API routes across all 8 domain-API phases plus the Phase 9 additions now has automated HTTP-level test coverage: 126 tests in 8 files, run with one command (`pnpm test`), against a dedicated database that's dropped and recreated on every run, with zero risk to the seeded dev database (re-verified this sub-phase, same as every prior one: `proplity_db`'s row counts are untouched by a full test run). The only two things this suite does not and cannot cover, both explicitly documented rather than silently skipped: `/payments/initialize`'s real call to Paystack's API (would be a live network call to an external service; still blocked on a real test-mode account per CLAUDE.md's own gap list) and any interactive browser behavior (no browser-automation tool available in this environment, the same caveat every frontend phase in this engagement has carried).

`CLAUDE.md`/`CURRENT_STATE.md`/`PROJECT_STRUCTURE.md` are now due for another sync pass — they currently say "Automated tests: None exist" / "0%", which is no longer true.

## What's next

Only Finding 4 (`docs/development-history/next-phase-analysis.md`'s punch list — real Paystack test-mode key, real email provider, cron scheduling decision, `Unit.status`/`AccessCode.USED` gaps) remains from the original post-roadmap analysis.
