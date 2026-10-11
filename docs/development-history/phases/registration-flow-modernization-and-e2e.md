# Registration Flow Modernization, Landlord Friction Removal & E2E Test Suite

**Status:** Complete on `feature/registration-ux-and-e2e`, pending PR and the open items under "What's next". **Dates:** 2026-10-10 → 2026-10-11.

## Why

Tester feedback revealed critical onboarding friction:
> *"I did some testing yesterday... I was unable to complete even the registration flow."*

Investigation uncovered 4 root causes:
1. **Landlord Registration Friction:** Landlord signup forced 3 sequential steps, requiring mandatory banking details (Bank Name, Account Number, Account Name) and property declarations before allowing entry into the application.
2. **Broken Outbound Email URLs:** Verification links sent to tester emails pointed to raw API paths (`/api/v1/verify-email?token=...` or `/api/v1/auth/verify-email?token=...`), returning raw JSON or 405 Method Not Allowed errors when clicked in a browser. Furthermore, in remote/preview environments (Vercel), links resolved to offline `localhost` addresses.
3. **Property Manager Code Deadlock:** Property Manager registration blocked progression without an active Landlord Invitation Code (`ManagerInviteCode`), but no demo code existed in seeded datasets, and landlords had no mechanism to invite managers directly by email.
4. **Imperative Navigation Anti-pattern:** Auth views (`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `AdminDashboard`) used `<button onClick={() => router.push(...)}>` rather than native Next.js `<Link>` components, breaking browser ergonomics (new tab, middle click, URL preview) and SEO prefetching.

## What Was Built

### 1. Landlord Signup Streamlining (ADR-0002)
- Reduced Landlord registration from 3 steps down to 2 steps (`Account Type` → `Your Details`).
- Completely removed the upfront "Property & Banking" step from the registration form.
- Made NIN optional during initial signup.
- Replaced the upfront banking requirement with a post-login sticky reminder banner on the Landlord Dashboard (`/dashboard`), prompting first-time landlords to configure payout bank accounts (`/dashboard/settings`) and list their first property (`/dashboard/properties/new`).

### 2. URL Normalization & Multi-Environment Resolution (ADR-0001)
- Updated `lib/appUrl.ts` to inspect incoming `req.nextUrl.origin` and Vercel system environment variables (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`), preventing fallback to `localhost:3000` or `localhost:8000` when running in cloud deployments.
- Implemented path sanitization in `appUrl()`: stripped `/api/v1/` and `/api/v1/auth/` prefixes from user-facing routes, guaranteeing links resolve to browser-interactive UI pages (`/verify-email`, `/reset-password`).
- Passed `req` across all auth routes (`/register`, `/resend-verification`, `/forgot-password`, `/manager-codes`) to dynamically bind links to the host origin.
- Enhanced the floating development email widget (`EmailInboxWidget.tsx`) with automatic link normalization, ensuring links clicked inside preview popups route to the live client origin.

### 3. Manager Direct Email Invitations & Demo Support (ADR-0003)
- Seeded fixed demo code `DEMO-CODE` in `prisma/seed.ts` and `prisma/seed2.ts` assigned to landlord Eleanor Sterling.
- Added a 1-click "Fill Code" testing helper on Manager Step 2.
- Enhanced `POST /api/v1/manager-codes` to accept an optional recipient `email`, triggering an invitation email with a pre-filled registration link (`/register?role=manager&code=LLD-XXXX-XX`) captured by the dev email inbox widget.
- Updated `app/register/page.tsx` and `app/components/Auth/Register.tsx` to read `role` and `code` URL search parameters, pre-selecting Property Manager and validating the code upon arrival.

### 4. Native Next.js `<Link>` Migration (ADR-0004)
- Replaced callback buttons and imperative `router.push()` calls with `<Link>` across `Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`, `SetupWizardForm.tsx`, and `AdminDashboard.tsx`.
- Retained optional callback props (`onSwitchToRegister`, `onSwitchToLogin`, `onForgotPassword`, `onBack`) for backward compatibility in modal/embedded views.

### 5. Documentation Architecture Adoption
- Standardized documentation in accordance with the `octalve-edu` standard:
  - Task tracking in `docs/tasks/current-tasks.md` and `docs/tasks/0001-registration-flow-refactor-and-e2e.md` (with quality gate checklists).
  - Architecture Decision Records in `docs/adr/` (ADR-0001 to ADR-0004).

## Review fixes (2026-10-11)

An independent review of the first pass found and fixed:
- **Host-header link poisoning** (ISS-001, ADR-0005): `appUrl()` let the request `Host` override the configured origin. Now the request origin is used only outside production, plus a loopback fallback so a local production build works on any port.
- **Email case sensitivity** (ISS-002, ADR-0006): `emailSchema` + `findUserByEmail()` across auth, setup, lease invites and manager invites.
- **Manager invite endpoint**: validated address, 5 invites / 5 min per landlord, orphan code deleted if the email fails.
- **`Register.tsx`**: the `?code=` effect re-verified the original code on every keystroke; now runs once.
- **Landlord banner** only lists what is actually missing (bank account and/or property).
- **`tests/e2e/flows/registration.spec.ts`**: asserted the wrong page text, never pressed "Activate Account", and shared the one-use `DEMO-CODE`; manager tests now request a fresh invite from the seeded landlord.

## Verification performed

- `pnpm typecheck` clean; `pnpm build` succeeds (with and without `NEXT_PUBLIC_EMAIL_INBOX_ENABLED`).
- `pnpm test`: 250 / 250 API tests pass (3 new: email case-insensitivity, malformed invite email, valid invite).
- Playwright `registration.spec.ts`: 5 / 5 pass, serial, against a production build on **port 3022** and a throwaway database, with `.env` hardcoding `NEXT_PUBLIC_APP_URL=http://localhost:3099`. Dev (`next dev -p 3022`) and production builds both emailed `http://localhost:3022/…` links; a forged `X-Forwarded-Host` was rejected with 403.
- Full Playwright suite (serial, :3022): 48 passed, 2 skipped, 1 failed — `smoke/auth-forms` still clicked buttons that the `<Link>` migration turned into links; fixed and re-run (smoke 12 / 12).

## What's next

- Decide whether staging seeds `DEMO-CODE` or relies on emailed invites (ISS-003).
- Update `app/proplity-guide` content and screenshots for the 2-step landlord sign-up.
- Check for existing case-only duplicate accounts before considering a `citext` migration (ISS-020).
