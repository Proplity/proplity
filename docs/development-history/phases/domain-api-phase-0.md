# Phase: Domain API Phase 0 — shared API infrastructure

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Every domain route planned in `out/domain-api-implementation-plan.md` (Properties, Maintenance, Leases, Financial, Access Codes, Communications) depends on the same four pieces of plumbing: an auth/RBAC guard, pagination parsing, Prisma error mapping, and Zod body validation. `lib/api/` didn't exist yet — this was the genuinely next unstarted layer per `CURRENT_STATE.md`'s own status table.

## What was built

Four files in `lib/api/`, exactly as scoped in the Phase 0 section of `out/domain-api-implementation-plan.md`, reusing the existing `getServerSession()` (`lib/auth/session.ts`) rather than reinventing session handling:

- **`lib/api/withAuth.ts`** — wraps a route handler, 401s if no session, 403s if `opts.roles` is given and the session's role isn't in it, otherwise calls the handler with `{ session: { sub, role } }`.
- **`lib/api/pagination.ts`** — `parsePagination(searchParams)` → `{ skip, take, page, limit }` (page/limit from query params, limit capped at 100); `buildMeta(total, page, limit)` → `{ total, page, limit, hasMore }`.
- **`lib/api/errors.ts`** — `handleApiError(err)` maps Prisma's `P2002`/`P2025`/`P2003` to 409/404/400, falls back to a logged 500.
- **`lib/api/validate.ts`** — `validateBody(req, zodSchema)` centralizes the parse-and-400 pattern already used ad hoc in `register/route.ts`.

## A real type mismatch found and fixed

The plan's `withAuth.ts` snippet assumed `getServerSession()` returns a session whose `role` is already the Prisma `Role` enum. It isn't — `lib/auth/jwt.ts`'s `JWTPayload` interface types `role` as a plain `string` (`jose` can't verify a JWT claim against an application enum at the type level). `tsc` caught this immediately (`Type 'string' is not assignable to type 'Role'`). Fixed by narrowing with a cast in `withAuth.ts`, with a comment explaining why it's safe: every token is signed via `signAccessToken({ role: user.role })` where `user.role` is a real Prisma `Role`, so the string only ever holds a valid enum value at runtime — the JWT layer just doesn't (can't) express that in its own types.

## Verification performed

Live end-to-end test against a temporary scaffold route (`app/api/v1/scaffold-test/route.ts`, deleted after verification) wired through `withAuth(handler, { roles: ['ADMIN'] })` and calling `parsePagination`/`buildMeta`:

- Unauthenticated request → `401`
- Authenticated as `manager@proplity.com` (wrong role for an `ADMIN`-only route) → `403`
- Authenticated as `admin@proplity.com`, `?page=2&limit=10` → `200` with `{"ok":true,"meta":{"total":42,"page":2,"limit":10,"hasMore":true}}` — confirms `parsePagination` reads query params correctly and `buildMeta`'s `hasMore` math is right (`2*10=20 < 42`)

One real bug hit while building the scaffold itself, unrelated to the four library files: the first attempt put the test route at `app/api/v1/_scaffold-test/route.ts` and it 404'd unconditionally, including for the correctly-authenticated admin request. Root cause: Next.js App Router treats any path segment starting with `_` as a "private folder," excluded from routing entirely — nothing to do with auth. Renamed to `scaffold-test` (no underscore) and it worked immediately. Worth remembering for any future route work: never prefix an actual route segment with `_`.

`errors.ts` and `validate.ts` weren't exercised by the scaffold (would need a Prisma error / a POST body to trigger), but both are simple, already `tsc`-clean, and follow patterns already proven live elsewhere in the codebase (`handleApiError`'s `NextResponse.json` shape mirrors `withAuth`'s own responses; `validateBody`'s `safeParse`-then-400 pattern is the same one already running in production in `register/route.ts`) — real verification will happen naturally once Phase 1's first route uses them for a POST body and a Prisma constraint violation.

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 33 app routes still listed, scaffold route confirmed absent from the final route list.

## Next up

Phase 1 — Properties & Units API (`app/api/v1/properties/*`), the first real consumer of all four `lib/api/` utilities. Full route-by-route spec already written in `out/domain-api-implementation-plan.md`.
