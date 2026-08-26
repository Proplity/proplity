# Configurable late fees + grace period, unbounded, landlord/manager autonomy

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

Follow-up to `out/phases/late-fees-and-grace-period.md`. That phase made `overdueFlagger.ts` actually *read* `Lease.gracePeriodDays`/`lateFeePercentage`, but neither field was ever configurable anywhere in the real app — `AddTenantForm.tsx` didn't expose them at creation and `PATCH /leases/[id]` had no path to edit them after. User confirmed via direct Q&A: give the autonomy to landlord/manager (not admin — matches who already creates/owns leases), default `lateFeePercentage` to `0` (no fee until deliberately set, was `5.0`), keep `gracePeriodDays` default at `7`, support both a percentage-of-rent mode and a flat-currency-amount mode (mutually exclusive per lease, never stacked), and — after review — no platform-imposed min/max on either field at all.

## What changed

**Schema** (migration `20260826114029_lease_late_fee_type_and_flat_amount`): new `LateFeeType` enum (`PERCENTAGE | FIXED`) and `Lease.lateFeeType` (default `PERCENTAGE`), new `Lease.lateFeeFlatAmount` (default `0`), `Lease.lateFeePercentage` default changed `5.0` → `0`. `gracePeriodDays` unchanged (`Int @default(7)`).

**`lib/workers/overdueFlagger.ts`**: late-fee amount now branches on `lease.lateFeeType` — `FIXED` uses `lateFeeFlatAmount` directly, `PERCENTAGE` computes `invoice.amount * lateFeePercentage / 100` as before. Same idempotency marker, same RENT-only/no-compounding-on-LATE_FEE guards as the prior phase, unchanged.

**API**: `POST /leases` and `PATCH /leases/[id]` both accept `gracePeriodDays`/`lateFeeType`/`lateFeePercentage`/`lateFeeFlatAmount` — all `nonnegative()`, deliberately no `.max()`. `PATCH` previously only supported `status` or a full `renew`; extended to apply these four fields directly to the existing lease in the same call (or combined with `status`), still gated by the existing `canManageProperty()` check (ADMIN/MANAGER/LANDLORD role list unchanged — ADMIN keeps support/override access consistent with every other lease route, but the *UI* surfaces this only where a manager/landlord would naturally be, matching the "autonomy to landlord/manager" intent without carving a new auth exception).

**Frontend**:
- `AddTenantForm.tsx` (lease-creation step): grace-period-days input and a late-fee-type selector (percentage/flat) with the matching amount input; when percentage mode has a value, a live `≈ ₦X per overdue invoice` preview computes against the entered rent amount as the user types.
- `TenantDetail.tsx` (existing-lease view): new "Late Fee & Grace Period" card with an inline Edit mode wired to the new `PATCH` path (`useUpdateLeaseTerms` → `api.leases.updateTerms`), same live percentage preview, Save/Cancel.
- `lib/api/types.ts`: `Lease` gained `gracePeriodDays`/`lateFeeType`/`lateFeePercentage`/`lateFeeFlatAmount`; `CreateLeaseInput` and new `UpdateLeaseTermsInput` types added.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 162/162 passing (160 → 162: PATCH terms-edit test in `leases.test.ts`, FIXED-mode late-fee test in `vendors-and-admin.test.ts` proving `lateFeePercentage` is ignored when `lateFeeType === 'FIXED'`, not stacked).
- `pnpm build` — production build succeeds.

## What's next

Remaining from `out/project-audit.md`: repo-wide CSRF coverage, the orphaned `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` models, and real AI/LLM integration.
