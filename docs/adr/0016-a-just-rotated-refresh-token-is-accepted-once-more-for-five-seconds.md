# 0016 — A just-rotated refresh token is accepted once more for five seconds

Status: Proposed
Decided by: pending (the owner accepts) · Date: pending
Recorded: 2026-10-20
Shipped: the code is already live on `prod` (PRs #138 and #139 into `dev`, #140 into `main`, #137 into `prod`, 2026-10-21) while this record is still Proposed; accepting it, or changing the window, is the owner's call.

## Context

Every refresh rotates the token: the server revokes the old value and sets a new cookie. If the browser aborts the request after the server rotated but before the cookie was stored (a reload or a link click while an idle tab wakes up), the next refresh arrives with the old value. It looked like theft, so the whole `familyId` was revoked and the person was signed out. This is how ISS-131 failed in CI and how ISS-134 can hit a real visitor.

## Decision

In `app/api/v1/auth/refresh/route.ts`, a token that was rotated less than `REFRESH_GRACE_MS` (5 seconds, `lib/auth/refreshGrace.ts`) ago, and is not expired, may be exchanged **once** for a fresh pair in the same family.

- The rotation stays one atomic `updateMany` on `{ tokenHash, revokedAt: null, expiresAt > now }`. It now also writes `replacedBy` (the new token's hash is chosen before it), so a retry can never see a rotated token without its link.
- In the grace case the replacement that was handed out is taken out of service with one atomic claim (`updateMany` on it with `revokedAt: null`). Only the first retry wins. A losing retry inside the window gets 401 and neither revokes the family nor clears cookies (the winner has just set new ones).
- The claim needs the replacement to be **active**, so a session that was signed out, had its password changed or reset, or was suspended or re-roled (all of which revoke the active tokens) is never brought back.
- A replay after the window is reuse: the family is revoked, as before.

## Alternatives Considered

- **No grace window, fix only the test:** leaves the sign-out for real visitors.
- **A longer window (10 seconds in the first draft, or a minute or more):** a stolen token has longer to be replayed unnoticed. The owner asked for 5 seconds on 2026-10-21.
- **Return the same replacement again:** needs the raw token stored, which we deliberately never do (only the SHA-256 is kept).
- **Let every retry in the window succeed and keep the replacement alive (Auth0's "reuse interval"):** friendlier to two tabs, but leaves two live chains in one family, which weakens theft detection. Single use was chosen.
- **One interactive transaction for the whole rotation:** would close the few milliseconds before the new row exists, at the price of reshaping the security-critical path. Not done; see Consequences.

## Consequences

- A replay of a stolen token inside 5 seconds of its rotation is accepted once, if the real holder has not already used the replacement; whoever uses their token next inside the window is accepted again (each acceptance revokes the other side's token), and the first mismatch past the window revokes the family.
- Refresh stays atomic: the grace path adds a second `updateMany` claim, never a read-then-write.
- Two tabs refreshing at the same instant no longer sign the person out. If the tab that loses the race writes its cookie last, the browser holds the claimed replacement, which is revoked; the next refresh then lands outside the window and signs the person out (as every concurrent pair did before this ADR).
- A retry that arrives more than 5 seconds after the lost response (a reload on a slow phone connection can take that long) is outside the window and signs the person out, as before this ADR. In a trace of the original CI failure the retry came about 1.2 seconds after the rotation.
- A retry that arrives in the few milliseconds between the rotation and the new row being written gets 401 with no side effects; the next retry works.
- **Revisit if:** the window is abused (see the audit log), or sessions move to a service with its own rotation leeway.

## Enforced by

`tests/api/auth.test.ts`: a retry inside the window succeeds and the family lives; a second retry gets 401 without revoking; a retry after a sign-out is refused; a retry before the new row exists does not revoke the family; a replay after the window revokes the family.
