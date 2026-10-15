# Proplity: handover

> Written 2026-10-15 for anyone (person or AI assistant) picking the project up cold. Read this first, then `CLAUDE.md` (the always-current project reference) and `CURRENT_STATE.md` (what is built, with a changelog). Keep this file current: update it in the same pass as any change that moves the facts below.

## What this is

Proplity is a property-management platform for the Nigerian market: landlords, managers, tenants, vendors and an admin. Next.js 16 App Router, Prisma 7 on PostgreSQL, JWT cookies with rotating refresh tokens, Paystack payments, Cloudinary uploads, Resend email, deployed on Vercel.

## Where things stand (2026-10-15)

- The domain API roadmap, the frontend, the background workers and the test suites are built. 87 route handlers, 41 models, 23 migrations.
- The issue register (`docs/issues/issues.md`) is worked through: everything that can be done without outside input is built and merged to `dev`.
- **Tests:** `pnpm test` runs 365 Vitest tests in 25 files, all passing on `dev` (real HTTP against a spawned `next dev` and a recreated `proplity_test_db`). Playwright E2E: 15 spec files, CI uses one worker. `pnpm lint`: 0 errors, 132 warnings (65 `any`, 67 React-compiler hints; these need real refactors).
- **Branches:** `dev` is the integration branch, `main` is staging, `prod` is production. Work goes on a short-lived branch, then a PR into `dev`, then `dev` into `main`, then `main` into `prod`. At the time of writing, PRs up to #83 are merged or open into `dev`; `main` and `prod` do not yet have everything after #71 (PR #71 was the last `main` → `prod` release).
- **Repo and CI:** GitHub `Proplity/proplity`. CI runs typecheck, lint, format check, build, the API integration suite and Playwright. Vercel's GitHub integration posts preview deployments (the custom preview workflow was removed).

## What is left

### Needs a person (production checks, before releasing `dev` to `prod`)

1. Run on production, and fix any rows it returns: `SELECT "transactionRef", COUNT(*) FROM "Payment" WHERE "transactionRef" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;` The migration `20261014090000_payment_ref_unique` aborts if duplicates exist.
2. ISS-020: check production for duplicate accounts.
3. Smoke-test uploads on staging.
4. Confirm the production environment variables (see `DEPLOYMENT.md`).
5. Compliance sign-off on the identity-document retention periods before setting `RETENTION_ENABLED=true`.
6. Run the production migrations and confirm before deploying. New since the last release: `20261014090000_payment_ref_unique`, `20261014120000_trust_score_computed` (nulls the old placeholder trust score), `20261014150000_one_active_autopay_per_lease` (soft-cancels duplicate active auto-pay mandates, keeping the newest), `20261014180000_listing_hash_backfill`, `20261014200000_property_photo_urls`.
7. Merge open PRs and delete merged remote branches in GitHub.

### Blocked on something outside the code

- **ISS-010, 011, 012:** live Paystack calls, auto-pay charging (a stored mandate is never charged today) and bank-transfer reconciliation / vendor payouts. Need a Paystack account and product decisions.
- **ISS-035, ISS-038:** storage providers. Need real credentials.
- **ISS-030:** load testing. Needs a proper environment.

### Optional, not started

- A merge action for duplicate listings (`Property.mergedIntoId` is still unused) and photo fingerprinting. Detection by address fingerprint (`listingHash`) is done.
- A screen to add photos to an existing listing (the API accepts `photoUrls` on edit; only the create form sends them).
- The 132 lint warnings.
- A guide screenshot for the subscription downgrade confirmation (it is a native `window.confirm`).

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
