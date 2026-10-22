# Security sweep, 2026-10-21 (ISS-136, first and second pass)

Scope: the "Areas still to search" list in `docs/issues/issues.md` plus a route-by-route look at authorisation on the code written since the 2026-09-30 auth review. Method: read the code, then reproduce each suspected problem with a test before changing anything. One pass, by one reviewer; it is not a penetration test and it did not cover every route line by line.

## Found and fixed (each reproduced by a test in `tests/api/security-sweep.test.ts`)

| ID      | Pri | What                                                                                                                  |
| ------- | --- | --------------------------------------------------------------------------------------------------------------------- |
| ISS-138 | P1  | A tenant's gate codes kept working after the tenancy ended; a reusable code with no end date never expired            |
| ISS-139 | P2  | Eight activations of leases on one unit at once: four succeeded, leaving four active leases on a unit                 |
| ISS-140 | P2  | Three requests to start a tenancy from one approved application at once made three leases, each with its own invoices |

## Found, then decided and fixed the same day (rows in the register)

| ID      | Pri | What                                                                                                                               | Decision (owner, 2026-10-21)                                                                                                 |
| ------- | --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ISS-141 | P3  | A rent invoice with no grace period is flagged overdue, and a late fee charged, on its due date itself (the job runs at 02:00 UTC) | Overdue only once the Lagos day it falls due on (plus grace) has ended                                                       |
| ISS-142 | P3  | People stay in message threads after they lose their link (a tenant after the lease ends, a manager after a transfer)              | A tenant keeps read-only history; a manager or landlord who loses the property leaves its threads                            |
| ISS-143 | P3  | Applications and viewing requests do not check the listing is public (needs a known random id)                                     | Require a published, approved, non-private listing, unless the caller runs the property or lives in it; answer 404 otherwise |

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

## Second pass: every route handler, read once (2026-10-21)

The route handlers under `app/api/v1/` were read after the first pass: the 19 without `withAuth` and the webhook had been read in the first pass and the auth routes in the 2026-09-30 review, and every other handler was read here, with the question "does this route check that the caller is connected to this record, and does it leak more than the screen needs?". `lib/api/withAuth.ts` was also checked: it applies the cross-origin check to every write, re-reads the account on each call (so a suspension or role change applies at once) and enforces the role list. Twelve findings, all fixed with tests: eight reproduced by a failing test first, ISS-152 is hardening that could not be reproduced, and the three the owner decided on 2026-10-21 (ISS-153 to ISS-155) have tests in `tests/api/security-sweep-2.test.ts` and `tests/api/invites-and-passwords.test.ts`.

| ID      | Pri | What                                                                                                              | State          |
| ------- | --- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| ISS-144 | P2  | Any manager could read and write the private notes on any lease                                                   | Fixed          |
| ISS-145 | P2  | A tenant could read and answer the property team's draft notices; a notice could point at another lease's invoice | Fixed          |
| ISS-146 | P3  | Unit lists, unit pages and the neighbourhood report ignored the listing rule (private units, unlisted properties) | Fixed          |
| ISS-147 | P3  | `POST /properties` accepted any manager and landlord id                                                           | Fixed          |
| ISS-148 | P3  | Moderator notes and staged edits were sent to tenants, vendors and applicants                                     | Fixed          |
| ISS-149 | P3  | Unlimited reviews per person, including by the property's own team                                                | Fixed          |
| ISS-150 | P3  | Two reviewers could both decide one application                                                                   | Fixed          |
| ISS-151 | P4  | The audit log's search word replaced the action filter                                                            | Fixed          |
| ISS-152 | P3  | An invoice edit did not take the row lock that payments take (not reproduced; hardening)                          | Fixed          |
| ISS-153 | P3  | Units "awaiting approval" are public at once and the manager can clear the marker                                 | Decided, fixed |
| ISS-154 | P3  | Any manager or landlord can have Proplity email any address through a lease invitation, without limit             | Decided, fixed |
| ISS-155 | P4  | Passwords need only 6 characters                                                                                  | Decided, fixed |

**Checked in the second pass and found sound:** every admin route is `ADMIN`-only and the account routes cannot change an admin or oneself; applications, bank accounts, bank transfers, vendor payouts, receipts, access codes, announcements, equipment, ads, schedules, condition reports, violations, merge and unmerge, subscriptions and manager invite codes each check the caller's connection to the record; notifications are scoped to the recipient; the repair routes use conditional updates; no response contains a password hash, token hash or provider payload.

**Still not covered:** the live Paystack call (never run, ISS-010), the production environment variables and DNS (SPF/DKIM), and a reading of the screens' own client-side checks (the server is the authority in every case above).

## Before relying on the fixes with real data

There is no production database yet (2026-10-22), so there is nothing to check today: a database built from the migrations starts clean. If data from development or another system is ever imported, run these on it first; each should return no rows, and if one does, someone is already affected:

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
