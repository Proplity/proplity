# 0018 — Administrators sign in at their own page, and on their own host when one is configured

Status: Accepted
Decided by: the owner · Date: 2026-11-26
Recorded: 2026-11-26

## Context

Administrators signed in through the same `/login` as tenants and landlords, and the admin area was just `/admin` on the public host. An administrator account is the most valuable target on the platform, and a public sign-in form that accepts it invites credential stuffing against it. The owner asked for a separate admin sign-in that nobody else can use, an administrator who cannot use the public sign-in, and, in production and staging, an admin area served only on its own subdomain (`admin.proplity.com`, `admin.staging.proplity.com`). The free `*.vercel.app` domain cannot have subdomains, so the host split has to be optional.

## Decision

- `/admin/login` signs in administrators only; the public `/login` refuses them. Both endpoints (`POST /api/v1/auth/login`, `POST /api/v1/auth/admin/login`) are one implementation, `lib/auth/loginFlow.ts`. A wrong kind of account gets the same `401 Invalid email or password` as a wrong password, after the same bcrypt work, and counts as a failed attempt, so neither endpoint tells a caller whether an address belongs to an administrator.
- The server env var `ADMIN_HOST` puts the admin area on its own host. Set, an administrator can sign in only there and nobody else can; `/admin` pages and `/api/v1/admin/*` are not served on any other host (page links are forwarded); an administrator's session is refused on any other host. Unset, there is one host and nothing changes. `lib/adminHost.ts` is the single place that decides, used by `proxy.ts`, the sign-in routes, `withAuth`, `/auth/me`, `/auth/refresh` and `appUrl()`.
- Separation between hosts rests on the session cookies being host-only (no `Domain`), not on a claim inside the token.

## Alternatives Considered

- **A role check on the existing `/login` page that redirects admins:** the endpoint would still accept an administrator's password from the public form, which is the thing to avoid.
- **An `aud` claim in the access token, checked everywhere:** every admin route would need to read it, and the host-only cookie already keeps the two sessions apart. Rejected as more code for no extra isolation.
- **A cookie with `Domain=proplity.com` so one sign-in covers both hosts:** would send the administrator's session to every subdomain. Rejected.
- **Hard-coding `admin.proplity.com`:** impossible on `*.vercel.app` and on staging; an env var scoped per Vercel environment is the smallest thing that fits.

## Consequences

- An administrator who forgets the new page cannot sign in at `/login`; the page says nothing about why (deliberately). The admin page links to the public password reset.
- Setting `ADMIN_HOST` before the host exists in DNS and in the Vercel project locks every administrator out; the recovery is to remove the variable and redeploy. `DEPLOYMENT.md` §9 says to create the host first.
- Anything that used `/login` for an administrator (tests, the first-run wizard, the logout redirects) now uses `/admin/login`.
- Registration, password reset and the public APIs are still reachable on the admin host (they are harmless there: nobody but an administrator can hold a session on it). Tighten later if wanted.
- **Revisit if:** administrators need single sign-on, or a second privileged role needs its own host.

## Enforced by

`tests/unit/adminHost.test.ts`, `tests/unit/proxy.test.ts`, `tests/unit/loginHostGate.test.ts`, `tests/unit/appUrl.test.ts` (the host rules); `tests/api/auth.test.ts` (the sign-in separation against the real server); `tests/e2e/flows/admin-login.spec.ts` (the pages).

## Binds

- `lib/adminHost.ts`, `lib/auth/loginFlow.ts`, `lib/api/withAuth.ts`, `lib/appUrl.ts`, `proxy.ts`
- `app/api/v1/auth/login/route.ts`, `app/api/v1/auth/admin/login/route.ts`, `app/api/v1/auth/me/route.ts`, `app/api/v1/auth/refresh/route.ts`
- `app/admin/login/`, `app/admin/(console)/`, `app/components/Auth/AdminLogin.tsx`
- `lib/auth/cookies.ts` (host-only cookies)
- `DEPLOYMENT.md` §9
