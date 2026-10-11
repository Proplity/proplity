# 0001 — User-Facing APP_URL for Emails and Web Links

Status: Accepted
Decided by: Abdullah Jamiu · Date: 2026-10-10
Recorded: 2026-10-10

## Context

Proplity previously had inconsistent URL construction in outbound emails and API routes:

1. Emails sent verification links pointing directly to backend API routes (`/api/v1/auth/verify-email?token=...` or `/api/v1/verify-email?token=...`). When opened in a browser, this resulted in raw JSON responses or HTTP 405 Method Not Allowed errors.
2. URLs frequently fell back to `http://localhost:3000` or `http://localhost:8000`, causing dead links in preview and production environments such as Vercel.
3. Questions arose on whether this base origin should be named `NEXT_PUBLIC_API_URL` instead of `NEXT_PUBLIC_APP_URL`.

## Decision

1. **`NEXT_PUBLIC_APP_URL` represents the user-facing Web Application origin.** It is the canonical base URL for all human-facing links (emails, verification pages, password resets, OAuth callbacks, and SEO OpenGraph tags).
2. Outbound email links must always target client web pages (`/verify-email?token=...`, `/reset-password?token=...`), never machine API routes (`/api/v1/...`).
3. In unified Next.js App Router, frontend pages and `/api/v1` routes live under the same origin.
4. **Future Dedicated Server Evolution:** If Proplity adopts a separate, dedicated backend API server in the future (e.g. `https://api.proplity.com`), `NEXT_PUBLIC_APP_URL` will continue to serve frontend UI/email links, while `NEXT_PUBLIC_API_URL` will be introduced specifically for machine-to-machine HTTP fetch requests to that dedicated backend.

## Alternatives Considered

- **Naming it `NEXT_PUBLIC_API_URL`:** Rejected. Implies a machine API endpoint; leads to developers appending API routes into outbound emails rather than interactive UI pages.
- **Hardcoding localhost/domain:** Rejected. Breaks across Vercel preview environments and custom production domains.

## Consequences

- All outbound email templates must use `appUrl()` from `lib/appUrl.ts`.
- `appUrl()` automatically strips erroneous `/api/v1/` prefixes from user-facing paths.
- **Revisit if:** The frontend is completely separated from the backend into a standalone SPA / mobile application communicating with a distinct API server.

## Enforced by

- `lib/appUrl.ts` path normalization.
- E2E registration & verification test suite (`tests/e2e/flows/registration.spec.ts`).

## Binds

- `lib/appUrl.ts`
- `app/api/v1/auth/register/route.ts`
- `app/api/v1/auth/resend-verification/route.ts`
- `app/api/v1/auth/forgot-password/route.ts`
- `app/components/dev/EmailInboxWidget.tsx`
