# Unit.status lifecycle + AccessCode single-use/USED transitions

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

Two of CLAUDE.md's own documented "Known gaps — deliberate, not bugs": `Unit.status` never updated when a lease was created/activated/terminated (a unit stayed `VACANT` forever, and `AddTenantForm`'s "vacant units" dropdown — filtered on `status: 'VACANT'` — would happily let a manager double-book an already-tenanted unit), and `AccessCode` never auto-transitioned to `USED` (the enum value and the `verify` route's `DENIED`-branch comment anticipating it both existed; nothing ever wrote it, because nothing distinguished a one-time guest code from a deliberately reusable one).

Investigating Part A surfaced a related, previously-undocumented fact: `POST /leases` always creates a lease with the Prisma-level default `status: PENDING`, and no code path anywhere moved a lease from `PENDING` to `ACTIVE` — only the renewal flow ever explicitly set `ACTIVE`. Asked the user directly: keep `PENDING` as a real, meaningful state (not auto-activate at creation) and add an explicit "Activate Lease" action instead.

## What changed

### Unit.status
- `app/api/v1/leases/[id]/route.ts` PATCH: wrapped the existing lease-update logic in `prisma.$transaction` and added `Unit` writes alongside it — `status → ACTIVE` sets the unit `OCCUPIED`; `status → TERMINATED`/`EXPIRED` sets it back to `VACANT`, but only after re-querying for any other `ACTIVE` lease still on that unit (`id: { not: lease.id }`) — schema doesn't prevent two leases on one unit, so this guards against wrongly vacating an occupied unit. The renewal branch now also explicitly sets the unit `OCCUPIED` (same unit throughout a renewal, but set explicitly rather than assumed).
- `TenantDetail.tsx`: new status badge (PENDING/ACTIVE/other) on the Lease Information card, plus an **Activate Lease** button (shown when `PENDING`) and a **Terminate Lease** button (shown when `ACTIVE`, with a confirm dialog) — both call the existing generic `PATCH /leases/[id]` `{ status }` path via a new `useUpdateLeaseStatus` hook / `api.leases.updateStatus`.
- Lease creation itself (`POST /leases`) is unchanged — still defaults to `PENDING`, per the user's explicit choice.

### AccessCode.USED
- Schema: new `AccessCode.singleUse Boolean @default(true)` (migration `20260826161822_access_code_single_use`). Default `true` matches the fact that every code created today is a one-off guest code (`POST /access-codes` is TENANT-only, invite-a-visitor use case).
- `app/api/v1/access-codes/verify/route.ts`: on a `GRANTED` result, if `accessCode.singleUse` is true, the code's `status` is set to `USED` in the same `$transaction` as the `AccessLog` write. A reusable code (`singleUse: false`) stays `ACTIVE` across repeated verifications. A `USED` code presented again correctly falls into the pre-existing `DENIED` branch (the comment anticipating this was already there — only the write producing that state was missing).
- `POST /access-codes` accepts an optional `singleUse` field (passthrough to Prisma's default when omitted).
- `lib/api/types.ts`: `AccessCode`/`CreateAccessCodeInput` gained `singleUse`.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors (after two `prisma generate` re-runs, once per schema migration).
- `pnpm test` — full suite, 168/168 passing (162 → 168: 4 new `Unit.status` lifecycle tests in `leases.test.ts` — activate-occupies, terminate-vacates, guard-preserves-occupied-when-another-lease-still-active, renewal-keeps-occupied — and 2 new `AccessCode.singleUse` tests in `access-control.test.ts` — single-use consumes on first grant then denies reuse, reusable code grants repeatedly and stays ACTIVE).
- `pnpm build` — production build succeeds.

## What's next

Remaining from `docs/development-history/project-audit.md`: repo-wide CSRF coverage, the orphaned `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` models, real AI/LLM integration, CSV/Excel import-export, e-signature support.
