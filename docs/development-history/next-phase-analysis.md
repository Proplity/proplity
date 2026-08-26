# Post-roadmap analysis: what's next after Phase 8

**Date:** 2026-08-22. All 8 phases of `out/domain-api-implementation-plan.md` are complete, committed, and live-tested (Phase 0-pre through Phase 8 — 34 API routes, 35 page routes, 5 background workers). This document is a fresh scan of the project's actual current state and a prioritized proposal for what comes next.

---

## Finding 1 (do first): the project's own root docs now describe a project that no longer exists

`CLAUDE.md`, `CURRENT_STATE.md`, and `PROJECT_STRUCTURE.md` were all last substantively written *before* Phase 0 started, and none were updated as the 8 phases landed. Concretely, right now:

- **`CLAUDE.md`**'s own "Current state" table says `Domain APIs (/api/v1/properties, /leases, etc.) | Not started — Phase 0 next` and `Email/transactional, background workers, Paystack | Not started`. Both are false — all 6 domain-API phases are built, Phase 8 shipped 5 background workers, Phase 4 shipped Paystack checkout/webhook/autopay, and Phase 7 shipped a working (console-transport) email flow.
- **`CLAUDE.md`**'s "Known bugs — fix before Phase 1" section (session-dies-on-reload, `/login` 404, hardcoded `JWT_SECRET`, hardcoded DB string, `RoleSwitcher` self-reassignment) — all 5 were confirmed fixed during the pages-separation phase, months of work ago in this project's timeline. The section is dead weight now, actively misleading.
- **`CURRENT_STATE.md`** says `Status: Phase 1 & 2 Completed | Phase 3 Pending`, `Domain REST APIs: 0% (Next)`, `Integrations & Workers: 0% (Planned)`. All wrong.
- **`PROJECT_STRUCTURE.md`** still documents `app/App.tsx` as "Main client-side router" — that file was **deleted** during pages-separation. It also says "Next.js 14 (App Router)" — the project has been on 16.3.2 since early in this engagement. Its file tree has no mention of any of the 34 API routes or 35 page routes that exist today.

This matters more than ordinary staleness because `CLAUDE.md` is loaded into **every** session with the instruction "these instructions OVERRIDE any default behavior and you MUST follow them exactly as written." A future session — or a teammate — reading it today would be told to build Phase 0, when Phase 8 is done. This is the single highest-value, lowest-risk fix available: no design decisions, no new code, just making the map match the territory.

**Proposed scope**: rewrite the "Current state" table, delete the resolved "Known bugs" section (or move it to a changelog-style note), and add the 6 domain-API + background-worker phases to `CLAUDE.md`'s schema/architecture sections where relevant (e.g., the new non-negotiable-adjacent facts Phase 4/8 discovered, like the schema-drift incident and the catch-up-one-cycle-per-run behavior). Regenerate `CURRENT_STATE.md` and `PROJECT_STRUCTURE.md` from the real current file tree and route list, matching their existing tone/format rather than starting from scratch.

---

## Finding 2 (the big one): the frontend still barely reads from real data

Phase 7 wired exactly 5 **write** paths (the forms the original plan named). Everything else — every dashboard, every list view, every detail page — still reads from `app/store/*` mock arrays. A grep across `app/components/` shows **24 of 37** top-level components still importing mock data directly for display:

`AdminBreakdownPage`, `AdminDashboard`, `AdminReports`, `AIAssistant`, `Dashboard`, `LandlordDashboard`, `LandlordFeaturePage`, `MaintenanceBoard`, `MaintenanceDetail`, `MessagingPortal`, `NeighbourhoodReport`, `PropertyDetail`, `PropertyDiscovery`, `PublicPropertyDetail`, `ScheduleViewing` (partially wired — the write is real, the available-dates display isn't), `ServiceProviderFeaturePage`, `TenantDashboard`, `TenantDetail`, `TenantFeaturePage`, `TenantMaintenanceRequests`, `TenantManagement`, `TenantPaymentHistory`, `VendorCreateInvoice` (same partial case), `VendorDashboard`, `VendorJobDetail`.

Every one of these has a real backing `GET` route already built and tested (Phases 1–6). This is the natural, large next phase — and it's genuinely large enough to warrant its own sub-plan, likely split by role (Tenant views → Manager/Landlord views → Vendor views → Admin views) rather than attempted in one pass, given the file count.

**Not proposing to start this without confirmation** — it's the single biggest remaining body of work in the project, touches ~2/3 of all UI components, and (like Phase 7) will surface real data-shape mismatches (numeric mock ids vs. UUID strings, denormalized mock fields vs. relational real data) that need per-component judgment calls, not a mechanical find-replace.

---

## Finding 3: zero automated test coverage

Every verification across all 8 phases was manual (`curl` against the live dev server, checked against real DB state, then cleaned up). That's been genuinely rigorous, but none of it persists — there's no regression protection. Confirmed via `package.json`: only `next lint`/`prettier` exist as scripts; no Jest, Vitest, Playwright, or Cypress dependency anywhere; no `.github/workflows` or any CI config.

This isn't urgent in isolation, but it compounds with Finding 2: a frontend-hydration phase touching ~24 components with no test harness means every regression has to be caught by hand again, the same way Phase 7 was. Worth considering **before** a large Phase 9, not after — even a thin route-level test suite (hitting the 34 API routes with real RBAC/business-rule assertions, turning this conversation's manual `curl` scripts into something that survives) would pay for itself immediately.

---

## Finding 4: loose ends explicitly flagged during Phases 4, 7, and 8, still open

None of these are new discoveries — each was already called out in its phase doc as intentionally deferred, listed here just so they're in one place:

| Item | Phase flagged | Status |
|---|---|---|
| Real Paystack test-mode key | Phase 4 | `/payments/initialize`'s actual external API call has never run against a live account — everything else (webhook, autopay, auth boundaries) is fully tested |
| Real email provider | Phase 7 | Console-transport `lib/email.ts` works and is tested end-to-end, but nothing is actually delivered; swapping in Resend/Postmark/SES is a one-function change now that the interface exists |
| Self-registration email verification | CLAUDE.md (pre-existing) | `register` still sets `status: ACTIVE` directly, no `VerificationToken` — unrelated to Phase 7's tenant-*invite* flow, which is a different code path |
| Cron scheduling | Phase 8 | Workers exist and are tested; nothing actually calls them on a schedule — needs a deployment-target decision (Vercel Cron vs. crontab vs. CI) that hasn't been made |
| `Unit.status` not updated on lease creation | Phase 3 | A newly-tenanted unit stays `VACANT` in the data model — flagged, not built, since the exact state-transition rules were never defined |
| `AccessCode` never auto-transitions to `USED` | Phase 5 | No schema flag distinguishes single-use guest codes from reusable permanent ones; building either default risks breaking the other use case |
| OAuth, Redis blocklist, real-time messaging, `Subscription` model | CLAUDE.md "Deliberately deferred" | Unchanged, still explicitly out of scope |

None of these block anything — they're listed for completeness, in case one of them turns out to matter more than Findings 1–3 for what's actually being aimed at next.

---

## Recommendation

1. **Do Finding 1 immediately** (doc sync) — it's fast, safe, and every future session benefits from it. Can be done in the same sitting as this analysis if you'd like.
2. **Then decide between Finding 2 (frontend hydration) and Finding 3 (test suite) as the next real phase** — they're not mutually exclusive, but doing a thin version of Finding 3 first would make Finding 2 safer to execute, at the cost of delaying the more visible frontend work.
3. Finding 4's items are pick-up-when-relevant, not a phase of their own — e.g., "real Paystack key" only matters once there's an actual test account to test against.

Not starting any implementation yet — this document is the analysis you asked for. Let me know which of these (or what else) you want to prioritize.
