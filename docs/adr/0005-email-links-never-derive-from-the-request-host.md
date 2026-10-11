# 0005 — Email links never derive their origin from the request host in production

Status: Proposed
Decided by: Abdullah Jamiu (pending acceptance) · Date: 2026-10-11
Recorded: 2026-10-11
<!-- Refines ADR-0001 (which names NEXT_PUBLIC_APP_URL the canonical origin); does not supersede it. -->

## Context

ADR-0001 makes `NEXT_PUBLIC_APP_URL` the canonical origin for human-facing links. The first implementation of `appUrl(path, req)` then let `req.nextUrl.origin` win over it, so dev/preview links matched the active host. But the `Host` header is client-controlled: anyone can POST `/api/v1/auth/forgot-password` for a victim's address with a forged `Host` (and a matching `Origin`, which is all the CSRF check compares) and the victim receives a genuine reset email whose link points at the attacker's domain (password-reset poisoning). The same code also preferred the per-deployment `VERCEL_URL` over the stable production domain.

## Decision

`lib/appUrl.ts` resolves the origin in this order and only the first step ever reads the request:

1. `NODE_ENV !== 'production'` (dev, tests): the request origin.
2. `NEXT_PUBLIC_APP_URL`, when it is not a localhost URL.
3. Platform-injected URLs: `VERCEL_PROJECT_PRODUCTION_URL` on production deployments, `VERCEL_URL` on previews.
4. `NEXT_PUBLIC_APP_URL` as given, then `http://localhost:3000`.

## Alternatives Considered

- **Always trust the request origin:** rejected, it is the vulnerability above.
- **Never read the request, even in dev:** rejected. Developers run on arbitrary ports and the dev email widget would show dead links.
- **Allow-list of hosts:** rejected as more config for no gain over a single configured origin.

## Consequences

- Production and staging must set `NEXT_PUBLIC_APP_URL` (or rely on the Vercel production URL).
- Preview deployments link to their own `VERCEL_URL`, not to the request.
- **Revisit if:** the app is served from several customer-specific domains that must each produce their own links.

## Enforced by

Review only for the production branch ordering. `tests/api/` runs with `NODE_ENV` ≠ production so does not exercise it.

## Binds

- `lib/appUrl.ts`
- `app/api/v1/auth/{register,resend-verification,forgot-password}/route.ts`
- `app/api/v1/manager-codes/route.ts`, `app/api/v1/leases/route.ts`
