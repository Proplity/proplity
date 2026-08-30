# Phase 8 — Background Workers & Cron Jobs: step-by-step plan

**Status:** Draft, proceeding to implementation (judgment calls documented below, not blocking questions — same category as prior phases' resolved ambiguities).

## Why this needed its own plan

Like Phase 7, the original plan left this high-level: "Rent Invoicer, Overdue Flagger, Maintenance Schedule Dispatcher, Access Code Expiry Janitor, Payment Reliability Scorer." None of that specifies *how* these run (this is a Next.js app with no existing cron/worker infrastructure — no `vercel.json`, no job queue library), or the actual business logic for two of the five (invoice-cycle cursor math, and a payment-reliability scoring heuristic the PRD describes only as an aspirational AI feature, not a formula).

## Trigger mechanism

No deployment target is specified anywhere (Vercel vs. self-hosted), so the most portable design: each worker's real logic lives in `lib/workers/*.ts`, invoked from two thin surfaces that both call the same function —

1. **`app/api/v1/cron/[job]/route.ts`** — `POST` only, guarded by comparing an `x-cron-secret` header against `CRON_SECRET` (mirrors the `JWT_SECRET`/`DATABASE_URL` "throw in production if unset" pattern already established — a dev fallback secret, hard failure if unset in production). Works with Vercel Cron, a system crontab calling `curl`, or any external scheduler, without assuming which one is actually in use.
2. **`scripts/workers/*.ts`** — thin CLI wrappers (`pnpm exec tsx scripts/workers/rentInvoicer.ts`) importing the same `lib/workers/*.ts` functions, for a traditional cron/systemd-timer deployment or manual runs without hitting the HTTP layer at all.

Every worker is idempotent — safe to run daily, or twice by accident — by checking for existing rows before creating new ones, not by tracking "have I run today" state.

## The five workers

### 1. Rent Invoicer

For each `ACTIVE` lease: find its latest `RENT` invoice by `dueDate`, compute the next cycle's due date by adding one `paymentFrequency` period (`ANNUAL` +12mo, `BI_ANNUAL` +6mo, `QUARTERLY` +3mo, `MONTHLY` +1mo). If that date is `<=` today, `<=` the lease's `endDate`, and no `RENT` invoice already exists for the lease at exactly that `dueDate` — create one for `lease.rentAmount` (never multiplied, rule 5). The existing-invoice check is what makes re-running safe.

### 2. Overdue Flagger

`Invoice` where `status: UNPAID` and `dueDate < now` → `status: OVERDUE`. For each one newly flagged that has a `leaseId`, create one `Notice(type: PAYMENT_REMINDER, status: SENT, sentAt: now)` — but only if no `PAYMENT_REMINDER` notice already exists for that `invoiceId` at all. **Judgment call**: PRD §6.1 describes a "reminder → call → notice" escalation *ladder*, explicitly called out on PRD line 353 as a "Phase 2: Advanced AI rent intelligence" feature — out of scope here. This worker sends exactly one reminder per invoice, not an escalating sequence; flagged as a known simplification, not the full PRD vision.

### 3. Maintenance Schedule Dispatcher

`MaintenanceSchedule` where `isActive: true` and `nextDueDate <= now` → create a `MaintenanceRequest`. **Real schema tension**: `MaintenanceRequest.tenantId` is required, but a schedule-generated request is staff-initiated preventive maintenance with no natural tenant. Resolution: use the unit's current `ACTIVE` lease's `tenantId` if one exists (the request becomes visible to whoever currently lives there, which is correct behavior even though they didn't report it); if the unit has no active tenant, **skip that schedule this run** rather than inventing a tenant — flagged as a known gap (the schema has no "staff-initiated, no tenant" request shape). `title`/`description` auto-generated from the schedule's category name, `priority: MEDIUM`. Advances `lastGeneratedAt` and `nextDueDate` (by `frequency`) in the same write, which is what keeps this idempotent.

### 4. Access Code Expiry Janitor

`AccessCode` where `status: ACTIVE`, `validUntil` is not null, and `validUntil < now` → `status: EXPIRED`. A plain status update, not a delete — consistent with rule 1 even though `EXPIRED` isn't the same audit concern as `REVOKED`.

### 5. Payment Reliability Scorer

**Judgment call, most subjective of the five**: the PRD describes "late payment prediction" as an AI capability with no specified formula anywhere in the repo. Building real ML is out of scope for a background-worker phase; the alternative to shipping *something* here is leaving every lease's `paymentReliability`/`riskScore` permanently `null`, which defeats the point of the schema fields existing. Documented heuristic, deliberately simple and inspectable (not hidden inside a black box):

For each lease, look at every `RENT` invoice whose `dueDate` has passed:
- `onTime` = paid, with a `Payment.paidAt <= dueDate`
- `late` = paid, with `paidAt > dueDate`
- `missed` = still `UNPAID`/`OVERDUE`

If there's no such invoice yet (brand-new lease), leave both fields `null` — matches the schema comment exactly ("nullable... a brand-new lease has no payment history yet to score"). Otherwise:
- `reliabilityRatio = onTime / (onTime + late + missed)`
- `paymentReliability`: `>=0.9` → `EXCELLENT`, `>=0.7` → `GOOD`, `>=0.5` → `FAIR`, else `POOR`
- `riskScore`: `missed >= 2` or `ratio < 0.5` → `HIGH`; `missed === 1` or `ratio < 0.8` → `MEDIUM`; else `LOW`
- Writes `riskScoreUpdatedAt: now` alongside, so the UI can show how stale the score is (the schema comment's stated reason for the timestamp existing).

This is a heuristic, not a prediction model — flagged clearly in the phase doc and in a code comment, so nobody mistakes it for the real "AI" feature the PRD describes.

## Verification plan

- `pnpm exec tsc --noEmit`, `pnpm build`.
- Live-test each worker against the real seeded database: manufacture the exact condition each one looks for (an overdue invoice, a due maintenance schedule, an expired access code, a lease with a real payment history), run the worker, confirm the correct row-level change, confirm re-running immediately makes no further change (idempotency), clean up test data afterward.
- Confirm the `CRON_SECRET` guard actually rejects an unauthenticated `POST` and accepts a correctly-authenticated one.
- Write `docs/development-history/phases/domain-api-phase-8-background-workers.md` once done, per the standing convention.

## Not in scope

Actually scheduling these to run automatically (a real Vercel Cron config, a crontab entry, a GitHub Actions workflow) — this phase builds the workers and their trigger surface; wiring an actual external scheduler depends on the deployment target, which isn't decided yet.
