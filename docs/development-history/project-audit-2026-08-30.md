# Project audit — 2026-08-30

Findings from a four-agent scan (security, API routes, public pages, dashboard views) run in a prior session, **recorded here with a verification verdict added per item**. Numbering is the original outline's, so `deployment-vercel-cicd-and-audit-fixes.md` can reference it.

## How to read the verdicts

| Verdict | Meaning |
|---|---|
| **Verified** | Independently confirmed by reading the code during this pass |
| **Verified — worse** | Confirmed, and the real defect is larger than the outline stated |
| **Corrected** | The finding is substantially right but a stated detail was wrong |
| **Stale** | No longer true of the working tree |
| **Unverified** | Carried over as reported; not independently checked |

Anything not marked Verified/Corrected was **not** independently confirmed. The audit ran against an earlier tree, and at least one item had already been overtaken by other work — re-check before acting.

## Security

| # | Finding | Verdict | Status |
|---|---|---|---|
| 1 | `POST /access-codes/verify` has no property scoping — any MANAGER/ADMIN can verify and **consume** codes for units they don't manage, writing to that tenant's audit trail | **Corrected** — the outline cites a `min(4)` check on `code`; the schema was a bare `z.string()` with no length constraint. Also: this requires a valid staff session, so it is privilege escalation between staff, not an open door | **Fixed** |
| 2 | `GET /properties/[id]` has no `isPublished`/moderation filter and no auth check | **Verified — worse.** The handler was never wrapped in `withAuth` at all (bare `export async function GET`), so it was fully unauthenticated, and it also returned complete `units` data. Exploitable by an unauthenticated stranger, which is why it was fixed before #1 | **Fixed** |
| 3 | `manager-codes/redeem` has a TOCTOU race — `findUnique` then `update` | **Verified** | **Fixed** |

## Bugs

| # | Finding | Verdict | Status |
|---|---|---|---|
| 4 | Password reset is 100% fake — `ForgotPassword.tsx` only sets local state; no backend route exists | **Verified.** Only `change-password` exists, which requires an active session. `proplity_progress.md` listed `forgot-password`/`reset-password` under "Phase 4" and they were never reached | Open — blocked on email provider |
| 5 | Contact form discards every submission | **Verified.** No fetch in either contact component, no backend route | Open — needs destination decision |
| 6 | Verification/invite/moderation emails hardcode `http://localhost:3000` | **Verified.** 4 links across 3 files, and no base-URL env var existed anywhere | **Fixed** |
| 7 | Landing-page "Featured Properties" is hardcoded (ids 1–6); real ids are cuids, so every card 404s | **Verified.** `LandingPage.tsx` lines 682–742 | Open |
| 8 | Landing-page hero is fake — "Browse 6 available properties" is static; search box has no `onChange` | **Verified.** `LandingPage.tsx` line 246 | Open |
| 9 | Checkout's card form collects and discards real card details, then redirects to Paystack anyway | Unverified | Open |
| 10 | A unit can be double-booked — activation never checks for another ACTIVE lease | **Corrected.** Creation is *not* the problem: leases default to `PENDING`, and creating one on an occupied unit is legitimate (next year's lease is signed early). Only activation was unguarded. The code itself admitted it: *"nothing in the schema prevents more than one lease per unit"* | **Fixed** (see the READ COMMITTED caveat in the phase doc) |
| 11 | `TenantDetail.tsx` has no role gating — tenants see manager-only controls; several handlers lack `try/catch`, so the backend 403 becomes an unhandled rejection | Unverified | Open |
| 12 | Announcements/Equipment/BankAccounts cards swallow load errors as an empty state | Unverified | Open |
| 13 | Units-import accepts negative `bedrooms`/`bathrooms`; non-numeric `sqft` silently becomes `null` | Unverified | Open |

## Gaps

| # | Finding | Verdict |
|---|---|---|
| 14 | Tenants have no navigation path to Announcements | Unverified |
| 15 | `AdminBreakdownPage` missing the CSV/Excel export links the manager view has | Unverified |
| 16 | No in-app or push notifications — no model, no UI | Unverified |
| 17 | No resident directory / discussion board (PRD §5.3) | Unverified |
| 18 | `NeighbourhoodReport` has no create endpoint | Unverified |
| 19 | No duplicate-guard on property reviews | Unverified |

## Smaller / consistency

| # | Finding | Verdict |
|---|---|---|
| 20 | `bank-accounts` DELETE hard-deletes, against the archive-over-delete convention | Unverified |
| 21 | Pre-existing dead-UI stubs (Renew Lease, Send Notice, Download Report, admin settings buttons, `href="#"` footer links incl. "NDPR Compliance", demo video button) | Unverified |

## Deployment / production readiness

| # | Finding | Verdict | Status |
|---|---|---|---|
| 22 | No health-check endpoint | **Verified** | **Fixed** — `GET /api/v1/health` |
| 23 | No error tracking / observability (no Sentry or equivalent) | **Verified** — nothing found | Open |
| 24 | Rate limiting covers only 5 of 59 route files | **Corrected** — it covers **3** of 59: `login`, `register`, `refresh`. Note the limiter is DB-backed (`LoginAttempt`), so it does work correctly across serverless instances | Open |
| 25 | Background workers built-but-unscheduled, "no cron config exists anywhere" | **Stale** — `vercel.json` schedules `/api/v1/cron/all` daily | **Resolved** |
| 26 | Email still console-transport only | **Verified** | Open — links now correct, delivery still missing |
| 27 | Paystack keys read from env, but no evidence real test-mode credentials were ever configured | Unverified | Open |

## Test coverage

| # | Finding | Verdict |
|---|---|---|
| 28 | `properties/[id]/neighbourhood-report` and `properties/[id]/viewings` have zero coverage | Unverified |

## Follow-up notes

- **`getClientIp()` trusts `x-forwarded-for`**, which is client-suppliable behind a misconfigured proxy. On Vercel, prefer `x-vercel-forwarded-for` if this ever needs to be non-spoofable. Not in the original outline; noted during the deployment review.
- **No ESLint config exists anywhere in the repo**, and Next 16 removed `next lint`, so the `lint` script was broken. Replaced with `typecheck`. Adding ESLint is a separate, unscoped decision.
