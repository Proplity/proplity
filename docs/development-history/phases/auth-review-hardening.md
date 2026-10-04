# Auth review hardening — idle-session logout, atomic rate limiting, last-hop client IP, CSRF parsing

**Status:** Complete and verified. **Dates:** 2026-09-30 (review) → 2026-10-01 (PR #21 and follow-ups).

## Why

An earlier pass described the auth design ("stateless JWT access + DB-backed refresh with rotation") without tracing whether every path — logout especially — worked end to end. A code-level review followed (`docs/auth-review-2026-09-30.md`): read the real code, find concrete exploit scenarios. It found four issues, one serious.

## What was fixed

1. **Logout silently skipped revocation for an idle session** (serious). The `refresh_token` cookie is scoped to `path=/api/v1/auth/refresh`, so `/logout` never receives it and identifies the user by decoding `access_token`. With the strict `getServerSession()`, an access token already expired (tab idle past 15 minutes) produced `null`, the revoke step was skipped, cookies were cleared and the UI looked logged out — but the `RefreshToken` row stayed valid for up to 30 days.
   - Fix: `verifyTokenAllowExpired()` / `getExpiredSession()` in `lib/auth/jwt.ts` accept a signature-valid but expired JWT **for this one identification purpose only**, never for authorization.
   - Caught live: the first version used `instanceof errors.JWTExpired`, which silently failed because Next.js can bundle `jose` into more than one module instance across the route/library boundary. The check is `err.code === 'ERR_JWT_EXPIRED'`. Confirmed against a real database (refresh-token count went from >0 to 0 across the logout call).
2. **Rate limiter check-then-record race.** `checkRateLimit()` counted attempts before the slow work (bcrypt, DB writes, email) and `recordAttempt()` inserted only afterwards, so N concurrent requests could all pass the count. Replaced by `reserveAttempt(identifier, userId?, maxAttempts?)` / `releaseAttempt(attemptId)` in `lib/auth/rateLimit.ts`: a transaction takes `pg_advisory_xact_lock(hashtext(identifier))`, counts the window and inserts the reservation atomically, **before** the slow work. Routes whose success shouldn't count (a successful login) release the reservation, preserving "only failures count". Used by `login`, `register`, `forgot-password`, `resend-verification`, `refresh` and `setup`.
   - `refresh` uses `REFRESH_MAX_ATTEMPTS = 30`. The first cut applied the default of 5 to it and broke the E2E suite, because `refresh` is a periodic background call from every authenticated tab (and CI runs every browser from one IP) — it is not a credential-guessing surface.
3. **`getClientIp()` trusted the first `X-Forwarded-For` entry**, which is whatever the client sent. Now it returns the **last** hop — the address the trusted edge (Vercel) observed — so a spoofed header can no longer rotate the per-IP limit.
4. **`validateCSRF` threw on a malformed `Origin` header.** The `new URL(origin)` call is now guarded like the Referer fallback, so it fails closed with 403 instead of surfacing a 500.

## What was already right (and stays)

Timing-safe login compare, refresh-token rotation with reuse detection and family revocation, session revocation on password reset/change, enumeration-safe forgot-password, `ADMIN` excluded from self-registration, re-checked invite-code redemption, separate `PasswordResetToken` / `VerificationToken` models. The review's full "done well" list is in `docs/auth-review-2026-09-30.md`.

## Design lesson

A narrower-scoped credential (the path-scoped refresh cookie) is good in isolation but doesn't compose with any route that needs to identify the user without a currently valid access token. Before adding another narrowly-scoped credential, check every route that must read it.

## Verification performed

- Live check of logout revocation against a real database (see above).
- `tests/api/auth.test.ts` extended (with an expired-token helper in `tests/helpers/auth.ts`) to cover logout after the access token expires; Playwright login/refresh flows pass under CI's shared IP.
- `pnpm typecheck`, `pnpm format:check`, `pnpm build` clean; all three CI jobs green.

## What's next

- Confirm Vercel's `X-Forwarded-For` guarantees in the deployed environment (the last-hop rule assumes exactly one trusted proxy).
- Older planning docs (`docs/auth-implementation-plan.md`, `docs/auth-walkthrough.md`) predate these changes and carry superseded notes; `CLAUDE.md` "Auth architecture" is the current reference.
