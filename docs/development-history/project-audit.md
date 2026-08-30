# Project audit — bugs, security issues, missing features, AI-claims-vs-reality

**Date:** 2026-08-24. Produced by a 4-agent parallel scan of the whole codebase (API routes/workers, auth/security, AI-claims-vs-reality, PRD-vs-implementation) triggered by a direct user request, separate from the earlier component-level UI audit (see `docs/development-history/phases/component-completeness-audit-and-fixes.md`). Findings that duplicate something CLAUDE.md already documents as known/deliberate are excluded — this file is genuinely new findings only.

Status column: 🔧 = fixed in the same pass as this scan (see `docs/development-history/phases/deferred-flows-and-security-fixes.md`), 📋 = logged only, not fixed this pass.

---

## Security bugs

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **CRITICAL** | `POST /api/v1/auth/register` accepts any client-supplied `role` string, including `ADMIN`, with no allow-list. Combined with immediate `status: ACTIVE` + session-cookie login, an anonymous request can mint a live ADMIN session in one call. Found independently by 2 of the 4 scan agents. Verified directly by reading the route. | 🔧 |
| 2 | HIGH | `PATCH /api/v1/invoices/[id]` has no ownership/property-management scoping — `GET` on the same file correctly restricts via `canAccessInvoice()`, `PATCH` only checks `role: MANAGER`/`ADMIN`. Any MANAGER account can mark a stranger's invoice `PAID` without payment, or silently change its `amount`. Untested by `financial.test.ts`. | 🔧 |
| 3 | HIGH | `PATCH /api/v1/properties/[id]` allows unrestricted `managerId`/`landlordId` reassignment — no check that the new id belongs to a real MANAGER/LANDLORD, no re-authorization after reassignment. A property-takeover/griefing vector. `AuditLog` (per CLAUDE.md rule 12, meant for exactly "property transfers") is never written anywhere in the codebase. Untested by `properties.test.ts`. | 🔧 |
| 4 | MEDIUM | `POST /api/v1/auth/login` has zero input validation — no zod schema, no `validateBody`, unlike every other mutating route. A malformed body throws an unhandled 500 instead of a clean 400. | 🔧 |
| 5 | MEDIUM | `POST /api/v1/auth/login` timing side-channel — `bcrypt.compare` is short-circuited when the user doesn't exist, so response time distinguishes registered vs. unregistered emails. | 🔧 |
| 6 | MEDIUM | `POST /api/v1/auth/change-password` has no minimum length on `newPassword` (register enforces `min(6)`, this route enforces nothing) — a user can set a 1-character password. | 🔧 |
| 7 | LOW | `POST /api/v1/auth/refresh` hardcodes the rotated refresh token to a fresh `+7 days`, ignoring the original login's `rememberMe` choice (1 day / 30 days per `login/route.ts`). Since the client proactively refreshes every 13 minutes, essentially every session normalizes to exactly 7 days on its first refresh — a "don't remember me" session on a shared device outlives its 1-day promise; a "remember me" session is cut short from 30 days. | 🔧 |
| 8 | LOW (not currently exploitable) | `validateCSRF()` is applied only to the 6 `auth/*` mutating routes, not the other domain routes (leases, invoices, maintenance, access-codes, conversations, vendors, payments/autopay), contrary to CLAUDE.md's own stated `validateCSRF → rate limit → auth → validate → business logic` convention. Risk is mitigated today by `SameSite=Lax` on `access_token`. Recommended as a follow-up — fixing it means touching every mutating domain route, out of scope for this pass. | 📋 |

## Data-integrity bug

| # | Finding | Status |
|---|---|---|
| 9 | `lib/workers/paymentReliabilityScorer.ts` fetches `invoice.payments` with no `orderBy` and treats `payments[0]` as "the payment that determines on-time vs. late." For any invoice with more than one payment row, which one lands at index 0 is DB-order-dependent, not chronological — silently corrupting `Lease.paymentReliability`/`riskScore`. | 🔧 |

---

## Broken workflow (not just a missing feature)

**`Property.moderationStatus` is never set to `APPROVED` anywhere in the codebase — no moderation route exists at all.** Confirmed via repo-wide grep: every write to a new `Property` hardcodes `moderationStatus: PENDING_REVIEW`, and the only other references to the field are read-only display code. Consequences:
- The "AI Verified" badge and "AI Verified Only" filter (`PropertyDiscovery.tsx`, `PropertyDetail.tsx`, `PublicPropertyDetail.tsx`) are structurally dead — they can never render/filter true on real data, not just "not yet AI-powered."
- **More seriously: no property submitted through the real `ListProperty.tsx` form can ever become publicly visible.** `GET /properties` (the public browse endpoint) filters on `isPublished: true`, and nothing anywhere ever flips that either. `ListProperty.tsx` tells the submitting landlord/manager *"submitted for AI verification! You will be notified once approved"* — a promise the backend structurally cannot fulfill today.

This wasn't fixed in this pass (it's a standalone feature — needs a real moderation/approval action and a decision on who can approve: ADMIN-only, or MANAGER too) but is the single highest-value fix on this list if picked up next, since it blocks the platform's core "list a property → it becomes visible" loop.

---

## AI claims vs. reality

**`package.json` has zero AI/LLM SDK dependencies** (no `openai`, `@anthropic-ai/*`, `@ai-sdk/*`, `langchain`, embeddings/vector-search libs). No HTTP call to any LLM API exists anywhere in `lib/` or `app/api/`. There is no real AI/LLM integration anywhere in this codebase.

| UI claim | Where | Reality |
|---|---|---|
| "Proplity AI" chat assistant, "Powered by AI • Available 24/7" | `AIAssistant.tsx` | Zero backing — hardcoded string-lookup table (`app/store/aiAssistantData.ts`) with a fake `setTimeout` "thinking" delay. Already documented in CLAUDE.md as deliberately out of scope. |
| "AI-Powered Search" / "understands natural language" | `PropertyDiscovery.tsx` | Zero backing — the search input's value is captured but never read by any filter or API call. Pure decoration. |
| "AI Verified" badge / filter | `PropertyDiscovery.tsx`, `PropertyDetail.tsx`, `PublicPropertyDetail.tsx` | Structurally dead — see "Broken workflow" above. |
| "AI Verification Required" / "Our AI will validate media authenticity, detect duplicates..." | `ListProperty.tsx` | Zero backing — submitting just creates a `Property` (stuck at `PENDING_REVIEW` forever) and shows an `alert()`. No image analysis, no dedup, no CV. |
| "AI triage" implied by `MaintenanceRequest.categoryId` nullability (CLAUDE.md rule 7) | schema + `maintenance/requests/route.ts` | 100% manual — tenant picks a category from a dropdown. Nothing ever fills in a null `categoryId` automatically. |
| "AI payment predictions" / "late payment prediction" | `LandingPage.tsx`, `AboutPage.tsx` | **The one honestly-labeled exception.** `paymentReliabilityScorer.ts` has an explicit code comment: "a deliberate, simple, inspectable heuristic — NOT the 'AI late payment prediction' the PRD describes... should be swapped for a real model later, not mistaken for one now." Ratio-based bucketing, no ML — but the codebase itself is honest about this one. |
| "AI Fraud Detection" | `LandlordFeaturePage.tsx` | Zero backing — already documented in CLAUDE.md as an illustrative marketing page, out of scope. |
| "WhatsApp AI assistant" | `LandingPage.tsx`, `AIAssistant.tsx` | Zero backing, and self-labeled "coming soon" in the one place it appears in-app. |
| PRD §6.2 CV-based image authenticity / satellite cross-reference / registry cross-check | PRD only | Zero backing anywhere in the repo. |

---

## PRD requirements with no implementation, not previously tracked

- **`Violation`, `Announcement`, `ConditionReport` models are entirely orphaned** — schema exists, zero API routes, zero components reference them, despite each being named in the PRD (§5.3 violation tracking, §5.1/§5.3 community announcements, §6.2.6 structured condition reports).
- **`Equipment` model** — only referenced as an optional FK inside `maintenance/schedules/route.ts`; no CRUD endpoint, no warranty-tracking UI, despite PRD §5.1 "Equipment & warranty tracking."
- **`BankAccount` model** — completely unused; not referenced by any payments/autopay route or component, despite PRD §5.1 "multiple bank accounts per entity."
- **Grace periods and late fees are stored but never applied.** `Lease.gracePeriodDays` (schema default 7) is accepted at lease creation and never read again anywhere. `lib/workers/overdueFlagger.ts` flags overdue invoices purely by `dueDate < now`, ignoring the grace period entirely, and never creates a `LATE_FEE` invoice (that `InvoiceType` value has zero creation sites in the whole codebase). PRD §5.1 explicitly requires "auto late fees & penalties."
- **CSV/Excel import-export** — absent, PRD §5.1.
- **E-signature support** — absent beyond marketing copy; no signing flow, no signature field on `Lease`/`Notice`, PRD §5.1/§5.2.
- **PRD §6.2/§6.3 AI-heavy features** (listing fingerprinting/dedup beyond the placeholder `listingHash`/`mergedIntoId` fields, conversational NLP search, sentiment analysis, dispute detection, satisfaction scoring) — no implementation beyond schema placeholders.

---

## What's next

Priority order recommended, roughly by leverage:
1. **Property moderation/approval action** — smallest fix with the biggest functional impact (unblocks the entire "list → go live" loop, and makes the AI-Verified badge/filter meaningful instead of dead code).
2. **Late fees / grace period enforcement** in `overdueFlagger.ts` — the data (`gracePeriodDays`) is already there, this is "wire it up," not "design it."
3. Repo-wide CSRF coverage (finding #8 above).
4. `Violation`/`Announcement`/`ConditionReport`/`Equipment`/`BankAccount` — each is a real, PRD-named feature with zero code; scope and prioritize individually with the user rather than building speculatively.
5. Anything AI-shaped (search, verification, fraud detection) needs a product decision on whether/which real AI provider to integrate — currently 100% unbuilt, not a small follow-up.
