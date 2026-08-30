# Account settings page

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

Last of the three items requested in this pass, and the direct payoff of the orphaned-models phase's own "What's next" note: `BankAccount` had a full, tested backend and ready-to-use hooks (`useBankAccounts`) but no page to host them, the same situation `AccessCode` creation was in before its own UI landed. Separately, `POST /api/v1/auth/change-password` has existed and worked since early in the project but was never wired to any form either — found while scoping this page.

## Scope decision

Two sections, both backed by APIs that already existed and were already tested — no new backend routes: **Change Password** and **Bank Accounts** (full CRUD: add, set default, delete — using the single-default-invariant backend built in the orphaned-models phase). Deliberately **not included**: profile-field editing (name/phone/avatar) — there's no `PATCH /auth/me` route in this codebase, and adding one is its own backend decision, not a side effect of giving two already-built endpoints somewhere to live.

## What was built

- `app/components/AccountSettings.tsx` — `ChangePasswordCard` (current/new/confirm password, client-side length + match validation, calls `POST /auth/change-password` directly via `fetch`, matching `AuthContext.tsx`'s own established pattern for auth routes rather than the `api.*` domain-route convention). Since that route revokes every refresh token and clears cookies on success, a successful change redirects straight to `/login`. `BankAccountsCard` — add/set-default/delete, shown only for `manager`/`landlord`/`vendor`/`admin` (the roles `POST /bank-accounts` already restricts server-side; a TENANT never sees the section).
- `app/dashboard/settings/page.tsx` — thin page wrapper, same pattern as every other `/dashboard/*` route (`TenantPaymentHistory`, etc.).
- `app/dashboard/DashboardChrome.tsx` — the header's gear icon button existed but had no `onClick` (dead since whenever the header was built); wired to `router.push('/dashboard/settings')`.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, still 194/194 passing (no new backend routes, so no new test coverage needed — `bank-accounts` and `change-password` were already covered by existing suites).
- `pnpm build` — production build succeeds; `/dashboard/settings` present in the route manifest.
- Manual smoke test against a real running `pnpm dev` server: unauthenticated request to `/dashboard/settings` correctly 307-redirects to `/` (same middleware gate as every other dashboard page); authenticated as the seeded `manager@proplity.com` account, the page renders "Account Settings" and "Change Password" in the initial HTML with no error markers (the Bank Accounts card is conditionally rendered client-side once `useAuth()` resolves, the same pattern the rest of the app already uses for role-gated UI, not a bug).

## What's next

Remaining from `docs/development-history/project-audit.md`: repo-wide CSRF coverage, real AI/LLM integration. All items from this session's three-part request (CSV/Excel → e-signature → settings page) are now complete.
