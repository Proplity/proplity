# Proplity: handover

> Written 2026-10-15 for anyone (person or AI assistant) picking the project up cold. Read this first, then `CLAUDE.md` (the always-current project reference) and `CURRENT_STATE.md` (what is built, with a changelog). Keep this file current: update it in the same pass as any change that moves the facts below.

## What this is

Proplity is a property-management platform for the Nigerian market: landlords, managers, tenants, vendors and an admin. Next.js 16 App Router, Prisma 7 on PostgreSQL, JWT cookies with rotating refresh tokens, Paystack payments, Cloudinary uploads, Resend email, deployed on Vercel.

## Where things stand (2026-10-16)

- The domain API roadmap, the frontend, the background workers and the test suites are built. 94 route handlers, 43 models, 25 migrations.
- The issue register (`docs/issues/issues.md`) is worked through: everything that can be done without outside input is built and merged to `dev`.
- **Tests:** a full `vitest run` (integration plus unit) is 480 tests in 41 files, all passing on this branch. `pnpm test` runs 375 Vitest integration tests in 26 files (`tests/api/`), `pnpm test:unit` runs 73 fast unit/fuzz/security/anomaly tests in 12 files (~2.8s). Stryker mutation testing achieves 85.71% mutation score (`pnpm test:mutation`). Autocannon load testing (`pnpm test:load`) and 100k units query scaling benchmark (`pnpm benchmark:100k`). Playwright E2E: 52 tests across 15 spec files. `pnpm lint`: 0 errors, 0 warnings.
- **Code scan (2026-10-19):** a security and bug scan of `dev` found and fixed ISS-059 to ISS-082 (see `CURRENT_STATE.md` and the register). Two were serious: a manager could re-approve and publish a rejected listing, and could edit another property's units via staged `metadata`; both only existed in the ADR-0013 property-edit code (on `dev` and `main`, not `prod`). Not changed, by decision: vendor payouts are still allowed before the invoice is paid; passwords still need only 6 characters at sign-up (setup needs 8); a full script-level CSP is not set.
- **Branches:** `dev` is the integration branch, `main` is staging, `prod` is production. Work goes on a short-lived branch, then a PR into `dev`, then `dev` into `main`, then `main` into `prod`. All stale local and remote feature branches merged into `dev` have been pruned.
- **Repo and CI:** GitHub `Proplity/proplity`. CI runs typecheck, lint, format check, build, the API integration suite and Playwright. Vercel's GitHub integration posts preview deployments (the custom preview workflow was removed).

## What is left

### Needs a person (production checks, before releasing `dev` to `prod`)

1. Run on production, and fix any rows it returns: `SELECT "transactionRef", COUNT(*) FROM "Payment" WHERE "transactionRef" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;` The migration `20261014090000_payment_ref_unique` aborts if duplicates exist.
2. ISS-020: check production for duplicate accounts.
3. Smoke-test uploads on staging.
4. Confirm the production environment variables (see `DEPLOYMENT.md`).
5. Compliance sign-off on the identity-document retention periods before setting `RETENTION_ENABLED=true`.
6. Run the production migrations and confirm before deploying. New since the last release: `20261014090000_payment_ref_unique`, `20261014120000_trust_score_computed` (nulls the old placeholder trust score), `20261014150000_one_active_autopay_per_lease` (soft-cancels duplicate active auto-pay mandates, keeping the newest), `20261014180000_listing_hash_backfill`, `20261014200000_property_photo_urls`, `20261016100000_perf_scale_indexes`, `20261016122746_bank_reconciliation_and_vendor_payouts`.
7. Promote `dev` into `main` (staging) and then into `prod` (production).

### Blocked on something outside the code

- **ISS-010:** live Paystack calls. Needs a real Paystack account / test-mode keys.
- **ISS-035:** storage providers. Need real credentials for non-Cloudinary drivers.
- **ISS-011, ISS-039:** background workers built; require environment flags (`AUTOPAY_WORKER_ENABLED=true`, `RETENTION_ENABLED=true`) once live operations and NDPR sign-offs are finalized.

### Completed in current pass (previously pending)

- **Landing Page Session Restore (ISS-057):** Resolved session state latency by reading `getServerSession()` in `RootLayout` and passing `initialUser` directly to `AuthProvider`. Eliminates all flash of login state for authenticated visitors and ensures action links immediately point to `/admin` or `/dashboard`.
- **Auto-Pay Mandate Recurring Charging Worker (ISS-011):** Built `runAutopayCharger` in `lib/workers/autopayCharger.ts`, runner script `scripts/workers/autopayCharger.ts`, and wired into daily cron dependency chain at `/api/v1/cron/[job]`. Charges open due invoices for active leases with active mandates (via Paystack charge authorization or mock gateway), updates invoice status to PAID, and records audit logs. Safely defaults to disabled until `AUTOPAY_WORKER_ENABLED=true`. Covered by unit/anomaly tests in `tests/anomaly/financial-anomalies.test.ts`.
- **Sliding-Window Rate Limiter (ISS-021):** Upgraded `reserveAttempt` in `lib/auth/rateLimit.ts` from fixed-window counting to a true advisory-locked sliding-window log. Automatically purges expired attempt rows outside `[now - windowMs, now]` to prevent database bloat, eliminates window-edge burst doubling, and computes exact `remaining`, `resetAt`, and `retryAfterSeconds` values.
- **Bank-Transfer Reconciliation & Vendor Payouts (ISS-012):** Built full offline bank transfer submission flow (`/api/v1/bank-transfers`) and statement reconciliation approval/rejection (`/api/v1/bank-transfers/[id]/reconcile`) with row-locking, payment creation, and file proof gateway verification in `reconciliation` folder. Built end-to-end vendor payout lifecycle (`/api/v1/vendor-payouts`, `vendor-payouts/[id]`) with invoice balance checks, verified bank account validation, landlord approval, and Paystack/mock transfer settlement. Covered by 5 new tests in `tests/api/bank-reconciliation-and-payouts.test.ts`.
- **File Gateway Unification (ISS-038):** Extended secure file gateway (`lib/fileRef.ts`, `lib/uploadPolicy.ts`) with `notices`, `leases`, and `communications` folders. Enforced `assertOwnsFileUrls` on `Notice.documentUrl`, `Lease.signedAgreementUrl`, `Message.attachmentUrls`, `Violation.evidenceUrls`, and `User.avatarUrl`. Added multi-role read authorization in `canReadFile()` and unit tests in `fileRef.test.ts` and `uploadPolicy.test.ts`.
- **Manager Invite Code Rate Limiting:** Protected public `GET /api/v1/manager-codes/check` endpoint against brute-force invite code enumeration using atomic advisory-locked DB rate limiter (10 attempts / 5 mins per IP), with quota release on valid code checks. Added test in `tests/api/manager-links.test.ts`.
- **App-Wide Responsive File Viewer:** Global context (`FileViewerContext`) and responsive viewer modal (`FileViewerModal`) supporting images (pan, zoom up to 400%, 90° rotation), PDFs, videos (speed control, PiP), audio, monospace syntax-styled code/text/CSV with 1-click clipboard copy, and formatted document cards with keyboard navigation (Esc, Arrow keys, + / -). Integrated into Tenant Dashboard and Tenant Detail views for signed lease agreements.
- **Progressive Web App (PWA) Support:** Complete PWA configuration with Next.js metadata manifest (`app/manifest.ts`), versioned service worker (`public/sw.js`) with network-first shell and offline fallback, user-facing offline screen (`app/offline/page.tsx`), home screen install prompt banner (`PwaRegister.tsx`), and standalone mobile viewports.
- **Rigorous Testing Suite, Mutation Testing, Security Hardening & 100k Unit Load Benchmarks (ISS-030, ISS-058):** Stryker mutation testing (85.71% mutation score), 1,000+ adversarial fuzz tests, security RBAC & protocol smuggling tests (open redirect backslash smuggling fix in `safeRedirect.ts`), workflow and financial anomaly tests, 10 scaling indexes deployed via migration `20261016100000_perf_scale_indexes` (101 indexes total, sub-millisecond query plan seek), and autocannon load & stress testing harness.
- **Photo Management on Existing Listings:** UI modal/panel (`PropertyPhotoManager.tsx`) built and wired into `PropertyDetail.tsx` (allowing landlords and managers to add, reorder, delete, and set cover/exterior photos for existing listings via PATCH).
- **Duplicate Listing Merge & Undo Merge Workflow:** Implemented `POST/DELETE /api/v1/properties/[id]/merge` and `POST /api/v1/properties/[id]/unmerge` using `Property.mergedIntoId`, audit logs (`PROPERTY_MERGE`, `PROPERTY_UNMERGE`), exclusion from public listings, admin `MergeDuplicateModal.tsx`, Merged filter tab, and 5 new integration tests.
- **Lint Refactoring:** 100% elimination of all 138 ESLint warnings down to 0 errors and 0 warnings (eliminated 65 `any` types, 15 static component declarations, 7 unused vars, 3 purity violations, 3 immutability violations, and 45 effect set-state warnings).
- **Subscription Downgrade Confirmation:** Replaced native `window.confirm` in `Checkout.tsx` with a custom modal.

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
- **The assistant used so far could not merge PRs or delete remote branches** (blocked by its permission rules), so the owner merges.
- **Commit attribution:** commits end with the co-author line the tooling asks for; PR bodies end with the generated-with line. Follow whatever your own tooling requires.

## Design rules worth knowing before editing

- **Money:** payments are recorded from the Paystack webhook, with `Payment.transactionRef` unique and a row lock on the invoice, so a duplicate or replayed webhook cannot double-count. A paid amount that differs from the invoice, or a payment on a cancelled invoice, is audit-flagged (`PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_ON_CANCELLED_INVOICE`, `PAYMENT_EXCEEDS_INVOICE`). Manual cash or transfer payments are recorded by the property side and audited.
- **Auth:** `withAuth` reads the user row on every request, so a suspended account or a changed role takes effect immediately. Admin actions on users need a reason and are audit-logged.
- **URLs:** any URL a client stores and the app later renders goes through `safeUrl` (`lib/api/urlField.ts`).
- **Properties:** a new listing starts `PENDING_REVIEW`; only an admin-approved listing can be published. `trustScore` is computed daily by the `property-trust-scorer` worker (null until scored). Neighbourhood report saves are versioned.
- **Workers:** `GET /api/v1/cron/all` (daily 02:00 via `vercel.json`) runs the jobs in `ALL_JOBS_IN_ORDER`; each can also run alone at `POST /api/v1/cron/[job]` or from `scripts/workers/`.

## Where to read more

`CLAUDE.md` (architecture, conventions) · `CURRENT_STATE.md` (state and changelog) · `docs/issues/issues.md` (every known issue, status and where it lives) · `docs/PRD-as-built.md` (what the product does versus the original PRD) · `docs/adr/` (decisions) · `DEPLOYMENT.md` (deploy, CI, env vars, cron) · `docs/testing-guide.md` (QA checklist) · `docs/proplity-step-by-step-role-guide.md` (click-by-click per role).
