# 0006 — Emails are normalised to lowercase and looked up case-insensitively

Status: Proposed
Decided by: roji-tech (pending acceptance) · Date: 2026-10-11
Recorded: 2026-10-11

## Context

`User.email` is a case-sensitive unique column and no route normalised input. A phone keyboard that capitalises the first letter ("John@x.com") created a different account from "john@x.com", then failed to log in with the lowercase form. Duplicate accounts per person were possible.

## Decision

1. Every inbound email goes through `emailSchema` (`lib/auth/email.ts`: trim, lowercase, validate). Used by login, register, forgot-password, resend-verification, tenant invites on lease creation and manager invites.
2. Lookups use `findUserByEmail()` (case-insensitive) so rows stored with mixed case before this change stay reachable.
3. New rows are stored lowercase.

## Alternatives Considered

- **`citext` column / lowercase unique index:** the cleaner end state, rejected for now because it needs a data migration that must first check existing rows for case-only duplicates.
- **Lowercase only at registration:** rejected, login and reset would still miss mixed-case input.

## Consequences

- Case-only duplicate accounts that already exist are not merged by this change.
- **Revisit if:** a migration to `citext` is scheduled, which would supersede part 2.

## Enforced by

`tests/api/auth.test.ts` ("treats emails case-insensitively …") and `tests/api/deferred-flows.test.ts`.

## Binds

- `lib/auth/email.ts`
- `app/api/v1/auth/{login,register,forgot-password,resend-verification}/route.ts`, `app/api/v1/setup/route.ts`, `app/api/v1/leases/route.ts`, `app/api/v1/manager-codes/route.ts`
