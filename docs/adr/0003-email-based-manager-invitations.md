# 0003 — Property Manager Codes Support Direct Email Invitations

Status: Accepted
Decided by: Abdullah Jamiu · Date: 2026-10-10
Recorded: 2026-10-10

## Context

Property Managers are bound to a Landlord via a unique invitation code (`ManagerInviteCode` model, format `LLD-XXXX-XX`).
Historically, landlords could only generate unassigned codes and manually copy-paste them outside the application (via SMS or messaging). This made end-to-end testing and user experience disjointed, as testing required manually opening two different browsers or accounts, and no invite email appeared in the development email inbox widget.

## Decision

1. **Extend `POST /api/v1/manager-codes` to accept an optional recipient email (`email`).**
2. When an email is supplied:
   - Generate the code as before.
   - Dispatch an outbound invitation email via `sendEmail()` containing the code and a direct pre-filled registration link: `${appUrl(`/register?role=manager&code=${created.code}`)}`.
3. In local and preview environments, this email is captured by `lib/email.ts` and rendered in the floating `EmailInboxWidget`.
4. The registration page (`/register`) reads `role` and `code` query parameters to automatically select Property Manager, populate the code, and trigger instant code verification.
5. In addition, seed a fixed demo code `DEMO-CODE` in `prisma/seed.ts` and provide a 1-click shortcut in the registration UI during development for rapid testing.

## Alternatives Considered

- **Keep manual copy-only codes:** Rejected. Creates friction for landlords who expect direct email invites, and prevents automated dev-inbox testing.
- **Require email before any code generation:** Rejected. Landlords should still have the option to generate a generic code to paste in WhatsApp without having to enter the manager's email in the system first.

## Consequences

- Landlords can either quick-generate a code or send a direct email invitation.
- Testers and prospective managers can click the link in the dev inbox widget or their real email client to land directly on a verified registration step.
- **Revisit if:** Multi-portfolio managers or team-based agency management require multi-landlord code chaining.

## Enforced by

- `app/api/v1/manager-codes/route.ts` email dispatch logic.
- `app/register/page.tsx` and `app/components/Auth/Register.tsx` URL query handling.
- E2E tests (`tests/e2e/flows/registration.spec.ts`).

## Binds

- `app/api/v1/manager-codes/route.ts`
- `app/components/LandlordDashboard.tsx`
- `app/components/Auth/Register.tsx`
- `app/register/page.tsx`
- `prisma/seed.ts`
- `prisma/seed2.ts`
