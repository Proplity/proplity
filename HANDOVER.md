# Proplity: handover

> **Latest detailed handover: [`docs/HANDOVER-2026-10-19.md`](docs/HANDOVER-2026-10-19.md)** (the 2026-10-19 period: journey recorder, flow fixes, viewing date field, notifications, attention list, the agreed next work, and exactly how to run everything). This file is the standing overview. Written 2026-10-15 for anyone (person or AI assistant) picking the project up cold. Read this first, then `CLAUDE.md` (the always-current project reference) and `CURRENT_STATE.md` (what is built, with a changelog). Keep this file current: update it in the same pass as any change that moves the facts below.

## What this is

Proplity is a property-management platform for the Nigerian market: landlords, managers, tenants, vendors and an admin. Next.js 16 App Router, Prisma 7 on PostgreSQL, JWT cookies with rotating refresh tokens, Paystack payments, Cloudinary uploads, Resend email, deployed on Vercel.

## Where things stand (2026-10-19)

- The domain API roadmap, the frontend, the background workers and the test suites are built. 98 route handlers, 43 models, 29 migrations (the newest, `20261019190000_payment_receipt_number`, comes with the offline-payments work below).
- The issue register (`docs/issues/issues.md`) is worked through: everything that can be done without outside input is built and merged to `dev`.
- **Tests:** `pnpm test` runs everything under `tests/`: 535 tests collected in 45 files (459 in the 32 files of `tests/api/`, which make real HTTP calls to a spawned `next dev` on port 3101, plus the 76 below). `pnpm test:unit` runs only the 76 fast unit/fuzz/security/anomaly tests (13 files, mocked Prisma; 76 of 76 pass, run 2026-10-19). Stryker mutation testing achieves 85.71% mutation score (`pnpm test:mutation`). Autocannon load testing (`pnpm test:load`) and 100k units query scaling benchmark (`pnpm benchmark:100k`). Playwright E2E: 56 tests across 15 spec files (`playwright test --list`). `pnpm lint`: 0 errors, 25 warnings (run 2026-10-19: 17 unused imports or variables, 7 `any` in tests, 1 effect set-state hint; CI fails only on errors).
- **Code scan (2026-10-19):** a security and bug scan of `dev` found and fixed ISS-059 to ISS-082 (see `CURRENT_STATE.md` and the register). Two were serious: a manager could re-approve and publish a rejected listing, and could edit another property's units via staged `metadata`; both only existed in the ADR-0013 property-edit code (on `dev` and `main`, not `prod`). Not changed, by decision: vendor payouts are still allowed before the invoice is paid; passwords still need only 6 characters at sign-up, password reset and password change (the first-run setup wizard needs 8, with a letter and a number); a full script-level CSP is not set.
- **2026-10-19 work:** a UI-only 19-act journey recorder (`scripts/record-user-journey.mjs`) and a re-recorded video; flow fixes ISS-084 to ISS-097 (merged to `dev` and `main`); access-code screens; phone layout; Schedule Tour date field and Lagos-time viewing hours; a visitor profile on viewing requests; a View invoice breakdown on repairs; notifications for every action that needs someone; a **Needs your attention** list on every dashboard; a `reminders` cron job (10 jobs now). #110 and #111 are on `dev` only: the next release is a PR `dev` into `main`.
- **Built earlier and recorded in the `CURRENT_STATE.md` changelog (not repeated here):** the session-restore fix (ISS-057), the auto-pay charger (ISS-011), the sliding-window rate limiter (ISS-021), bank-transfer reconciliation and vendor payouts (ISS-012), file-gateway unification (ISS-038), invite-code rate limiting, the app-wide file viewer, PWA support, the testing hardening (mutation, fuzz, security, load and 100k-unit benchmark; ISS-030, ISS-058), photo management on existing listings, duplicate-listing merge and undo, the lint cleanup and the subscription-downgrade modal.
- **Branches:** `dev` is the integration branch, `main` is staging, `prod` is production. Work goes on a short-lived branch, then a PR into `dev`, then `dev` into `main`, then `main` into `prod`. All stale local and remote feature branches merged into `dev` have been pruned.
- **Repo and CI:** GitHub `Proplity/proplity`. CI runs typecheck, lint, format check, build, the API integration suite and Playwright. Vercel's GitHub integration posts preview deployments (the custom preview workflow was removed).

## What is left

### Built on branches, not yet on `dev` (details in `docs/development-history/phases/`)

1. **Repair follow-through** (`feat/repair-follow-through`, migration `20261019171917_repair_follow_through`): vendor before/after photos, tenant Confirm fixed / Still a problem, the property team's Approve work / Send back / Give to another vendor, an admin on/off switch, the broken "Mark as Completed" button removed (ISS-100 to ISS-102, ISS-105 to ISS-110). **Not built, never agreed:** a 7-day "silence is confirmed" rule.
2. **Offline payments and receipts** (`feat/offline-payments-and-receipts`, stacked on 1, migration `20261019190000_payment_receipt_number`): a "Paid another way" form, a Bank Transfers list where someone other than the recorder confirms, a receipt for every payment (ISS-103, ISS-111 to ISS-115).
3. **Re-record the walkthrough video** after 1 and 2 (`scripts/record-user-journey.mjs`; see `docs/HANDOVER-2026-10-19.md` §5.3).
4. Parked until the owner decides: manager-initiated repairs (work orders), recurring-schedules screen, viewing availability (ISS-104). Also an open question (ISS-110): should the assigned vendor see the unit's gate code while a job is open?

### Security hotfix to `prod` (do not wait for the next release)

**ISS-105 (P0), ISS-111 and ISS-112 (P1) are live on `prod`:** the repair page returns whole user rows (password hash, ID document link, date of birth, emergency contact) to the other people on a repair; the bank-transfers list returns every submission to a vendor; payment rows returned by the invoice and lease routes include the provider payload (payer email, card details). The fixes are in the two branches above. Consider asking people who share a repair with others to change their password, because the hashes were readable. A minimal patch for only these three routes can be cut from the branches if the full release is not close.

### Needs a person (production checks, before releasing `dev` to `prod`)

1. Only if `20261014090000_payment_ref_unique` has not been applied to the production database yet (it is already on the `prod` branch; check with `prisma migrate status`): run this on production and fix any rows it returns: `SELECT "transactionRef", COUNT(*) FROM "Payment" WHERE "transactionRef" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;` The migration aborts if duplicates exist.
2. ISS-020: check production for duplicate accounts.
3. Smoke-test uploads on staging.
4. Confirm the production environment variables (see `DEPLOYMENT.md`).
5. Compliance sign-off on the identity-document retention periods before setting `RETENTION_ENABLED=true`.
6. Run the production migrations and confirm before deploying. Three migrations are on `main` and `dev` but not on the `prod` branch (and two more arrive with the branches above, see the end of this item): `20261016122746_bank_reconciliation_and_vendor_payouts` (new `BankTransferSubmission` and `VendorPayout` tables, enums and indexes), `20261018200000_property_metadata` (the ADR-0013 staged edits: a nullable `Property.metadata` JSON column) and `20261019100000_autopay_attempt_tracking` (`lastAttemptAt` and `consecutiveFailures` on `AutoPayMandate`). All three only add structure; none backfills or deletes rows. The two newer ones: `20261019171917_repair_follow_through` (a new enum, nine nullable or defaulted columns on `MaintenanceRequest`, one defaulted column on `SystemSettings`, an index and a foreign key; no row is changed, so repairs already completed stay "not requested") and `20261019190000_payment_receipt_number` (adds `Payment.receiptNumber` as `NOT NULL` with a database-generated default, which gives every existing payment a number, then a unique index; it touches every `Payment` row, so run it off-peak). Every earlier migration (including `payment_ref_unique`, `trust_score_computed`, `one_active_autopay_per_lease`, `listing_hash_backfill`, `property_photo_urls` and `perf_scale_indexes`) is already on the `prod` branch, but the repo cannot say whether each has been applied to the production database: run `prisma migrate status` against it first. To list the difference: `git diff --stat origin/prod origin/main -- prisma/migrations`.
7. Promote `dev` into `main` (staging) and then into `prod` (production).

### Blocked on something outside the code

- **ISS-010:** live Paystack calls. Needs a real Paystack account / test-mode keys.
- **ISS-035:** storage providers. Need real credentials for non-Cloudinary drivers.
- **ISS-011, ISS-039:** background workers built; require environment flags (`AUTOPAY_WORKER_ENABLED=true`, `RETENTION_ENABLED=true`) once live operations and NDPR sign-offs are finalized.

## How to work in this repo

- **Setup and run:** see `docs/setup-guide.md` and `CURRENT_STATE.md` ("How to Run & Verify"). Seeded demo accounts share the password `Password123!` (admin@, manager@, landlord@, tenant@, vendor@ `proplity.com`).
- **Commands:** `pnpm dev`, `pnpm test` (API suite), `pnpm exec playwright test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec prettier --check .`.
- **Docs rule (important):** every change updates, in the same pass, `docs/issues/issues.md` (never delete rows), `CURRENT_STATE.md`, `docs/PRD-as-built.md`, `docs/proplity-step-by-step-role-guide.md` where a screen changed, and the test and route counts in `CLAUDE.md`, `CURRENT_STATE.md` and `docs/testing-guide.md`. Guide screenshots come from `scripts/capture-guide-screenshots.mjs`, `capture-admin-screenshots.mjs` and `capture-listing-screenshots.mjs` (each needs a seeded database and the app running; the header of each script says how).
- **Merge conflicts:** `CURRENT_STATE.md` and `docs/issues/issues.md` conflict on nearly every PR because each adds a line in the same place. Keep both sides.

## Pitfalls that have cost time

- **Stale Prisma client or DB:** after switching branches, run `pnpm exec prisma generate`, delete `.next/types`, `.next/dev/types` and `.next-test/dev/types`, and run `pnpm exec prisma migrate deploy` against your dev database. A "Failed to load" error on a page right after a branch switch is usually this.
- **Full test suite is slow** (about 7 minutes). Run it in the background and wait for it to finish rather than polling.
- **Ports:** free a stuck dev server with `fuser -k <port>/tcp`, not a broad `pkill`.
- **First Playwright run on a cold dev server** can time out while pages compile; rerun before assuming a real failure.
- **Run Playwright against a production build, as CI does** (`pnpm build`, `pnpm start`, `E2E_BASE_URL`), with the same flags CI sets (`NEXT_PUBLIC_EMAIL_INBOX_ENABLED`, `EMAIL_INBOX_ALLOW_IN_PRODUCTION`, `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`) exported to the Playwright process too, or the inbox and mock-payment specs skip themselves. Against `next dev` four specs fail for reasons that are not bugs: the Next.js dev badge sits on top of the sent-emails button and swallows the click, and routes compile on first use. If the app is not on port 3000, also set `NEXT_PUBLIC_APP_URL` **at build time** (it is inlined), or the mock checkout redirects to the wrong port. Use another `distDir` (`NEXT_TEST_DIST_DIR=.next-journey`) so a running `pnpm dev` is not disturbed, and restore `tsconfig.json` afterwards (`git checkout -- tsconfig.json`): both `next dev` and `next build` rewrite it.
- **Sharing a machine with other projects:** the API suite's port 3101 can be taken by another project's server, which makes every test return 404; change `TEST_PORT` locally (do not commit) and do not kill the other project's processes.
- **Journey and video work:** UI-only (clicks, typing, file choosing), from a fresh DB; a failing step is a product bug. See the 2026-10-19 handover §5.3 for env vars, snapshots and the act-ordering caveat.
- **The assistant used so far could not merge PRs or delete remote branches** (blocked by its permission rules), so the owner merges.
- **Commit attribution:** commits end with the co-author line the tooling asks for; PR bodies end with the generated-with line. Follow whatever your own tooling requires.

## Design rules worth knowing before editing

- **Money:** payments are recorded from the Paystack webhook, with `Payment.transactionRef` unique and a row lock on the invoice, so a duplicate or replayed webhook cannot double-count. A paid amount that differs from the invoice, or a payment on a cancelled invoice, is audit-flagged (`PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_ON_CANCELLED_INVOICE`, `PAYMENT_EXCEEDS_INVOICE`). Manual cash or transfer payments are recorded by the property side and audited.
- **Auth:** `withAuth` reads the user row on every request, so a suspended account or a changed role takes effect immediately. Admin actions on users need a reason and are audit-logged.
- **URLs:** any URL a client stores and the app later renders goes through `safeUrl` (`lib/api/urlField.ts`).
- **Properties:** a new listing starts `PENDING_REVIEW`; only an admin-approved listing can be published. `trustScore` is computed daily by the `property-trust-scorer` worker (null until scored). Neighbourhood report saves are versioned.
- **Workers:** `GET /api/v1/cron/all` (daily 02:00 via `vercel.json`) runs the jobs in `ALL_JOBS_IN_ORDER`; each can also run alone at `POST /api/v1/cron/[job]` or from `scripts/workers/`.

## Where to read more

`docs/HANDOVER-2026-10-19.md` (the detailed, current handover) · `CLAUDE.md` (architecture, conventions) · `CURRENT_STATE.md` (state and changelog) · `docs/issues/issues.md` (every known issue, status and where it lives) · `docs/PRD-as-built.md` (what the product does versus the original PRD) · `docs/adr/` (decisions) · `DEPLOYMENT.md` (deploy, CI, env vars, cron) · `docs/testing-guide.md` (QA checklist) · `docs/proplity-step-by-step-role-guide.md` (click-by-click per role).
