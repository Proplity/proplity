# 0001: Registration Flow Refactoring, Native Links, Email URLs & E2E Tests

- **Period / Focus:** 2026-10-10 to 2026-10-11 (Registration UX, Friction Elimination, URL Normalization & E2E Suite)
- **Status:** Completed
- **Priority:** Critical
- **Assignee:** Antigravity (initial work) / Claude (review fixes)
- **Target Branch / PR:** `feature/registration-ux-and-e2e` (merged into `dev`)
- **Started:** 2026-10-10 20:30:00 UTC
- **Ended:** 2026-10-12 18:00:00 UTC
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.
> **Running now:** items marked **(running)** are background processes currently executing. They are not done until the marker is removed and the box is ticked. _Currently: nothing running._

---

## 1. Objective

Eliminate tester friction in user onboarding by streamlining landlord signup (no upfront property or banking), using native Next.js `<Link>` navigation, making outbound email links resolve to real web pages in every environment without trusting the request host, making manager registration testable via invite codes, and covering all four self-registration roles with end-to-end tests.

## 2. Context & Related Docs

- Tester feedback: _"I was unable to complete even the registration flow."_
- ADRs: [0001](../adr/0001-user-facing-app-url-and-email-verification.md), [0002](../adr/0002-streamlined-landlord-registration.md), [0003](../adr/0003-email-based-manager-invitations.md), [0004](../adr/0004-native-nextjs-links-over-imperative-navigation.md) (accepted); [0005](../adr/0005-email-links-never-derive-from-the-request-host.md), [0006](../adr/0006-emails-are-case-insensitive-and-stored-lowercase.md) (proposed, awaiting acceptance).
- Phase write-up: `docs/development-history/phases/registration-flow-modernization-and-e2e.md`.

---

## 3. Work Breakdown (Grouped by Module / Sub-Phase)

### Module A: Navigation & Link Modernization

- [x] Replace `router.push` and legacy callback buttons with native `<Link>` in `Login.tsx` and `app/login/page.tsx`
- [x] Convert back and switch links in `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, and `VerifyEmail.tsx` to `<Link>`
- [x] Modernize navigation buttons in `AdminDashboard.tsx` and `SetupWizardForm.tsx`
- [x] Make legacy callback props optional across auth components

### Module B: Landlord Signup Streamlining

- [x] Remove Property & Banking step from `Register.tsx` (Landlord signup is 2 steps)
- [x] Make NIN optional on the registration form
- [x] Setup banner on `LandlordDashboard.tsx`, shown only for what is still missing (no bank account and/or no property)

### Module C: Outbound Email & Host Normalization

- [x] `lib/appUrl.ts`: request origin only outside production; configured `NEXT_PUBLIC_APP_URL` otherwise; Vercel URLs as fallback (ADR-0005)
- [x] Normalize `/api/v1/(auth/)verify-email|reset-password` paths to the web pages
- [x] Pass `req` from register, resend-verification, forgot-password, manager-codes and lease tenant-invite
- [x] `EmailInboxWidget.tsx` rewrites links to the live origin (dev tool)
- [x] Lowercase + case-insensitive email handling across auth, setup, lease invites (ADR-0006) with tests

### Module D: Manager Invitation Flow & Testing Support

- [x] Seed `DEMO-CODE` in `prisma/seed.ts` and `seed2.ts`
- [x] "Fill Code" helper in `Register.tsx` (non-production builds only)
- [x] Invite by email from `LandlordDashboard.tsx`: validated address, rate-limited (5 per 5 min), orphan code deleted if the email send fails
- [x] `?role=` / `?code=` prefill in `Register.tsx`; fixed the effect that re-verified the original code on every keystroke
- [ ] Decide: seed `DEMO-CODE` on staging, or rely on emailed invites (staging runs as `NODE_ENV=production`, so "Fill Code" is hidden there) — **needs product decision**

### Module E: UI End-to-End Testing & Verification

- [x] Playwright spec `tests/e2e/flows/registration.spec.ts` written (verify-page assertion corrected to "Account Activated")
- [x] Production build with `NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true`
- [x] Playwright registration spec (5 tests, serial, `--workers=1`) passes against a production build on :3022 and a throwaway database (`proplity_e2e_tmp`)
- [x] Verified email links on a non-default port (3022) in dev and in a production build with `NEXT_PUBLIC_APP_URL=…:3099` hardcoded in `.env`; forged `X-Forwarded-Host` returns 403
- [x] Capture/update screenshots in `docs/screenshots` and `public/screenshots` (`scripts/capture-guide-screenshots.mjs`: registration for 3 roles, verification, manager invite, login, password reset)
- [x] Update `app/proplity-guide` content (Start Here paths, 1.7–1.10 account flows, cross-links) and `docs/proplity-step-by-step-role-guide.md` (steps 1.8–1.11)

### Module F: Documentation

- [x] Issue register `docs/issues/` (README, `issues.md`, `template.md`) — keep it updated in the same pass a problem is found

- [x] ADRs 0001–0004: Decided by roji-tech; ADRs 0005–0006 added as Proposed
- [x] Phase doc corrected to match what was verified
- [ ] `CLAUDE.md`, `CURRENT_STATE.md`, `PROJECT_STRUCTURE.md`: link `docs/adr/` and `docs/tasks/`, record the changes

---

## 4. Unified Verification & Quality Gates

- [x] `pnpm typecheck` clean (0 errors)
- [ ] `pnpm format:check` clean (re-run at the end)
- [x] No `lint` script exists in this repo; formatting is the lint gate
- [x] `pnpm build` succeeds (with and without the inbox flag)
- [x] Targeted tests: `auth.test.ts` + `deferred-flows.test.ts` (66 tests incl. 3 new)
- [x] Full API suite re-run after the latest changes: 250 / 250 pass
- [x] Full Playwright suite, serial, production build on :3022: 51 tests — 48 passed, 2 skipped, 1 failed (`smoke/auth-forms`, which still looked for buttons that ADR-0004 turned into links; spec updated, smoke re-run 12 / 12)

---

## 5. Notes, Findings & Deviations

- **URL architecture:** `NEXT_PUBLIC_APP_URL` is the user-facing web origin (ADR-0001). The first implementation let the `Host` header override it, which allows password-reset link poisoning; replaced per ADR-0005.
- **Email case:** found while reviewing this task, not reported by testers; phone keyboards capitalise the first letter, creating separate accounts (ADR-0006).
- **Password length:** register/reset/change deliberately allow 6+ characters; only the admin setup wizard requires 8. Not a bug.
- **Landlord friction:** the old banking fields were never persisted by `POST /auth/register` — removing them lost no data.

## 6. Output & Deliverables

- **Branch:** `feature/registration-ux-and-e2e` (uncommitted until the gates above are ticked)
- **Commits:** —
- **PR:** —
- **Docs:** `docs/adr/0001`–`0006`, `docs/tasks/0001-*.md`, `docs/tasks/current-tasks.md`, `docs/development-history/phases/registration-flow-modernization-and-e2e.md`
