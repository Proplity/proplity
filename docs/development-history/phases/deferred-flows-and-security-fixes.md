# Deferred flows built for real + whole-project security audit fixes

**Status:** Complete and verified. **Date:** 2026-08-24.

## Why

Direct continuation of the component-completeness audit (`out/phases/component-completeness-audit-and-fixes.md`, committed as `4edc850`). The user asked to build real backends for the 4 flows previously left as fake/local-only, confirmed via `AskUserQuestion`: subscription billing (build for real, with an env kill switch), rental applications (full review flow), manager-linking codes, and ad campaigns (persisted, honest zero stats). Mid-planning, the user separately asked for a whole-project scan (bugs, missing features, AI-claims-vs-reality) logged to a file — 4 background agents ran in parallel and surfaced a critical, live-exploitable security bug, which took priority over the new feature work.

## What was built

### Priority 0 — audit log + 7 real bugs fixed (commit `2dd10ce`)

`out/project-audit.md` — full scan findings (bugs, missing features, AI-claims-vs-reality), independent of this phase's code changes.

Seven real bugs fixed, each with a regression test:
1. **CRITICAL** — self-registration accepted any `role` string including `ADMIN` with no allow-list, letting an anonymous request mint a live admin session. Found independently by 2 of the 4 scan agents; confirmed by direct code read. Fixed: `register` now allow-lists `TENANT | LANDLORD | MANAGER | VENDOR` only.
2. `PATCH /invoices/[id]` had no ownership scoping — any MANAGER could mark a stranger's invoice `PAID` or change its amount. Fixed: now requires `canManageProperty()` on the invoice's actual property (or ADMIN).
3. `PATCH /properties/[id]` allowed unrestricted `managerId`/`landlordId` reassignment — a property-takeover vector. Fixed: reassignment is ADMIN-only, and the target id must reference a real user with the matching role.
4. `login` had zero input validation (malformed body → unhandled 500) and a bcrypt timing side-channel (registered vs. unregistered emails distinguishable by response time). Fixed: real zod schema + `validateBody`, and a fixed dummy-hash comparison when no user is found.
5. `change-password` had no minimum length on the new password. Fixed: `z.string().min(6)`, matching `register`'s own policy.
6. `refresh` hardcoded the rotated token to `+7 days` regardless of the original login's `rememberMe` choice (1/30 days), so every session normalized to 7 days on its first background refresh. Fixed: the rotated token now inherits the original token's `expiresAt` directly, and the cookie's `maxAge` is derived from the real remaining lifetime instead of the 7-day default.
7. `paymentReliabilityScorer.ts` read `invoice.payments[0]` with no `orderBy`, making "first payment" DB-order-dependent instead of chronological. Fixed: `orderBy: { paidAt: 'asc' }`.

Not fixed this pass (logged as a follow-up in `out/project-audit.md`): repo-wide CSRF coverage beyond the 6 auth routes — assessed as not currently exploitable (mitigated by `SameSite=Lax`), and touching every mutating domain route is a larger, separate change.

### Priority 1 — real subscription billing + env kill switch (commit `ac73f93`)

Reused the existing, tested Paystack `initialize`/`webhook` infrastructure rather than rebuilding it — `Subscription` and `InvoiceType.SUBSCRIPTION` already existed in the schema, no migration needed for this part.

- `POST /api/v1/subscriptions/checkout` (MANAGER/LANDLORD) — FREE tier activates a `Subscription` row directly, no payment; PRO tier creates a real `SUBSCRIPTION` invoice with server-computed pricing (never client-sent) and returns its id for the existing `/payments/initialize` to carry the actual charge, unchanged.
- `payments/webhook` extended: a paid `SUBSCRIPTION` invoice now upserts the payer's `Subscription` (tier/cycle read back from the invoice description, since neither has a dedicated column).
- `GET /api/v1/subscriptions/me`.
- `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED` (default `false`) — the checkout route 503s server-side regardless of the client, and `PricingPage`/`/checkout`/`register`'s post-signup redirect all present "Coming Soon" or skip the paid flow entirely while off.
- `Checkout.tsx`'s fake `setTimeout` success replaced with a real checkout-then-redirect-to-Paystack flow.

### Priorities 2–4 — rental applications, manager-linking codes, ad campaigns (this commit)

One migration (`20260824105858_add_applications_manager_codes_ad_campaigns`) added 3 new models:
- **`Application`** (`lease.prisma`) — scoped to `Unit`, JSON `details` blob (same precedent as `NeighbourhoodReport`/`ConditionReport`), `PENDING → APPROVED/REJECTED`. `POST/GET /api/v1/applications`, `PATCH /api/v1/applications/[id]`. Wired `PropertyApplicationForm.tsx` to the real endpoint (file fields recorded as filenames only, no upload backend, same documented gap as `MaintenanceRequestForm`); fixed the apply page's real `useProperty` lookup to also resolve a target `unitId` (vacant unit preferred). Added a manager-facing "Rental Applications" section with Approve/Reject to `PropertyDetail.tsx`.
- **`ManagerInviteCode`** (`auth.prisma`) — landlord-generated `LLD-XXXX-XX` codes, distinct from the unit-scoped `AccessCode` model. `POST/GET /api/v1/manager-codes`, `PATCH /api/v1/manager-codes/[id]` (toggle), `POST /api/v1/manager-codes/redeem` (MANAGER-only). Redeeming only records the relationship — it doesn't auto-assign properties, that stays the existing separate `Property.managerId` action. Wired `LandlordDashboard.tsx`'s existing generate/toggle/copy UI to the real API; added a "Link to a Landlord" redeem widget to `Dashboard.tsx` (the MANAGER role's own dashboard).
- **`AdCampaign`** (`property.prisma`) — `impressions`/`clicks` stay genuinely `0` forever, honestly, since no ad-serving/tracking system exists anywhere to increment them. `POST/GET /api/v1/properties/[id]/ads`, `PATCH /api/v1/properties/[id]/ads/[adId]` (soft-cancel, same archive-over-delete convention as `AccessCode` revocation). Wired `PropertyDiscovery.tsx`'s Create/Cancel Ad modals to the real API — the badge/button per card now uses a small `AdStatusAndButton` sub-component calling `useAdCampaign(property.id)` directly (no bulk-ads endpoint needed), refetched via a remount key after the shared modal completes an action.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors, checked after every meaningful edit throughout.
- `pnpm test` — full suite, 9 files, 151/151 passing (141 carried over from Priority 0/1 + 10 new: 4 applications, 4 manager-codes, 2 ad-campaigns).
- `pnpm build` — production build succeeds; all new routes (`/api/v1/applications*`, `/api/v1/manager-codes*`, `/api/v1/properties/[id]/ads*`, `/api/v1/subscriptions*`) appear correctly in the route manifest.
- `pnpm exec prisma migrate dev` applied cleanly against the real dev DB (`proplity_db`), re-verified seeded row counts elsewhere were untouched, same standing check as every prior schema-touching phase.

## What's next

The remaining items from `out/project-audit.md`, roughly by leverage: the property moderation/approval action (`moderationStatus` is never set to `APPROVED` anywhere — the single highest-impact fix left, since it currently blocks every real listing from ever going publicly visible); late-fee/grace-period enforcement in `overdueFlagger.ts` (the data already exists, just isn't read); repo-wide CSRF coverage; the orphaned `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` models; and any real AI/LLM integration, which needs a product decision on provider/scope before any code.
