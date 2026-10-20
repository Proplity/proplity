# Rent entry needs a second person, and the receipt hides the automatic note

**Status:** Built on `fix/rent-entry-two-person-and-receipt-note` (stacked on `feat/work-orders-and-schedules`). **Date:** 2026-10-20. **Issues:** ISS-117, ISS-118; ISS-110 decided. **Migration:** none.

## Why

The two-person rule added with offline payments covered transfers only. **Record payment** on a tenant's record still marked an invoice paid in one step, so one manager could enter a payment and effectively approve it. The receipt for a confirmed transfer also showed an automatic note ("Reconciled by MANAGER from bank transfer ref …") that repeats what the receipt already says. The owner reviewed the three open questions on 2026-10-20 and took the recommended answer to each.

## What was built

- **Tenant rent goes through the transfers list.** On a tenant's record, **Record cash or transfer payment** opens `PaidAnotherWayForm` (new `payerName` prop, so the tenant's name is filled in rather than the manager's). It creates a pending `BankTransferSubmission`; someone other than the recorder confirms it, and only then is the invoice paid, the receipt created and the tenant told. The old inline form, `useRecordPayment` and `api.invoices.recordPayment` are removed.
- **The API cannot be used to skip it.** `POST /invoices/[id]/payments` answers 409 for any invoice with a lease (tenant rent, service charge, deposit, late fee) or a repair (a vendor's bill). It stays only for an account holder's own invoice, which only an admin can reach. A vendor's invoice already went through the form in the UI; now the server enforces it too.
- **A one-person property.** The existing rule applies: the recorder cannot confirm, and the admins are told when nobody else on the property team can.
- **Receipt note.** `lib/payments/transferNote.ts`: the stored automatic note now reads "Confirmed from bank transfer reference …" (no role), and `buildReceipt` shows a payment's note only when a person typed one. Payments already confirmed with the old wording are recognised too, so no data change was needed.
- **ISS-110 decided: no change.** The assigned vendor does not see the tenant's gate code (it is the tenant's own credential and the access log could not tell who used it). If vendors need entry, the way to build it is a separate time-limited code issued per job with each use audit-logged; not built.

## Admin switches (added the same day, at the owner's request)

Two columns on `SystemSettings` (migration `20261020120000_payment_second_person_switches`, default on): `requireSecondPersonForTenantPayments` and `requireSecondPersonForVendorPayments`, shown as two tiles on `/admin/settings`. They cover only payments the **property team** records: with a switch off, `submitBankTransferProof` confirms the team member's own entry at once (`teamEntryNeedsSecondPerson`), which still creates the receipt and an audit row marked `confirmedByRecorder`, and notifies the tenant or vendor but nobody else; an entry already waiting can then be confirmed by its recorder (`reconcileBankTransfer` follows the setting). A tenant recording their own transfer always waits for the team. `POST /invoices/[id]/payments` stays closed to tenant and vendor invoices either way: the transfer flow is the one way in, because it keeps the proof and the receipt. `GET /settings/payment-rules` (admin, manager, landlord, just the two flags) lets `PaidAnotherWayForm` say whether an entry waits (`needsSecondPerson`), and its toast follows what the server did (`APPROVED` or `PENDING`). Tests: the rules endpoint and who may change them, tenant off, vendor off, independence, a tenant's own transfer, and confirming an already-waiting entry after switching off.

## Walkthrough

Act 18 of `scripts/record-user-journey.mjs` now ends with the property team's side: the manager sends the tenant a utility bill from the tenancy record, records the cash with **Record cash or transfer payment** (the tenant's name is filled in), sees the bill stay unpaid and the note that someone else has to confirm it on Bank Transfers, and the admin confirms it. It continues on the switch: the admin turns the tenant-payments rule off in Platform Settings, the manager bills a second small invoice, the form now says the entry counts straight away, it does, and the admin switches the rule back on. The video itself is not re-recorded yet (one re-record after the stacked PRs merge).

## Tests

`tests/api/offline-payments.test.ts`: the by-hand test became a refusal test (409 on a vendor bill and on rent, for the manager and the landlord, nothing paid); a new test records rent as the manager, shows it stays unpaid and cannot be confirmed by the recorder, then is paid when the landlord confirms and the tenant is told; a new receipt test covers the automatic note (new and old wording hidden, a typed note shown). `tests/unit/transferNote.test.ts` covers the matcher.

## Verification

`pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm format:check` clean; `pnpm test` 566 passed in 48 files (10 new tests since the work-orders branch: 4 for the two-person rule and the receipt note, 6 for the switches); the full journey passed all 23 acts in fast mode with the new act 18 tail. Playwright was not rerun for this branch: it changed no navigation or labels that the 56 specs select on, but it adds no spec for the new settings tiles (a known gap).

## Not built

A tenant's rent entered by an admin needs someone else (the property team or another admin) to confirm it. Cash that is never recorded still has no receipt.
