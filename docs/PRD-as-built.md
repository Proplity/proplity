# Product Requirements Document — As Built

## Proplity — what the platform does today

_Snapshot: 2026-10-04. Companion to [`PRD.md`](PRD.md), which remains the product **vision** (including the AI-native roadmap). This document describes only what is implemented and verified in the codebase, and is explicit about what is not. Where the two disagree, this one describes reality and `PRD.md` describes intent. For engineering detail see [`CURRENT_STATE.md`](../CURRENT_STATE.md) and [`CLAUDE.md`](../CLAUDE.md)._

**Status legend:** ✅ Built and working · 🟡 Partly built (what's missing is stated) · ❌ Not built

---

## 1. Product overview

Proplity is a web platform for managing rental property across five roles. Landlords list properties and units; managers run tenants, leases, maintenance and money; tenants find a place, apply, pay rent and report problems; vendors take and invoice maintenance jobs; admins moderate listings and operate the platform.

**What it is not (yet):** the "AI-native" platform described in the original PRD. There is no AI or machine-learning capability in the product. The pieces that deliver the PRD's _outcomes_ today do so with ordinary rules, manual review and human decisions (see §6).

### 1.1 Delivery state in one paragraph

All five role dashboards, every form, and the full REST API (73 routes) run on real data in PostgreSQL; there are no placeholder screens except three marketing feature pages and the AI assistant widget, which are illustrative. Real money flow works end to end against Paystack's webhook (and a mock gateway for testing), but the live Paystack charge call has not yet been run against a real account. Email, file upload and card payment each need a provider key to be live; without one the app says so rather than failing silently. Nothing is in production yet — the product is in staging/testing.

### 1.2 Roles

| Role         | Self-registers?                                      | Purpose                                                                            |
| ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Tenant**   | Yes                                                  | Browse, apply, pay rent, maintenance, messaging                                    |
| **Landlord** | Yes                                                  | Owns properties; portfolio view, manager invites, tenant and maintenance oversight |
| **Manager**  | Yes — needs a landlord's invite code                 | Day-to-day operations: tenants, leases, invoices, maintenance, vendors             |
| **Vendor**   | Yes                                                  | Receives assigned jobs, updates status, invoices                                   |
| **Admin**    | **Never** — created by the first-run `/setup` wizard | Property moderation, users, platform settings, audit log                           |

The PRD's "community associations & estate managers" segment has no dedicated role; a Manager covers it.

---

## 2. Authentication & account lifecycle ✅

- Email + password sign-up with **email verification** (account starts `PENDING_VERIFICATION`; login refused until verified; resend link available from the login page).
- Login, logout, "remember me" sessions (30 days; 1 day without), password reset, change password, profile edit.
- Short-lived access token (15 min) with silent refresh and rotating, reuse-detected refresh tokens; logout revokes the session server-side even from an idle tab.
- Brute-force protection on login, register, password reset, resend-verification, refresh and setup (atomic rate limiting); CSRF protection on mutating routes; edge route guard for `/dashboard` and `/admin`.
- Idle-session restore: reloading a dashboard URL after the access token expires returns the user to that page.
- **First-run setup wizard** (`/setup`): creates the first admin on a fresh database, optionally protected by a setup token, then permanently disables itself.
- ❌ Not built: OAuth/social login, multi-factor auth, instant (Redis-backed) session kill.

## 3. Landlord & property-manager features (PRD §5.1)

### 3.1 Property & unit management

| Requirement                                     | Status | As built                                                                                                                                                                                                                     |
| ----------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create/manage properties and units              |   ✅   | Listing form with **multiple units** per property (per-unit number, bedrooms, bathrooms, rent, service charge, size), partial-failure handling with "Retry Failed Units". Property detail, unit editing, My Properties list. |
| Assign tenants, owners, service providers       |   ✅   | Owner and manager fields on properties; tenants via leases; vendors per maintenance request. Managers join via landlord-issued invite codes.                                                                                 |
| Import / export (CSV, Excel)                    |   ✅   | Unit import from file on property detail; property export (CSV/XLSX) from the dashboard breakdown; landlord "Download Report" CSV.                                                                                           |
| Listing moderation                              |   ✅   | New listings start `PENDING_REVIEW`; **admin queue** (`/admin/properties`) approves/rejects/flags with notes and emails the owner. Only approved listings can be published; owners toggle publish.                           |
| Listing media                                   |   🟡   | Real upload of photos and a 360° video to Cloudinary when configured. Only three media slots persist (cover photo, 360° video, exterior photo) — extra room photos are not stored. No media authenticity checks (see §6).    |
| Property announcements, equipment, ad campaigns |   ✅   | Announcements and equipment records on property detail; ad campaigns shown in discovery.                                                                                                                                     |

### 3.2 Rent, leases & renewals

| Requirement                                  | Status | As built                                                                                                                                                                                                                           |
| -------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rent setup (terms, frequency, grace periods) |   ✅   | Lease with rent per billing cycle, payment frequency (annual by default), configurable grace period and late-fee (percentage or flat). New leases start `PENDING` and a manager **activates** them, which marks the unit occupied. |
| Tenant onboarding                            |   ✅   | Manager adds a tenant + lease; an invitation email lets a new tenant verify and set a password.                                                                                                                                    |
| Automated invoicing                          |   ✅   | Daily scheduled job issues the next rent invoice per active lease (one cycle per run) and a **separate service-charge invoice** when the lease carries one. Initial invoice created with the lease.                                |
| Auto late fees & penalties                   |   ✅   | Overdue invoices are flagged after the grace period, a reminder notice is created and a late fee is charged per the lease's configuration.                                                                                         |
| Rent renewal workflow                        |   ✅   | **Renew Lease** creates the successor lease and expires the old one.                                                                                                                                                               |
| Notices                                      |   🟡   | Managers can **send notices** (renewal offer, rent increase, default, expiration alert, payment reminder, termination) from a lease. Content is written by the manager — nothing is AI-generated. Overdue reminders are automatic. |
| E-signature for the rent agreement           |   ✅   | Tenant signs a lease awaiting signature from a card on their dashboard; signature recorded against the lease.                                                                                                                      |
| Manual invoices                              |   ✅   | **Send Invoice** from a lease for any invoice type (rent, service charge, utility, association fee, etc.); tenant sees it immediately.                                                                                             |

### 3.3 Payments

| Requirement                       | Status | As built                                                                                                                                                                                                                                                   |
| --------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online payments via Paystack      |   🟡   | Checkout initialisation, signed-webhook processing (invoice → paid, payment record, receipts/notifications) are built and tested. The **live Paystack API call has never been run** with a real key. A mock gateway reproduces the round trip for testing. |
| Real-time payment status          |   ✅   | Invoice/payment status updates on webhook; managers and landlords are notified; tenants see history.                                                                                                                                                       |
| Auto-pay for tenants              |   🟡   | Tenants can enable/cancel auto-pay once they've paid by card (the reusable authorization from that payment is used; no card entry in-app by design). **Nothing charges the mandate automatically yet.**                                                    |
| Multiple bank accounts per entity |   ✅   | Bank-account records manageable from account settings.                                                                                                                                                                                                     |
| Bank-transfer reconciliation      |   ❌   | Not built.                                                                                                                                                                                                                                                 |

### 3.4 Maintenance management

| Requirement                             | Status | As built                                                                                                                               |
| --------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant-submitted requests (text, image) |   ✅   | Request form with category, urgency, preferred time and photo upload (Cloudinary when configured). Video is not supported on requests. |
| AI triage (categorisation & urgency)    |   ❌   | Category and priority are chosen by the tenant/manager. No AI.                                                                         |
| Auto-assignment rules                   |   ❌   | Managers assign a vendor manually; the vendor is notified.                                                                             |
| Vendor portal                           |   ✅   | See §5.                                                                                                                                |
| Recurring maintenance scheduling        |   ✅   | Maintenance schedules generate requests automatically via the daily job.                                                               |
| Equipment & warranty tracking           |   ✅   | Equipment records per property.                                                                                                        |
| Maintenance request board               |   ✅   | Board view for managers, plus detail pages and status tracking for tenants.                                                            |
| Admin control of completion behaviour   |   ✅   | Platform setting: a vendor invoice may automatically complete its job.                                                                 |

### 3.5 Communication

| Requirement                                              | Status | As built                                                                                                                                                                              |
| -------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified messaging (tenant ↔ landlord ↔ manager ↔ vendor) |   ✅   | Direct conversations between any permitted pair. Updates by **polling every 5 seconds**, not real-time sockets. Landlord "Schedule Review" opens a thread with the property manager.  |
| Automated notifications — in-app                         |   ✅   | Bell, popup preview, sound, full notifications page, for all roles; events include maintenance updates, payments, announcements and assignments.                                      |
| Automated notifications — email                          |   ✅   | Verification, password reset, invites, viewing confirmations, moderation outcomes. Real delivery needs a Resend key; otherwise logged (tester-facing "Sent Emails" widget available). |
| Push notifications                                       |   ❌   | Not built.                                                                                                                                                                            |
| WhatsApp AI tenant assistant                             |   ❌   | Not built. The AI assistant widget in the dashboard is an illustrative mock, not connected to any model.                                                                              |

## 4. Tenant features (PRD §5.2)

| Requirement                      | Status | As built                                                                                                                                                                 |
| -------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secure tenant portal             |   ✅   | Mobile-responsive dashboard with a bottom tab bar on phones.                                                                                                             |
| Find & view properties           |   ✅   | Public property pages and in-dashboard discovery (filters: verified, trust, newest); schedule a viewing with email confirmation; featured listings on the homepage.      |
| **Tenant profile**               |   ✅   | One-time "Complete Your Profile" gate before applying: phone, year of birth, emergency contact, ID document upload; previous landlord optional.                          |
| **Rental application**           |   ✅   | 3 steps — profile (read-only), employment, review and submit. Managers review applications on property detail.                                                           |
| My Rentals                       |   ✅   | Current and past leases, each linking to its property.                                                                                                                   |
| Rent payment & receipts          |   ✅   | Pay an invoice by card; payment history; combined rent + service-charge display.                                                                                         |
| Auto-pay setup                   |   🟡   | See §3.3 — authorisation recorded, no automatic charging.                                                                                                                |
| Maintenance reporting & tracking |   ✅   | Submit, track status, rate the vendor on completion.                                                                                                                     |
| Digital agreements & notices     |   ✅   | E-sign a lease; notices sent by management are visible to the tenant.                                                                                                    |
| Access-code management           |   ✅   | Time-bound gate/garage/amenity codes with **single-use by default**, soft revoke, verification endpoint and an access log. Codes expire automatically.                   |
| Messaging with management        |   ✅   | See §3.5.                                                                                                                                                                |
| Rent balance visibility          |   ✅   | Dashboard shows current lease, next rent due and outstanding amounts.                                                                                                    |
| Neighbourhood report             |   🟡   | Displayed for a property (security, power, water, roads, flooding, amenities, demographics). Content is stored data; **no external data integrations or maps** (see §6). |

## 5. Service-provider (vendor) features (PRD §5.4)

| Requirement                 | Status | As built                                                                         |
| --------------------------- | :----: | -------------------------------------------------------------------------------- |
| Business profile            |   ✅   | Vendor profile record and listing.                                               |
| Job intake & dispatch       |   ✅   | Assigned jobs list and detail, notification on assignment.                       |
| AI-structured work tickets  |   ❌   | Tickets are the tenant's own fields; no AI structuring.                          |
| Messaging with stakeholders |   ✅   | See §3.5.                                                                        |
| Job status tracking         |   ✅   | In progress → completed from the job page.                                       |
| Invoice generation          |   ✅   | Itemised invoice for a completed job.                                            |
| Online payments to vendors  |   ❌   | Vendors invoice, but there is no payout/payment flow to the vendor.              |
| Work history & reputation   |   ✅   | Ratings from tenants; reputation computed on demand from ratings (never cached). |

## 6. Community, estate, AI and discovery (PRD §5.3, §6)

| PRD item                                          | Status | As built / gap                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community announcements                           |   ✅   | Per-property announcements.                                                                                                                                                                                                                                                                                                         |
| Violation tracking                                |   ✅   | Violations recorded per unit (visible on the tenant's page).                                                                                                                                                                                                                                                                        |
| Access control with time-bound codes, audit trail |   ✅   | See §4; every verification is logged.                                                                                                                                                                                                                                                                                               |
| Association fee collection                        |   🟡   | An association-fee invoice type exists and can be sent manually; no scheduled or bulk collection.                                                                                                                                                                                                                                   |
| Resident directories, discussion boards           |   ❌   | Not built.                                                                                                                                                                                                                                                                                                                          |
| Maintenance approval workflows                    |   ❌   | Not built.                                                                                                                                                                                                                                                                                                                          |
| **AI tenant assistant (WhatsApp-first)**          |   ❌   | Mock widget only.                                                                                                                                                                                                                                                                                                                   |
| **Smart rent intelligence**                       |   🟡   | A daily job writes a payment-reliability / risk score on each lease from on-time vs late vs missed payments. It is a simple documented heuristic, **not machine learning**, and there is no prediction, reminder-timing or tone optimisation. Reminders and escalation are fixed rules (overdue flag → reminder notice → late fee). |
| **Lease & document intelligence**                 |   ❌   | No AI-drafted notices, clause checks or risk flags. Expiration/renewal notices are written by people.                                                                                                                                                                                                                               |
| 6.2.1 AI-verified listing media                   |   🟡   | The goal (no fake listings) is served by **mandatory manual admin moderation** before anything goes live, and a verified badge that reflects that review. No automated media validation, stock/AI-image detection or media-required blocking. `trustScore` exists on a property but is not computed.                                |
| 6.2.2 Neighbourhood intelligence                  |   🟡   | Per-property report is displayed; data is entered/seeded, with no satellite, flood-map, power-grid or community-reporting integrations and no map overlays.                                                                                                                                                                         |
| 6.2.3 Payment-linked availability                 |   🟡   | Unit status moves to **occupied** when a lease is activated and back to vacant when it ends. Listings are **not** automatically deactivated on lease + payment, and there are no stale-listing penalties.                                                                                                                           |
| 6.2.4 Fingerprinting & de-duplication             |   ❌   | Schema fields exist (`listingHash`, `mergedInto`); no detection logic. Duplicates are caught only by an admin during review.                                                                                                                                                                                                        |
| 6.2.5 Conversational AI search                    |   ❌   | Discovery uses filters, not natural language.                                                                                                                                                                                                                                                                                       |
| 6.2.6 Structured condition reports                |   🟡   | Condition-report records per unit and structured water/electrical fields on a property exist; there is no AI validation of claims against evidence.                                                                                                                                                                                 |
| 6.3 Estate & community AI                         |   ❌   | Not built.                                                                                                                                                                                                                                                                                                                          |

## 7. Administration (not itemised in the original PRD)

- **Overview dashboard** with platform totals and tiles that navigate to User Management, Security and Settings (the Database tile explains there is no in-app database console).
- **Properties**: moderation queue with filters, search and per-listing review.
- **User management**: all accounts across roles.
- **Reports and breakdown pages** (platform-wide drill-downs).
- **Security**: audit-log viewer (currently only the setup wizard writes entries, so the log is nearly empty).
- **Platform settings**: toggles for platform-wide behaviour.
- **Subscriptions** (not in the PRD): plan/checkout code exists but is **off by default**; it shows "Coming Soon".

## 8. Onboarding workflow (PRD Appendix)

| Item                                                      | Status | As built                                                                                                                                  |
| --------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Name, phone number                                        |   ✅   | Collected at sign-up / tenant profile.                                                                                                    |
| ID verification via API                                   |   ❌   | The ID document is uploaded and stored with the profile; no verification provider is integrated (a KYC record type exists but is unused). |
| Free-text bio, reason for moving, occupants, move-in date |   ❌   | Not collected; the application asks for employment details instead (lease terms are set by the manager, not the applicant).               |

## 9. Non-functional requirements

| PRD requirement                      | Status | As built                                                                                                       |
| ------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------- |
| Role-based access control            |   ✅   | Enforced server-side on every route and tested (RBAC boundaries covered in the API suite).                     |
| Audit logs                           |   🟡   | Access-code activity is fully logged; the general audit log has one writer (setup).                            |
| Secure payment handling              |   ✅   | No card data touches Proplity; payments run on Paystack, with signed-webhook verification.                     |
| Security hardening                   |   ✅   | See §2; independently reviewed 2026-09-30 and fixed.                                                           |
| End-to-end encryption                |   ❌   | Not implemented. Transport is HTTPS via the host; passwords are hashed; messages are not end-to-end encrypted. |
| NDPR alignment                       |   ❌   | Not assessed.                                                                                                  |
| Mobile-responsive portals            |   ✅   | Tenant/vendor/manager dashboards work on phones (bottom tab bar). No offline mode.                             |
| Performance (100k+ units, <2 s)      |   ❌   | Not measured or load-tested.                                                                                   |
| 99.5 % uptime / graceful degradation |   🟡   | Missing provider keys degrade features with clear messages; no SLA monitoring is in place.                     |
| API-first backend                    |   ✅   | Versioned REST API (`/api/v1`, 73 routes) behind one typed client.                                             |

## 10. Quality & operations

- **Automated tests:** 247 API tests (real HTTP against a real server and database) and 36 browser tests (smoke, per-role flows, session restore, payment round trip, mobile navigation); both run on every pull request.
- **Environments:** three-tier `dev` → `main` (staging) → `prod`, deployed on Vercel with a daily scheduled job and migration workflows.
- **Not yet verified:** the live Paystack charge call, real Cloudinary uploads in a deployed environment, and the production email domain.

## 11. Gap summary against the original PRD

Built and behaving as the PRD intends: property and unit management, moderated listings, rent invoicing with late fees and service charge, renewals, e-signature, maintenance end to end with vendors, messaging and notifications, access codes, tenant onboarding and profile, role-based access, admin console.

Partly built: Paystack (live call untested), auto-pay (authorisation only), notices (manual), neighbourhood and condition data (no integrations), payment-linked availability, smart rent scoring (heuristic).

Not built: every AI capability (assistant, triage, document drafting, media validation, conversational search, fingerprinting, community AI), WhatsApp, push notifications, bank-transfer reconciliation, vendor payouts, resident directory / discussion boards, maintenance approval workflows, ID-verification API, end-to-end encryption, performance targets.

The next milestones that close the most visible gaps are listed under "What's next" in [`CLAUDE.md`](../CLAUDE.md): charging auto-pay mandates, a manager-facing application inbox, and a real-account Paystack test run.
