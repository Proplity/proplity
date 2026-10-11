# 0002 — Landlord Registration Excludes Upfront Banking and Property Creation

Status: Accepted
Decided by: roji-tech · Date: 2026-10-10
Recorded: 2026-10-10

## Context

Prior to this decision, Landlord registration required 3 steps:

1. Account Type selection
2. Personal details + mandatory NIN
3. Property details & Banking details (Bank Name, Account Number, Account Name)

Tester feedback revealed critical onboarding friction: testers and prospective landlords abandoned registration at Step 3 because banking details were demanded before they could even evaluate or enter the application. Furthermore, NIN validation could block users testing non-production or demo accounts.

## Decision

1. **Remove Property and Banking steps from the initial registration form.** Landlord signup is streamlined to 2 steps (Role selection → Name, Email, Phone, State, Password).
2. **Make NIN optional during initial registration.**
3. **Move banking and property onboarding to post-login dashboard lifecycle.** When a newly registered Landlord logs in, if their portfolio is empty or banking details are missing, display a non-blocking sticky reminder banner guiding them to `/dashboard/settings` (to configure payout details) and `/dashboard/properties/new` (to list their first property).

## Alternatives Considered

- **Keep Step 3 but make all fields optional:** Rejected. Presenting empty property and bank forms still creates visual friction and confusion for new users trying to sign up.
- **Require banking only on rent collection:** Accepted as the subsequent enforcement point; payout setup is only mandatory when withdrawing or receiving disbursed rent.

## Consequences

- Landlord registration drop-off is significantly minimized.
- Landlord registration completes in under 30 seconds.
- The landlord dashboard must present clear contextual banners guiding first-time setup.
- **Revisit if:** Regulatory KYC compliance mandates verified bank account ownership prior to account activation.

## Enforced by

- Registration form step definition in `app/components/Auth/Register.tsx`.
- Registration API payload validation in `app/api/v1/auth/register/route.ts`.
- E2E registration tests (`tests/e2e/flows/registration.spec.ts`).

## Binds

- `app/components/Auth/Register.tsx`
- `app/components/LandlordDashboard.tsx`
- `tests/e2e/flows/registration.spec.ts`
