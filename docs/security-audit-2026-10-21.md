# Security sweep, 2026-10-21 (ISS-136, first pass)

Scope: the "Areas still to search" list in `docs/issues/issues.md` plus a route-by-route look at authorisation on the code written since the 2026-09-30 auth review. Method: read the code, then reproduce each suspected problem with a test before changing anything. One pass, by one reviewer; it is not a penetration test and it did not cover every route line by line.

## Found and fixed (each reproduced by a test in `tests/api/security-sweep.test.ts`)

| ID      | Pri | What                                                                                                                  |
| ------- | --- | --------------------------------------------------------------------------------------------------------------------- |
| ISS-138 | P1  | A tenant's gate codes kept working after the tenancy ended; a reusable code with no end date never expired            |
| ISS-139 | P2  | Eight activations of leases on one unit at once: four succeeded, leaving four active leases on a unit                 |
| ISS-140 | P2  | Three requests to start a tenancy from one approved application at once made three leases, each with its own invoices |

## Found, not fixed (rows in the register)

| ID      | Pri | What                                                                                                                               | Why not fixed                                         |
| ------- | --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| ISS-141 | P3  | A rent invoice with no grace period is flagged overdue, and a late fee charged, on its due date itself (the job runs at 02:00 UTC) | Needs a decision on what "due" means in Lagos time    |
| ISS-142 | P3  | People stay in message threads after they lose their link (a tenant after the lease ends, a manager after a transfer)              | Needs a decision on whether they keep reading history |
| ISS-143 | P3  | Applications and viewing requests do not check the listing is public (needs a known random id)                                     | Changing it touches many test fixtures; low exposure  |

## Checked and found sound

- **Routes with no `withAuth`:** all 19 were read. Auth routes handle their own session; `contact` is public and rate-limited; `cron` checks the secret; `dev/emails` and `dev/mock-checkout` return 404 unless their flags are on (and the mock never with a real Paystack key); `files/[id]` decides access per file; `manager-codes/check` is rate-limited; `payments/webhook` verifies the HMAC before parsing; `setup` is first-run only.
- **Webhook replay:** `Payment.transactionRef` is unique and the invoice row is locked, so a redelivered `charge.success` cannot credit twice.
- **Raw SQL:** every `$queryRaw` and `$executeRaw` is a tagged template with parameters; no unsafe variants.
- **HTML injection:** `dangerouslySetInnerHTML` is used only for the in-app guide (static) and the chart component's style block.
- **Whole-row leaks (the ISS-105 pattern):** no route includes a whole user row except the token refresh (internal) and the moderation route, which does not return it.
- **Uploads:** each folder has a role list and a read rule (`canReadFile`) that ties a private file to the records that carry it; type and size are checked at sign and at completion; unrelated users get 404.
- **Receipts, bank accounts, access codes, applications, invoices, vendor payouts, repair review:** each checks the caller's relationship to the record (owner, party, or `canManageProperty`); the newer repair and payment routes use conditional updates so a second request cannot repeat a step.
- **Messaging:** starting a thread with strangers is restricted (ISS-074); thread membership for repairs, leases and community boards is derived on the server.
- **Invite codes:** `GET /manager-codes/check` is rate-limited.

## Not covered

- Email deliverability for the production domain (SPF/DKIM): needs access to DNS.
- Accessibility (labels, focus, keyboard) and `public/` asset size: not security.
- A line-by-line read of every route handler, the Paystack live call (never run, ISS-010), and the production environment configuration.
- Dependencies: Dependabot alerts were cleared on 2026-10-20; nothing newer was checked.

## Before relying on the fixes in production

Run these on the production database; each should return no rows. If one does, someone is already affected:

```sql
-- ISS-139: a unit with more than one active lease
SELECT "unitId", COUNT(*) FROM "Lease" WHERE status = 'ACTIVE' GROUP BY 1 HAVING COUNT(*) > 1;
-- ISS-140: the same tenant with several live leases on one unit
SELECT "unitId", "tenantId", COUNT(*) FROM "Lease" WHERE status IN ('PENDING','ACTIVE') GROUP BY 1,2 HAVING COUNT(*) > 1;
-- ISS-138: active gate codes whose owner has no active lease on the unit
SELECT c.id, c."unitId" FROM "AccessCode" c JOIN "User" u ON u.id = c."createdById" AND u.role = 'TENANT'
WHERE c.status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM "Lease" l WHERE l."unitId" = c."unitId" AND l."tenantId" = c."createdById" AND l.status = 'ACTIVE');
```

The third query lists codes the gate now refuses and revokes on first use; it needs no cleanup.
