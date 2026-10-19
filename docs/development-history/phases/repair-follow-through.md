# Repair follow-through — vendor evidence, tenant confirmation, property-team sign-off

**Status:** Built on `feat/repair-follow-through` (stacked on the docs-correction commit). **Date:** 2026-10-19. **Issues:** ISS-100, ISS-101, ISS-102, plus ISS-105 to ISS-109 found on the way. **Migration:** `20261019171917_repair_follow_through`.

## Why

Finishing a repair stopped at the vendor. Nothing showed the work was done (the single `completionProofUrl` was never set by a screen, and sending the invoice closed the job without any proof), the tenant could only rate the vendor, and the manager's "Mark as Completed" button was refused by the API because only the assigned vendor may complete. The owner agreed a design in the 2026-10-19 handover; this builds it.

## What was built

- **Vendor evidence.** The job page has **Work Photos**: before photos (optional) and after photos, uploaded to the `maintenance-requests` folder and attached with `PATCH /maintenance/requests/[id]` (`beforePhotoUrls`, `afterPhotoUrls`; each list replaces the stored one, max 12, only files the vendor uploaded). At least one after photo (or the older single `completionProofUrl`) is needed to close a job, whether the vendor's PATCH or the vendor's invoice closes it (`EVIDENCE_REQUIRED`). Photos lock once the repair is approved or the tenant has confirmed it. The tenant's own photos and the vendor's now render as images (`RepairPhotos.tsx`, which opens the file viewer) instead of raw URL text.
- **Tenant confirmation.** A finished job sets `MaintenanceRequest.confirmationStatus = AWAITING_TENANT` (unless the admin switch is off). `POST /maintenance/requests/[id]/confirmation` takes `CONFIRMED`, or `DISPUTED` with a reason (required, 5 to 2000 characters) and up to 6 photos. One answer lands (the claim is an `updateMany` on the waiting state). It never touches the invoice. Notifications: the tenant gets "Is your repair fixed?" by email and in the app; a dispute emails the property team; a confirmation tells the team and the vendor in the app only.
- **Property-team decision.** `POST /maintenance/requests/[id]/review` (manager, landlord or admin of the property):
  - `APPROVE` records `approvedAt` and `approvedById`, separate from the vendor finishing. It does not change the tenant's answer or the invoice.
  - For a disputed, not-yet-approved repair: `REOPEN` puts the job back to in progress and tells the vendor (with the tenant's reason); `REASSIGN` gives it to a different verified vendor.
  - The manager's old "Mark as Completed" button and its "completion proof URL" modal are removed. Only the vendor finishes a job.
- **Admin switch.** `SystemSettings.requireTenantRepairConfirmation` (default on), a second toggle on `/admin/settings`. Off stops new questions; repairs already waiting stay answerable. The settings PATCH now takes either toggle on its own and rejects an empty body.
- **Attention rows.** Tenant: Repairs to confirm. Manager, landlord: Repairs the tenant says are not fixed. Vendor: Repairs sent back to you.
- **Files.** The gateway's read rule for `maintenance-requests` now also covers the before, after and dispute photos, for the tenant, the assigned vendor and the property team.

## Decisions worth remembering

- **Reason required, photos optional.** CLAUDE.md said "reason and photos required"; the later handover said "reason required, photos optional". Built the latter.
- **After photo required, before photo optional.** A before photo is often impossible once work has started. The requirement applies only where an upload provider is configured (`evidenceRequired()` in `lib/maintenanceFlow.ts`); with none, a vendor could never close a job (ISS-116).
- **Reassign is refused once the first vendor has been paid (even in part)** (`INVOICE_HAS_PAYMENTS`): cancelling a paid invoice would leave money recorded against nothing. An unpaid invoice is cancelled and audited (`INVOICE_CANCELLED_ON_REASSIGN`) so the new vendor can bill the job (one live invoice per job). The first vendor's photos, cost and notes are cleared; the tenant's reason and photos stay for the new vendor.
- **A reopened job keeps the tenant's reason and photos until the vendor finishes it again**, so the vendor can read them. Finishing again uses the cost already billed and creates no second invoice (**Mark work done**).
- **Approving does not answer for the tenant.** The manager may approve straight away while the tenant is still being asked; a later dispute clears the approval.
- **No history of earlier dispute rounds.** Only the latest reason and photos are kept on the job; the message thread holds the conversation.
- **Not built:** the 7-day "silence is confirmed" idea. It was only ever a suggestion.

## Bugs found and fixed on the way

See ISS-105 to ISS-110: whole user rows (password hash included) returned by the repair page (**also on `prod`**); unguarded status transitions and a negative `finalCost`; a vendor missing from a message thread opened before assignment and a removed vendor still in it; repair notification links that opened the manager page for tenants and vendors; no way to finish a job with auto-complete switched off; and the vendor's job page asking for an access code the API never gives vendors (ISS-110, with an open question for the owner).

## Verification

- `pnpm exec tsc --noEmit` clean; the touched files pass ESLint and Prettier.
- 21 new API tests in `tests/api/repair-follow-through.test.ts` (photos and who may read them, the evidence rule by PATCH and by invoice, the admin switch, the tenant's answer, approve, send back, reassign with the paid-invoice refusal and the thread sync, no password hash or private field in the repair page, attention rows). The suites that touch repairs, invoices, notifications, messaging, files and attention (122 tests) passed after the fixes (one pass over all seven files, then a re-run of the two files that needed a fix); three existing tests were updated on purpose (a vendor invoice now needs a photo; the "completed" notification is now "Is your repair fixed?" with the tenant's own link).
- The screens were driven in a real browser by the journey recorder (`scripts/record-user-journey.mjs`, now 21 acts: act 13 has the vendor's photos and the invoice that waits for one; act 15 the tenant's "Still a problem"; new act 16 the manager sending it back and the vendor marking the work done again; new act 17 the tenant confirming and rating and the manager approving). Acts 12 to 17 passed from a database restored from the snapshot taken after act 11; the repair ended `COMPLETED`, `CONFIRMED` and approved, with one invoice (paid), the final cost carried over and the dispute cleared. The server log for those runs showed no 5xx and no runtime errors; its only failing API call was the vendor page's access-code request (ISS-110, fixed).
- `pnpm lint` 0 errors (the same 25 warnings as before); `tsc` clean.

## Known limits

- A tenant who disputes, a manager who sends it back and a vendor who finishes again repeat the cycle with no cap and no count.
- Reassigning clears the first vendor's photos from the job (the files stay in storage, readable only by their owner).
- A paid first invoice means the job can only go back to the same vendor or be approved.
