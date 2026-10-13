# 0012 — Identity documents are deleted after a retention period

Status: Accepted
Decided by: roji-tech · Date: 2026-10-13
Recorded: 2026-10-13

## Context

Tenant ID documents are personal data (NDPR). Nothing deleted them: files lived until someone removed them by hand, and there is no account-deletion flow (ISS-039). Keeping identity documents indefinitely is a legal and breach-impact risk with no product benefit.

## Decision

A daily job (`retention`, part of the existing cron `all` run) deletes identity documents (`StoredFile` folders `profile` and `applications`) when there is no reason left to hold them:

1. **Tenancy ended:** the user has leases, none pending or active, and the latest one ended more than **12 months** ago.
2. **Never became a tenant:** the user has applications, all rejected, and the latest decision is more than **90 days** old.
3. Users with no lease and no application are left alone (no trigger yet).

Deletion removes the stored object, marks the `StoredFile` row `DELETED`, clears `User.idDocumentUrl` if it pointed at the file, and writes a `FILE_RETENTION_DELETED` audit entry (no file contents). Deletion is irreversible, so it only runs when `RETENTION_ENABLED=true`; otherwise the job reports what it would remove and changes nothing.

## Alternatives Considered

- **Delete on request only:** the minimum legal posture, but it relies on tenants knowing to ask. Kept as a complement, not a replacement.
- **Keep until account deletion:** there is no account-deletion flow yet, so nothing would ever be removed.
- **Shorter periods:** rejected for now; landlords may need the document for disputes after a tenancy ends.

## Consequences

- The 12-month and 90-day periods are a proposal and should be confirmed by whoever owns compliance before `RETENTION_ENABLED` is switched on in production.
- A returning tenant must upload an ID again after a deletion.
- **Revisit if:** an account-deletion flow is built (it should call the same delete path), or legal advice sets different periods.

## Enforced by

`tests/api/retention.test.ts`.
