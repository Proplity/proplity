# Grace periods + real late fees in overdueFlagger

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

Next item down `out/project-audit.md`'s remaining list: `Lease.gracePeriodDays` and `lateFeePercentage` were accepted at lease creation and never read anywhere else. `overdueFlagger.ts` flagged an invoice `OVERDUE` the instant `dueDate` passed regardless of grace period, and `InvoiceType.LATE_FEE` had zero creation sites in the entire codebase despite the PRD requiring "auto late fees & penalties."

## What changed (commit `3b883c5`)

`lib/workers/overdueFlagger.ts` rewritten:
- An invoice only becomes `OVERDUE` (and sends its one `PAYMENT_REMINDER`, unchanged from before) once `dueDate + gracePeriodDays` has actually elapsed, not at `dueDate` itself. Invoices with no lease (no grace concept) behave exactly as before.
- Once overdue, a `RENT` invoice on a lease with `lateFeePercentage > 0` gets a real `LATE_FEE` invoice created for it — one time only, idempotent via a description marker (`[late-fee-for:<id>]`, same "no dedicated column, encode it" convention already used for subscription tier/cycle), since there's no FK from a late fee back to its origin invoice and adding one would need a migration.
- Scoped to `RENT` only (a late fee on a `SECURITY_DEPOSIT` invoice doesn't map to what the field means) and explicitly excludes `LATE_FEE` invoices from ever getting a late fee assessed on themselves — without that guard, a late fee's own `dueDate` (set to "now", so immediately overdue) would make it a candidate on the very next run and compound forever.
- The worker now re-examines already-`OVERDUE` invoices each run, not just `UNPAID` ones, so invoices flagged before this fix still get a fee assessed once it exists.

`createLease` test fixture extended with `gracePeriodDays`/`lateFeePercentage` overrides (previously not exposed).

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 160/160 passing (157 → 160: grace-period-respected, flag+reminder+fee+idempotency, and RENT-only-scoping cases, all against the real `access-code-expiry-janitor`-style cron dispatch, not a direct function call).
- `pnpm build` — production build succeeds.

## What's next

Remaining from `out/project-audit.md`: repo-wide CSRF coverage (larger, not currently exploitable), the orphaned `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` models (each a real PRD-named feature with zero code, needs individual scoping), and real AI/LLM integration (needs a provider/scope decision first).
