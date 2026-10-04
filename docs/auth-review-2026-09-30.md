# Auth Review — 2026-09-30

A thorough, code-level review of the actual auth implementation (`lib/auth/jwt.ts`,
`lib/auth/session.ts`, `lib/auth/cookies.ts`, `lib/auth/csrf.ts`, `lib/auth/rateLimit.ts`,
`lib/api/withAuth.ts`, and all 8 routes under `app/api/v1/auth/`), triggered by a request for a
thorough assessment after an earlier pass only described the architecture ("stateless JWT access +
DB-backed refresh with rotation") without tracing whether every path — especially logout — actually
works end-to-end. It didn't. Same standard as the AlEemaan/Octalve Edu auth review this mirrors: read
the real code, find concrete exploit scenarios, not just describe the design.

## Findings, most severe first

### 1. Logout can silently fail to revoke the session server-side

**File:** `app/api/v1/auth/logout/route.ts`

**Issue:** Logout identifies whose refresh tokens to revoke by decoding the `access_token` JWT
(`getServerSession()`). The `refresh_token` cookie is deliberately scoped to
`path=/api/v1/auth/refresh` (a real, documented, otherwise-good design choice — it keeps the
long-lived credential off every other request) and is never sent to `/logout`. So logout has no
direct way to identify or revoke the refresh token; it can only go through the access token.

**Failure scenario:** The access token is a 15-minute JWT with no visible silent-refresh-on-idle
mechanism in what's read here. A user leaves a tab open past 15 minutes, comes back, and clicks
"Log out." `getServerSession()` returns `null` (expired JWT, `verifyToken` swallows every failure
mode into a flat `null`). The `if (session)` branch that calls
`refreshToken.updateMany({ revokedAt: new Date() })` is skipped entirely.
`clearAuthCookies()` still runs — the browser's cookies are gone, the UI shows "logged out" — but the
`RefreshToken` row in the database is untouched, still valid for up to 30 days (`rememberMe`). Anyone
holding a copy of that refresh token — stolen from browser storage, a device backup, a narrow XSS
window that occurred before the 15 minutes elapsed — retains a fully working session indefinitely
after the legitimate user believes they've logged out. This is the exact scenario (an idle browser,
an attacker with an out-of-band copy of the credential) that server-side revocability exists to
defend against, and it's the one path where it doesn't fire.

**Fix direction:** Logout needs a way to identify the user that doesn't depend on a _currently valid_
access token — e.g. a function that extracts `sub` from an expired-but-signature-valid JWT (verify
signature only, skip expiry) for this one cleanup purpose, never for authorization decisions. Never
silently no-op the revocation step just because the access token happened to already expire.

### 2. The rate limiter has a check-then-record race, same class as AlEemaan's original bug

**File:** `lib/auth/rateLimit.ts`, used by `login`, `register`, and `forgot-password`

**Issue:** `checkRateLimit(identifier)` runs a `prisma.loginAttempt.count()` _before_ the slow async
work in each route (bcrypt compare, DB writes, `sendEmail`); `recordAttempt()` only commits a new row
_after_, and only on the failure path. Nothing serializes the read and the later write across
concurrent requests sharing the same identifier.

**Scenario:** N concurrent login (or register, or forgot-password) requests with the same
`ip:email` identifier all execute `checkRateLimit()` before any of them reaches `recordAttempt()` —
all N can pass the 5-attempt check in the same window, regardless of the configured limit. Postgres
being the backing store fixes durability (survives a restart, works across serverless instances) but
does not fix this ordering problem — it's the identical bug class the AlEemaan/Octalve Edu auth
review found and fixed (`docs/auth-review-2026-09-29.md` in that project), just against a DB table
instead of an in-memory `Map`. Notably, `refresh/route.ts`'s own token-rotation logic _does_ get this
right elsewhere in this same codebase (`updateMany` with a conditional `WHERE revokedAt: null` — an
atomic check-and-update in one round trip) — the technique needed to fix this is already proven
correct here, just not applied to the rate limiter.

**Fix direction:** Reserve the attempt atomically, before the slow work — e.g. an `INSERT` that
itself counts as the reservation, checked via a preceding `count()` inside the same transaction or
a single conditional query, not two separate round trips with async work in between.

### 3. `getClientIp()` trusts raw `X-Forwarded-For`

**File:** `lib/auth/rateLimit.ts`

**Issue:** Reads `x-forwarded-for` directly with no check on who set it. On a self-hosted deployment
this header is client-controlled unless a reverse proxy is configured to overwrite it, making every
per-IP rate limit trivially bypassable with a spoofed header per request.

**Caveat, not yet confirmed either way:** this app runs on Vercel (per `.env` comments about pooled
connections), and Vercel's edge network may set/overwrite this header itself before it reaches the
function — if so, this finding could already be moot in the actual deployed environment. Not verified
here; check Vercel's specific header-trust guarantees before treating this as either a live bug or a
non-issue.

### 4. `validateCSRF`'s Origin-header branch has no `try/catch`

**File:** `lib/auth/csrf.ts`, line 9

**Issue:** `return new URL(origin).host === host;` is unguarded, while the Referer fallback two lines
below wraps the identical `new URL(...)` call in `try/catch`. A malformed `Origin` header (not
generally attacker-controlled in a normal browser, but not something to assume never happens) throws
uncaught inside the route handler — likely surfacing as an unhandled `500` instead of the intended
fail-closed `403`. Small, but inconsistent within the same function.

## What's done well (a thorough review states this too, not just problems)

- **Timing-safe login compare** (`login/route.ts`) — a real bcrypt hash of a fixed dummy value,
  compared on every attempt regardless of whether the account exists, with the reasoning spelled out
  in a comment. Exactly the fix the AlEemaan review had to retrofit; this route had it from the start.
- **Refresh-token rotation with genuine reuse-detection and family revocation** — a replayed
  already-rotated token revokes every token in its family, atomically, via a conditional `updateMany`.
  This is the "sophisticated part" and it's implemented correctly.
- **Password reset and change-password both revoke every active refresh token on the credential
  change** (`prisma.refreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() })`
  inside the same transaction as the password update). This is precisely the
  `revokeUserSessions()`-on-credential-change pattern AlEemaan's own plan flagged as designed but
  never wired up anywhere — worth copying the _trigger point_ into AlEemaan/Octalve Edu's own
  password-change flow once it's built (not the code directly — neither project has a refresh-token
  table).
- **Enumeration-safe forgot-password** — identical response regardless of whether the account exists,
  correctly reasoned in a comment.
- **Self-registration explicitly denylists `ADMIN`** from the set of roles a new account can claim,
  re-validated server-side — never trusts a client-supplied role string for anything privileged.
- **Manager invite-code redemption is re-checked inside the transaction**, not just at the earlier
  read — correct handling of the concurrent-redemption race.
- **`PasswordResetToken` and `VerificationToken` are deliberately separate models**, with the reasoning
  for not merging them (requesting a reset would otherwise silently invalidate a pending
  verification link, or vice versa) written directly in the schema comment — good judgment, and
  documented as a judgment call rather than left implicit.

## Relevance to AlEemaan / Octalve Edu

Don't adopt this JWT-access + DB-refresh split for either project — the database-session-only
decision there was already deliberate and audit-driven (PRD §7's server-revocable-sessions finding),
and finding #1 above is a concrete demonstration of a failure mode the split model has that a single
database session doesn't: AlEemaan's rebuilt logout (`docs/development-history/phases/phase-0.5.1.5-auth-rebuild.md`)
reads the one session cookie it always has direct access to and deletes the one row it names — there
is no "which token can I actually reach from this route" indirection problem to get wrong, by
construction. The refresh-cookie path-scoping that causes finding #1 is a genuinely reasonable idea in
isolation (reduce a long-lived credential's exposure) — it just doesn't compose safely with "logout
needs to identify the user," and that combination is worth remembering as a reason _not_ to introduce
a second, narrower-scoped credential into either project's own auth later without checking every route
that needs to read it.
