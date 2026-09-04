# Password reset, resend-verification, and profile edit (PATCH /me)

**Status:** Complete, typecheck/format/build verified. **Test suite not executed — no local database access in this environment; the 19 new tests will first run in CI.** **Date:** 2026-09-04.

## Why

The user asked directly whether Proplity had a working "forgot password" flow (it didn't — `ForgotPassword.tsx` only called `setSubmitted(true)`, confirmed as audit finding #4 and still open as of `project-audit-2026-08-30.md`) and asked what else, by comparison to Django's Djoser (a common batteries-included auth toolkit), was worth adding. Confirmed via `AskUserQuestion`: build password reset + resend-verification + profile edit (`PATCH /auth/me`), and keep email on console-transport rather than wiring a real provider now (no API key available, and the interface was already designed to make that swap a one-function change later).

## Scope decision

Three additive auth routes plus one existing-route extension, all following patterns already established by `register`/`verify-email`/`change-password` rather than inventing new ones. Deliberately **not** included this pass: real email delivery (needs a provider/API key, a separate decision), change-email (needs its own re-verification design), self-service account deletion (not requested), avatar upload (no file-storage endpoint exists anywhere in this codebase — a pre-existing, documented gap).

## What was built

**Schema**: new `PasswordResetToken` model (migration `20260904000000_password_reset_token`) — deliberately a *separate* model from the existing `VerificationToken` rather than adding a "purpose" discriminator column to it. Both are one-per-user (`userId @unique`); sharing one table would mean requesting a password reset silently invalidates a pending email-verification link, or `POST /verify-email` would need to stop assuming every token it finds means "activate this account." Shorter expiry than email verification — 1 hour vs. 7 days — since this token grants an actual password change, not just an activation.

**`POST /api/v1/auth/forgot-password`**: CSRF-checked, rate-limited on the same `ip:email` identifier shape `login` uses. Always responds `200` with an identical generic message regardless of whether the email is registered — the standard defense against using a password-reset endpoint to enumerate real accounts. A registered email gets a real emailed (console-transport) reset link; `passwordResetToken.upsert()` on `userId` means a second request simply replaces the first token rather than erroring or leaving two live links.

**`POST /api/v1/auth/reset-password`**: consumes the token, hashes the new password, and — matching `change-password`'s own convention exactly — revokes every existing refresh token for that user in the same transaction, so a reset also kills any session an attacker might already be holding. Deliberately **CSRF-exempt**, the same reasoning as `verify-email` (CLAUDE.md rule 3, now updated to cover both): the single-use, time-limited, high-entropy token is the actual security boundary, and the caller has no session yet for an Origin check to protect anyway.

**`POST /api/v1/auth/resend-verification`**: same generic-response-regardless-of-match shape as `forgot-password`, for the same enumeration-resistance reason. A no-op (but still `200`) for an unknown email or an already-`ACTIVE` account; for a real `PENDING_VERIFICATION` account, upserts a fresh `VerificationToken` (again replacing rather than duplicating) and resends the same verification email `register` sends.

**`PATCH /api/v1/auth/me`**: extends the existing `me` route file rather than a new one. Deliberately narrow — `name`/`phoneNumber`/`bio` only. No `email` (a real change would need its own re-verification step), no `role`/`status` (privilege fields, never self-service), no `avatarUrl` (no upload backend exists). `GET /me`'s `select`/serialization was extended to include `phoneNumber`/`bio` so the new profile form can prefill from it.

**Frontend**: `ForgotPassword.tsx` wired to the real endpoint (was local-state-only). New `app/reset-password/page.tsx`, structurally a near-mirror of the existing `app/verify-email/page.tsx` (Suspense-wrapped `useSearchParams()`, same visual language) but with a required rather than optional password. `Login.tsx` gained a "Resend verification email" action that appears specifically when the login error is the `PENDING_VERIFICATION` message, reusing the email already typed into the form. `AccountSettings.tsx` gained a `ProfileCard` (name/phone/bio, calls `PATCH /me`, then `auth.refreshUser()`) above the existing `ChangePasswordCard`/`BankAccountsCard`; `AuthContext.tsx`'s `User` type gained `phoneNumber`/`bio`.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm format:check` — clean (after one Prettier auto-fix on the new `reset-password/page.tsx`).
- `pnpm build` — production build succeeds; all 4 new/changed routes (`/api/v1/auth/forgot-password`, `/reset-password`, `/resend-verification`, `/api/v1/auth/me` PATCH, `/reset-password` page) present in the route manifest.
- `pnpm exec prisma generate` — succeeds with no database connection (schema-only), confirming the new model compiles.
- **Not performed: `pnpm test`.** No local Postgres credentials were available in this environment (same limitation the `deployment-vercel-cicd-and-audit-fixes.md` phase hit). 19 new tests were written across 4 new `describe` blocks in `tests/api/auth.test.ts` (forgot-password: CSRF, rate-limit via the same IP-discovery-probe pattern the existing refresh rate-limit test uses, generic-response-for-unknown-email, real-token-created, token-replaced-on-second-request; reset-password: CSRF-exempt, unknown/expired/short-password rejection, full reset-revokes-sessions-consumes-token flow with reuse rejected; resend-verification: CSRF, unknown-email no-op, already-ACTIVE no-op, PENDING_VERIFICATION issues-and-replaces; PATCH /me: auth-required, CSRF, empty-body rejected, privilege-field-smuggling rejected, real update + null-clears-a-field). Suite total is now 233 `it` blocks (214 → 233), unexecuted, first run will be in CI.

## What's next

Real email delivery (swap `lib/email.ts`'s console transport for Resend/Postmark/SES — a one-function change per its own comment, needs a provider decision and API key) would make every link built in this phase actually reach a real inbox. Beyond that, unchanged from the prior audit: the PRD §6 AI/Intelligence layer remains entirely unbuilt, and the open punch list in `docs/development-history/project-audit-2026-08-30.md` stands as-is.
