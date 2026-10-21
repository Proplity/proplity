# Proplity: handover

> **Latest detailed handover: [`docs/HANDOVER-2026-10-19.md`](docs/HANDOVER-2026-10-19.md)** (the 2026-10-19 period: journey recorder, flow fixes, viewing date field, notifications, attention list, the agreed next work, and exactly how to run everything). This file is the standing overview. Written 2026-10-15 for anyone (person or AI assistant) picking the project up cold. Read this first, then `CLAUDE.md` (the always-current project reference) and `CURRENT_STATE.md` (what is built, with a changelog). Keep this file current: update it in the same pass as any change that moves the facts below.

## What this is

Proplity is a property-management platform for the Nigerian market: landlords, managers, tenants, vendors and an admin. Next.js 16 App Router, Prisma 7 on PostgreSQL, JWT cookies with rotating refresh tokens, Paystack payments, Cloudinary uploads, Resend email, deployed on Vercel.

## Where things stand (2026-10-21)

- The domain API roadmap, the frontend, the background workers and the test suites are built. 103 route handlers, 43 models, 32 migrations (the newest is `20261020143935_admin_switches_autopay_retention`).
- The issue register (`docs/issues/issues.md`) is worked through: everything that can be done without outside input is built, merged and released to `prod`. What remains is below.
- **Tests:** `pnpm test` runs everything under `tests/`: 615 tests collected in 52 files (509 in the 34 files of `tests/api/`, which make real HTTP calls to a spawned `next dev` on port 3101, plus the 106 below). `pnpm test:unit` runs only the 106 fast unit/fuzz/security/anomaly tests (18 files, mocked Prisma; 106 of 106 pass, run 2026-10-20). Stryker mutation testing achieves 85.71% mutation score (`pnpm test:mutation`). Autocannon load testing (`pnpm test:load`) and 100k units query scaling benchmark (`pnpm benchmark:100k`). Playwright E2E: 56 tests across 15 spec files (`playwright test --list`). `pnpm lint`: 0 errors, 25 warnings (run 2026-10-19: 17 unused imports or variables, 7 `any` in tests, 1 effect set-state hint; CI fails only on errors).
- **Contact form (2026-10-20, ISS-133):** the contact page now emails the team through `POST /api/v1/contact` (public, 5 per hour per IP, honeypot) and says "Message sent!" only when the email went out. It needs `CONTACT_EMAIL` and `RESEND_API_KEY` set in production (see "Needs a person" below). `sendEmail` returns `{ delivered }`.
- **Code scan (2026-10-19):** a security and bug scan of `dev` found and fixed ISS-059 to ISS-082 (see `CURRENT_STATE.md` and the register). Two were serious: a manager could re-approve and publish a rejected listing, and could edit another property's units via staged `metadata`; both only existed in the ADR-0013 property-edit code (on `dev` and `main`, not `prod`). Not changed, by decision: vendor payouts are still allowed before the invoice is paid; passwords still need only 6 characters at sign-up, password reset and password change (the first-run setup wizard needs 8, with a letter and a number); a full script-level CSP is not set.
- **2026-10-19 work:** a UI-only 23-act journey recorder (`scripts/record-user-journey.mjs`) and a re-recorded video; flow fixes ISS-084 to ISS-097 (merged to `dev` and `main`); access-code screens; phone layout; Schedule Tour date field and Lagos-time viewing hours; a visitor profile on viewing requests; a View invoice breakdown on repairs; notifications for every action that needs someone; a **Needs your attention** list on every dashboard; a `reminders` cron job (10 jobs now). All of it has since been released to `prod` (see "What is left").
- **Built earlier and recorded in the `CURRENT_STATE.md` changelog (not repeated here):** the session-restore fix (ISS-057), the auto-pay charger (ISS-011), the sliding-window rate limiter (ISS-021), bank-transfer reconciliation and vendor payouts (ISS-012), file-gateway unification (ISS-038), invite-code rate limiting, the app-wide file viewer, PWA support, the testing hardening (mutation, fuzz, security, load and 100k-unit benchmark; ISS-030, ISS-058), photo management on existing listings, duplicate-listing merge and undo, the lint cleanup and the subscription-downgrade modal.
- **Branches:** `dev` is the integration branch, `main` is staging, `prod` is production. Work goes on a short-lived branch, then a PR into `dev`, then `dev` into `main`, then `main` into `prod`. All stale local and remote feature branches merged into `dev` have been pruned.
- **Repo and CI:** GitHub `Proplity/proplity`. CI runs typecheck, lint, format check, build, the API integration suite and Playwright. Vercel's GitHub integration posts preview deployments (the custom preview workflow was removed).

## What is left

### Released: everything below is on `dev`, `main` and `prod` (checked 2026-10-21: the three branches have identical content, CI is green on all three)

`prod` got the work in three promotions: PR #131 (2026-10-20, everything since 16 Oct including the security fixes), PR #134 (2026-10-20) and PR #137 (2026-10-21). Details are in `docs/development-history/phases/` and the `CURRENT_STATE.md` changelog.

1. **Repair follow-through** (PR #114, migration `20261019171917_repair_follow_through`): vendor before/after photos, tenant Confirm fixed / Still a problem, the property team's Approve work / Send back / Give to another vendor, an admin on/off switch, the broken "Mark as Completed" button removed (ISS-100 to ISS-102, ISS-105 to ISS-110). **Not built, never agreed:** a 7-day "silence is confirmed" rule.
2. **Offline payments and receipts** (PR #115, migration `20261019190000_payment_receipt_number`): a "Paid another way" form, a Bank Transfers list where someone other than the recorder confirms, a receipt for every payment (ISS-103, ISS-111 to ISS-115).
3. **Work orders and recurring-schedule screens** (PR #118, migration `20261019221827_work_orders_and_schedules`; ADR-0014 accepted 2026-10-20; ISS-120 to ISS-124). Not built: approval before work starts or a spending limit, a rating for work-order jobs, a screen for admins.
4. **Second person on payments the team records, with two admin switches** (PR #119, migration `20261020120000_payment_second_person_switches`; ISS-117, ISS-118).
5. **Viewing double-booking** (ISS-104): one live booking per property and start time, booked times marked on the form. A per-property viewing window is not built (decided).
6. **Contact form** (ISS-133), **card payments say "not available yet" until `PAYSTACK_SECRET_KEY` is set** (ISS-010), **admin switches for auto-pay charging and ID-document retention, with the retention periods as settings** (ISS-011, ISS-039; ADR-0015 accepted; migration `20261020143935_admin_switches_autopay_retention`).
7. **Responsive polish** (ISS-125 to ISS-130), a stale sign-in redirect (ISS-132), the session-restore test race (ISS-131) and the **refresh grace window** (ISS-134, ADR-0016, see the decision below).
8. **The walkthrough video** (`public/videos/proplity-complete-userflow.webm`, 23 acts in 28 chapters, 34m27s, 53.5 MB after compression) was re-recorded on 2026-10-20 from a freshly migrated and seeded database. Re-record once after a batch of features rather than once per feature: every recording adds a full copy of the video to the git history. **Not in the video:** the "card payments not available yet" state (the journey runs with the mock gateway); it is covered by tests.
9. Catalogs of every page, component and function: `docs/pages/`, `docs/components/`, `docs/functions/`.

### Decision waiting for the owner

- **ADR-0016 (refresh grace window, ISS-134) is live on `prod` but still marked Proposed.** The owner asked for 5 seconds on 2026-10-21 and the PRs were merged, so accept it in `docs/adr/` (status, date, decided by) or change it.

### Open work in the code (ISS-135, property transfer audit rows, was built 2026-10-21)

1. **ISS-136 (P2): a security audit.** The only audit (2026-09-30) covered auth and sessions. Unchecked: RBAC on the newer routes, upload-signing folders, webhook replay, the timezone of the 02:00 cron, concurrent lease activation (the list is under "Areas still to search" in the register).
2. Smaller: ISS-008 (the registration spec consumes the one-time `DEMO-CODE`), ISS-007 (dev inbox widget).
3. **Deferred for a product decision:** ISS-137 (no appointment model), ISS-022 (MFA, OAuth, instant session kill), ISS-027 (messaging polls every 5 s), the 7-day repair auto-confirm, per-property viewing hours, and the work-order extras listed in item 3 above.

### Needs a person (production)

1. **The repair page leaked password hashes** (ISS-105, P0) to the other people on a repair until PR #131 reached `prod` on 2026-10-20, and payment rows leaked provider payloads and the bank-transfers list leaked to vendors (ISS-111, ISS-112). The code is fixed. Decide whether to ask the people who shared a repair with others to change their password, because the hashes were readable.
2. Run `prisma migrate status` against the production database and confirm it has applied every migration on the `prod` branch. The newest seven are `20261018200000_property_metadata`, `20261019100000_autopay_attempt_tracking`, `20261019171917_repair_follow_through`, `20261019190000_payment_receipt_number` (adds `Payment.receiptNumber`, touches every `Payment` row, so run off-peak), `20261019221827_work_orders_and_schedules`, `20261020120000_payment_second_person_switches` and `20261020143935_admin_switches_autopay_retention`. None deletes rows. If `20261014090000_payment_ref_unique` has not been applied yet, first run `SELECT "transactionRef", COUNT(*) FROM "Payment" WHERE "transactionRef" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;` and fix any rows it returns (the migration aborts on duplicates).
3. ISS-020: check production for case-only duplicate accounts.
4. Set `CONTACT_EMAIL` and `RESEND_API_KEY` on production, or the contact form tells visitors it could not send (ISS-133). Check SPF/DKIM for the sending domain.
5. Smoke-test uploads on staging (Cloudinary is the supported provider, decided 2026-10-20; ISS-035).
6. **Auto-pay and retention are off by default** (ADR-0015): a deployment that already had `AUTOPAY_WORKER_ENABLED` or `RETENTION_ENABLED` set stops acting until an admin switches it on in Platform Settings. Retention also needs compliance sign-off on the periods first.
7. **Card payments:** insert `PAYSTACK_SECRET_KEY`, then run one test-mode payment and its webhook before taking real money (ISS-010).
8. Delete the merged remote branches (about 25; `git branch -r --no-merged origin/prod` is empty).

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
- **The history was rewritten on 2026-10-20** (old walkthrough videos and the role-guide PDF removed; ISS-119). Every branch has new commit hashes from 2026-10-16 on, `prod` included. A clone made before then must be re-cloned, or `git fetch origin && git reset --hard origin/<branch>` for each branch you use. Do not merge or push an old branch: it would bring the removed blobs back. A branch for a `prod` hotfix must start from the new `prod`.
- **`session-restore.spec.ts` failed in CI (ISS-131), explained and fixed in the test:** it cleared the access token while the dashboard's first requests were in flight, and a refresh aborted by the navigation looked like token reuse. It now waits for the page to go idle. Do not weaken the assertion. The product race behind it is ISS-134 (open, needs the owner's decision).
- **Journey and video work:** UI-only (clicks, typing, file choosing), from a fresh DB; a failing step is a product bug (act 5 once failed because a slow 401 from the page just left redirected the visitor to `/login`: ISS-132, fixed in `lib/apiClient.ts`). See the 2026-10-19 handover §5.3 for env vars, snapshots and the act-ordering caveat.
- **The assistant used so far could not merge PRs or delete remote branches** (blocked by its permission rules), so the owner merges.
- **Commit attribution:** commits end with the co-author line the tooling asks for; PR bodies end with the generated-with line. Follow whatever your own tooling requires.

## Design rules worth knowing before editing

- **Money:** payments are recorded from the Paystack webhook, with `Payment.transactionRef` unique and a row lock on the invoice, so a duplicate or replayed webhook cannot double-count. A paid amount that differs from the invoice, or a payment on a cancelled invoice, is audit-flagged (`PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_ON_CANCELLED_INVOICE`, `PAYMENT_EXCEEDS_INVOICE`). Manual cash or transfer payments are recorded by the property side and audited.
- **Auth:** `withAuth` reads the user row on every request, so a suspended account or a changed role takes effect immediately. Admin actions on users need a reason and are audit-logged.
- **URLs:** any URL a client stores and the app later renders goes through `safeUrl` (`lib/api/urlField.ts`).
- **Properties:** a new listing starts `PENDING_REVIEW`; only an admin-approved listing can be published. `trustScore` is computed daily by the `property-trust-scorer` worker (null until scored). Neighbourhood report saves are versioned.
- **Workers:** `GET /api/v1/cron/all` (daily 02:00 via `vercel.json`) runs the jobs in `ALL_JOBS_IN_ORDER`; each can also run alone at `POST /api/v1/cron/[job]` or from `scripts/workers/`.

## Where to read more

`docs/HANDOVER-2026-10-19.md` (the detailed, current handover) · `CLAUDE.md` (architecture, conventions) · `CURRENT_STATE.md` (state and changelog) · `docs/issues/issues.md` (every known issue, status and where it lives) · `docs/pages/`, `docs/components/` and `docs/functions/` (a catalog of every page, component, hook, `lib/` file and worker, with who it is for; start at each `index.md`) · `docs/PRD-as-built.md` (what the product does versus the original PRD) · `docs/adr/` (decisions) · `DEPLOYMENT.md` (deploy, CI, env vars, cron) · `docs/testing-guide.md` (QA checklist) · `docs/proplity-step-by-step-role-guide.md` (click-by-click per role).
