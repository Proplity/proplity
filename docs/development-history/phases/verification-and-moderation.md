# Self-registration email verification + real property moderation queue

**Status:** Complete and verified. **Date:** 2026-08-24.

## Why

Continuation of `out/project-audit.md`'s remaining findings. The user asked directly whether self-registration had email verification (it didn't, despite CLAUDE.md documenting the infrastructure as already built and reusable) and to keep working down the bug list, starting with the audit's top-recommended item: `Property.moderationStatus` never being set to `APPROVED` anywhere, which meant no property submitted through the real `ListProperty.tsx` form could ever become publicly visible.

## What was built (commits `8ed8f2c`, `f3292a3`)

**Email verification** — `register` now creates accounts as `PENDING_VERIFICATION` and sends a real verification email (via the existing console-transport `sendEmail()`), instead of auto-activating and logging the user in. No new infrastructure needed: `POST /verify-email` and `/verify-email` page were already built for the tenant-invite flow and explicitly designed to be reusable — only the page's password fields needed to become optional (a self-registered user already has one). `login` already 403s `PENDING_VERIFICATION` accounts with a clear message, so the gate was enforced with zero changes there.

**Found and fixed along the way**: the manager-registration step's "landlord invitation code" check was entirely fake — a hardcoded `VALID_LANDLORD_CODES` dictionary client-side, never touching the backend. Added `GET /manager-codes/check` (public, unauthenticated) for the real-time signup preview; `register` now re-validates and atomically links the code to the new account server-side. `?plan=` checkout continuity was rerouted from register→checkout to register→login, since a session no longer exists immediately after registering.

**Property moderation** — user chose "manual review queue, ADMIN only" over auto-approve or self-approve. Two independent pieces, matching the schema's own documented design (`moderationStatus` = admin review outcome, `isPublished` = the owner's own visibility toggle):
- `PATCH /properties/[id]/moderation` (ADMIN-only): approve/reject/flag. Rejecting an already-published listing unpublishes it in the same action. Emails the manager/landlord the outcome.
- `PATCH /properties/[id]` now accepts `isPublished`, gated on `moderationStatus === 'APPROVED'`.
- Admin-facing approve/reject buttons on the properties breakdown table; a "Listing Status" card (moderation badge, publish toggle) added to `PropertyDetail.tsx`.

**Found and fixed along the way**: `PublicPropertyDetail.tsx`'s hero-image "AI Verified" badge rendered unconditionally — not gated on `moderationStatus` at all, a real bug distinct from the one already-correct gated badge lower on the same page. "AI Verified" relabeled to "Verified" everywhere (ADMIN reviews it, not AI — the badge is real now, but the label shouldn't claim automation that doesn't exist). `PropertyDiscovery.tsx`'s filter buttons (Verified Only / High Trust Score / New Listings) were pure decoration — `selectedFilter` was captured but never applied to the list; now wired to real fields.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors, checked after every edit.
- `pnpm test` — full suite, 9 files, 157/157 passing (154 → 157: 3 new moderation/publish-gating tests; register's tests were also substantially rewritten for the new PENDING_VERIFICATION behavior and the MANAGER landlord-code requirement).
- `pnpm build` — production build succeeds, new routes (`/manager-codes/check`, `/properties/[id]/moderation`) present.

## What's next

Remaining from `out/project-audit.md`: late-fee/grace-period enforcement in `overdueFlagger.ts` (data already exists, just unread), repo-wide CSRF coverage, the orphaned `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` models, and any real AI/LLM integration (needs a provider/scope decision first).
