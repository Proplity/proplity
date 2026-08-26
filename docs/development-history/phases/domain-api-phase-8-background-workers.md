# Phase: Domain API Phase 8 — Background Workers & Cron Jobs

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Final phase of the roadmap: five recurring maintenance jobs (rent generation, overdue detection, scheduled maintenance dispatch, access-code expiry, payment-reliability scoring) that keep the data model current without a human triggering every state transition by hand. The original plan left this high-level; a full plan was written to `out/phase-8-background-workers-plan.md` before implementation, per this project's convention for non-trivial phases.

## Trigger mechanism

No deployment target is specified anywhere in the repo (no `vercel.json`, no job-queue library), so each worker's logic lives in `lib/workers/*.ts` and is invoked from two thin surfaces sharing that same code:

- **`app/api/v1/cron/[job]/route.ts`** — `POST`, dispatched by the `:job` segment, guarded by an `x-cron-secret` header checked against `CRON_SECRET` (`lib/workers/auth.ts`, mirroring `lib/auth/jwt.ts`'s "throw if unset in production, dev fallback otherwise" pattern). Works with Vercel Cron, a system crontab calling `curl`, or any external scheduler.
- **`scripts/workers/*.ts`** — 5 thin CLI wrappers (`pnpm exec tsx scripts/workers/rentInvoicer.ts`) for a traditional cron/systemd-timer deployment or manual runs.

`CRON_SECRET` needed adding to `.env` (`"dev-cron-secret"`) — its absence broke `pnpm build`, since `next build` always evaluates modules with `NODE_ENV=production` regardless of `.env`'s own `NODE_ENV` value, and the throw-guard fires on that combination exactly as designed (the same way `JWT_SECRET`'s absence would).

## The five workers (`lib/workers/`)

Each entry below covers what the worker does, the real test condition manufactured for it, and the exact result observed against the live dev server and seeded database.

### 1. Rent Invoicer (`rentInvoicer.ts`)

For each `ACTIVE` lease, finds its latest `RENT` invoice, computes the next cycle's due date (`+12/+6/+3/+1` months by `paymentFrequency`), and creates a new invoice if that date has arrived and no invoice already exists at it.

**Test setup:** a lease started `2026-06-01`, `MONTHLY`, with only its initial June invoice (paid). Today in the seeded environment is `2026-08-22` — two cycles behind.

**Result, run 1:** `{"created":1,"leasesChecked":5}` — created the `2026-07-01` invoice. Confirmed via direct query: invoices now `2026-06-01 PAID`, `2026-07-01` (new).

**Result, run 2 (immediately after):** `{"created":1,"leasesChecked":5}` — created `2026-08-01` too. This is **advance-one-cycle-per-run by design**, not a duplicate or a bug: the worker only ever looks at the *latest* invoice and computes the *next* one, so a lease several cycles behind catches up one cycle per invocation rather than all at once.

**Result, run 3:** `{"created":0,"leasesChecked":5}` — fully caught up, true no-op. Also confirmed `POST` without `x-cron-secret` → `401`, and an unknown job name → `404` with the list of known jobs.

### 2. Overdue Flagger (`overdueFlagger.ts`)

`Invoice` where `status: UNPAID` and `dueDate` in the past → `status: OVERDUE`, plus exactly one `PAYMENT_REMINDER` `Notice` per invoice, ever — not the full "reminder → call → notice" escalation ladder PRD §6.1 describes, which is explicitly scoped to "Phase 2: Advanced AI rent intelligence" (PRD line 353) and out of scope here.

**Test setup:** a manufactured `UNPAID` invoice with `dueDate: 2026-08-01`.

**Result, run 1:** `{"flagged":2,"remindersSent":2}` (the manufactured invoice plus one pre-existing overdue invoice already in the seeded data). Confirmed the manufactured invoice flipped to `OVERDUE` and gained exactly one `PAYMENT_REMINDER` notice (`status: SENT`).

**Result, run 2 (after the Rent Invoicer's catch-up run above created a newly-overdue `2026-08-01` invoice on the other lease):** `{"flagged":1,"remindersSent":1}` — correctly picked up that new invoice, not a re-flag of the same one.

**Result, run 3:** `{"flagged":0,"remindersSent":0}` — true no-op once nothing new was overdue.

### 3. Maintenance Schedule Dispatcher (`maintenanceScheduleDispatcher.ts`)

Due `MaintenanceSchedule` rows (`isActive: true`, `nextDueDate` in the past) generate a `MaintenanceRequest`, attributed to the unit's current `ACTIVE` lease's tenant — a schedule-generated request has no natural reporter, and the schema has no "staff-initiated, no tenant" shape for `MaintenanceRequest.tenantId` (a required field). No active tenant on the unit → skip creating the request, but still advance `nextDueDate`/`lastGeneratedAt` so an unoccupied unit's schedule doesn't refire every single run.

**Test setup 1 — occupied unit:** a schedule on a unit with a real active tenant, `nextDueDate: 2026-08-01`.
**Result:** `{"dispatched":2,"skippedNoTenant":0}` (a second schedule, meant to test the skip path, accidentally also ended up with a tenant via test-data overlap — both dispatched successfully instead) — created a `MaintenanceRequest` titled `"Scheduled maintenance: Plumbing"`, `tenantId` set to the active lease's tenant; schedule's `nextDueDate` advanced `2026-08-01 → 2026-09-01`, `lastGeneratedAt` set.

**Test setup 2 — genuinely tenant-less unit** (re-run in isolation after correcting the first test's accidental overlap): a fresh schedule on a unit confirmed to have zero active leases.
**Result:** `{"dispatched":0,"skippedNoTenant":1}` — zero `MaintenanceRequest` rows created for that unit, confirmed directly by count; `nextDueDate` still advanced `2026-08-01 → 2026-09-01` despite the skip, confirming the "don't refire every run" behavior.

### 4. Access Code Expiry Janitor (`accessCodeExpiryJanitor.ts`)

`AccessCode` where `status: ACTIVE` and `validUntil` is in the past → `status: EXPIRED`. A plain status update, not a delete — consistent with rule 1's spirit even though `EXPIRED` isn't the same audit-trail concern as `REVOKED`/hard-delete.

**Test setup:** an `ACTIVE` code with `validUntil: 2026-08-01`.

**Result, run 1:** `{"expired":1}` — confirmed the code's `status` flipped to `EXPIRED` via direct query.
**Result, run 2:** `{"expired":0}` — true no-op.

### 5. Payment Reliability Scorer (`paymentReliabilityScorer.ts`)

**The one genuine judgment call in this phase.** The PRD describes "late payment prediction" as an AI capability with no formula specified anywhere in the repo. Shipping a documented, inspectable heuristic beats leaving `Lease.paymentReliability`/`riskScore` permanently `null` — but it's explicitly commented in the code as an approximation standing in for a future real model, not mistaken for one now.

Heuristic: across every `RENT` invoice whose `dueDate` has passed, count `onTime` (paid on/before due), `late` (paid after due), `missed` (still unpaid/overdue). `ratio = onTime / (onTime + late + missed)`. `paymentReliability`: `≥0.9 EXCELLENT`, `≥0.7 GOOD`, `≥0.5 FAIR`, else `POOR`. `riskScore`: `missed ≥ 2` or `ratio < 0.5` → `HIGH`; `missed = 1` or `ratio < 0.8` → `MEDIUM`; else `LOW`. A lease with no past-due invoices yet is left `null` for both fields (matches the schema comment exactly: "a brand-new lease has no payment history yet to score").

**Test setup:** two constructed leases — one with a single on-time payment, one with a single fully-missed invoice.

**Result:** `{"scored":3,"skippedNoHistory":2}` (3 total leases had past-due history: the 2 constructed plus 1 pre-existing seeded lease; 2 brand-new leases correctly skipped/left `null`). The on-time lease initially had `ratio 1.0`, but after the Rent Invoicer's catch-up run (above) added a second, newly-overdue invoice to it, re-scoring correctly recalculated it to `FAIR`/`MEDIUM` (`ratio 0.5`, `missed: 1`) — confirming the scorer reacts to real state changes from the *other* workers rather than caching stale numbers. The fully-missed lease scored `POOR`/`HIGH` (`ratio 0`) as expected. Re-running produced identical, stable output both times (`{"scored":3,"skippedNoHistory":2}`).

## Cleanup and general checks

All test rows (2 constructed leases and their invoices/payments/notices, 3 maintenance schedules, 1 access code) were deleted afterward via one-off scripts. The 1 real, pre-existing seeded lease that the scorer touched during testing legitimately keeps its computed `paymentReliability`/`riskScore` — that's the worker's actual intended effect, not test pollution, so it was left in place rather than reverted.

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, `/api/v1/cron/[job]` listed alongside the existing 61 routes.

## Not in scope

Actually scheduling these to run automatically (a real Vercel Cron config, crontab entry, or CI scheduled workflow) — depends on a deployment target not yet decided. This phase builds the workers and their trigger surface only.

## Roadmap status

This completes the full `out/domain-api-implementation-plan.md` roadmap: Phase 0-pre through Phase 8, all built, type-checked, built, and live-tested against the real dev server and seeded database.
