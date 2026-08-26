# Phase: Pages separation — real Next.js routes

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

The entire app previously lived behind one route (`/`), rendered by `app/App.tsx` — a 759-line client component with ~10 `useState` flags (`showLanding`, `authScreen`, `currentPage: Page` — a 23-variant union — `isAuthenticated`, `currentRole`, etc.) doing manual view-switching. A hard refresh on any screen always dropped back to the landing page, since nothing was URL-addressable — this was also the direct cause of `CLAUDE.md`'s "`/login` route doesn't exist" known bug. User chose full-app, all-roles scope: every view becomes a real route.

## What changed

**33 routes now exist** (confirmed in the `pnpm build` output), replacing the single `/` route:

- **Public/marketing:** `/`, `/pricing`, `/contact`, `/about`, `/for-landlords`, `/for-tenants`, `/for-vendors`, `/properties/[id]`
- **Auth:** `/login`, `/register`, `/forgot-password`, `/checkout`
- **Authenticated (manager/landlord/tenant/vendor) under `/dashboard`:** 18 routes covering the dashboard index, discover, tenants (+ add, + `[id]`), maintenance (+ `[id]`), a maintenance-request form, tenant-maintenance, properties (new, `[id]`, `[id]/apply`, `[id]/schedule-viewing`), messages, payment-history, neighbourhood-report, vendor jobs (`[id]`, `[id]/invoice`), and breakdown `[type]`
- **Admin, its own top-level `/admin`:** index, `/admin/reports`, `/admin/breakdown/[type]`

**New shared files:**
- `app/dashboard/layout.tsx` + `app/dashboard/DashboardChrome.tsx` — server layout does `getServerSession()` + redirect-if-missing (defense in depth alongside the edge `proxy.ts` guard); client chrome holds the header/sidebar/AI-assistant shell ported from `App.tsx`'s old JSX, now driven by `auth.user.role` instead of a client-side `currentRole` state
- `app/admin/layout.tsx` + `app/admin/AdminChrome.tsx` — same pattern, plus a `role !== 'ADMIN'` check redirecting to `/dashboard`
- `app/dashboard/navigateToPage.ts` — one shared function mapping the old 23-variant `Page` union to real routes, reused as the `onNavigate` handler across every dashboard/board component so their internals never had to change
- `app/HomeLanding.tsx` — thin client wrapper giving `LandingPage` real router-based nav callbacks

**Leaf components in `app/components/` were not touched** — same principle as the plan: every "detail/flow" component already took clean `onBack`/`onNavigate`/entity-id props, so only the wiring moved (into ~30 new thin `page.tsx` files), never the component internals. The two components that received denormalized fields from the caller's old in-memory `Page` object (`PropertyApplicationForm`'s `propertyTitle`/`propertyPrice`, `ScheduleViewing`'s `propertyTitle`/`propertyAddress`) still didn't need any internal changes either — their new `page.tsx` wrappers just look the property up from `mockProperties` by the `[id]` route param instead.

**Folded-in leftover fixes** (approved in an earlier plan, never executed): `lib/db.ts` now throws if `DATABASE_URL` is unset in production (mirrors `lib/auth/jwt.ts`'s existing pattern); `RoleSwitcher` is gated behind `process.env.NODE_ENV !== 'production'` in both new chrome components.

**Other:** `PLANS` exported from `PricingPage.tsx` (was module-private) so `/register` and `/checkout` can resolve plan details by a stable id (`plan.id`, e.g. `'professional'`) carried through the URL as `?plan=`, instead of a plan object bouncing through client state across the register → checkout flow. `App.tsx` deleted — nothing references it anymore.

## Real issues hit and fixed along the way

1. **Missing `'use client'` on two "props-less" wrappers.** `app/dashboard/payment-history/page.tsx` and `app/admin/reports/page.tsx` render `TenantPaymentHistory`/`AdminReports` with no props, so they were written as plain server components — but those leaf components use `useState`/`useEffect` internally and had always implicitly relied on being nested under `App.tsx`'s top-level `'use client'` boundary. Next 16 correctly rejected this (`Server Component ... depends on useState`). Fixed by adding `'use client'` to both wrapper files.
2. **`useSearchParams()` needs a `Suspense` boundary.** Both `/register` and `/checkout` read a `?plan=` query param via `useSearchParams()`, which Next requires wrapping in `<Suspense>` for static generation (`missing-suspense-with-csr-bailout`). Fixed by splitting each into an outer `Page` (renders `<Suspense><...Content /></Suspense>`) and an inner `*Content` component holding the actual `useSearchParams()` call.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 33 routes listed, `ƒ Proxy (Middleware)` present.
- Live smoke test via `pnpm dev` + `curl`:
  - `GET /` unauthenticated → `200`
  - `GET /dashboard` unauthenticated → `307` redirect to `/?from=%2Fdashboard` (the previously-dead `proxy.ts` edge guard, now live for the first time, firing correctly)
  - `GET /admin` unauthenticated → `307` redirect to `/?from=%2Fadmin`
  - Logged in as `manager@proplity.com` via `POST /api/v1/auth/login`, then with that session cookie: `GET /dashboard` → `200`, requested **again** (simulating a hard refresh) → still `200` — this is the actual bug the migration fixes
  - `GET /dashboard/properties/1` (a deep link straight to a detail page) with the manager session → `200` — confirms deep-linking works, not just the dashboard root
  - `GET /admin` with the manager (non-admin) session → `307` redirect to `/dashboard` — role gate confirmed
  - Logged in as `admin@proplity.com`: `GET /admin` → `200`, `GET /admin/reports` → `200`

Not done: interactive browser click-through of every role's full UI (no browser tool available in this session) — the HTTP-level checks above cover routing/auth correctness but not visual rendering. Worth a manual pass in a real browser.

## Not done in this phase

- The pricing-plan content shown on `/checkout` is resolved from `PricingPage.tsx`'s canonical `PLANS` regardless of whether the user arrived via `/pricing` or the landing page's own separately-defined (and differently priced) inline plan cards — a pre-existing content inconsistency between `LandingPage.tsx` and `PricingPage.tsx` that predates this migration and wasn't in scope to reconcile.
- No changes to `app/store/*` mock data or any real backend wiring — this was a routing-only migration.
