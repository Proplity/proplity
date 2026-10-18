# Proplity — End-to-End Testing Guide

A checklist of every flow currently available in Proplity, organized by who
would test it. Use this to walk through the app end to end before sign-off.

_Last updated 2026-10-04. For the automated suites (Vitest API tests and
Playwright UI tests) and how to run them, see "Automated tests" at the end._

---

## Before you start: what depends on configuration

A few flows depend on external services being configured for this specific
deployment (an email provider, a file-storage provider, a payment
provider). If one isn't configured yet, the app doesn't break or behave
unpredictably — it clearly says "not available" instead of silently failing.
Worth knowing before you test:

- **Email** (verification links, password reset, tenant invites, viewing
  confirmations) — real delivery requires an email provider key. Without it,
  emails are generated correctly but only logged on the server. In a test
  environment switch on the **Sent Emails** widget
  (`NEXT_PUBLIC_EMAIL_INBOX_ENABLED`) to open them in the browser.
- **Photo/document uploads** (maintenance photos, tenant-profile ID,
  property video/photos) — real file storage requires a storage provider
  key. Without it, you can still select a file in the form, but you'll see a
  clear notice that it won't be saved.
- **Rent payment** (Paystack) — requires a Paystack key, and the live
  charge call has not yet been run end-to-end against a real test-mode
  account. In test environments, set `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED` to
  get a fake Paystack-style checkout page whose "Pay" button fires a signed
  webhook at the real handler — it exercises the actual payment-recording,
  notification and auto-pay-authorization logic. Never enable it where real
  users pay.
- **Auto-pay** — recording the authorization works; automatic charging each
  cycle is not built yet.
- **Paid subscription plans** — intentionally switched off by default
  (shows "Coming Soon" instead of a real checkout) until billing is ready
  to go live. Not a bug.

If you hit a "not available yet" message anywhere, that's expected unless
told otherwise — check with your technical contact on which of the above
are configured for this environment before treating it as a defect.

---

## Before logging in (anyone visiting the site)

- [ ] Browse the marketing site — homepage, "For Landlords," "For Tenants,"
      "For Vendors," About, Contact, Pricing pages
- [ ] Look at a property listing — click into a property and see photos,
      details, price
- [ ] Featured Properties on the homepage — click a card (a popup opens, the
      page doesn't navigate), step through with the side arrows (or ← / →
      keys), close with Esc / × / clicking outside, then click **View
      Details** to reach the real property page. The card's own View Details
      button should skip the popup. These are real published listings, not
      sample data
- [ ] Create an account — sign up as each self-registerable role (tenant,
      landlord, manager, vendor). A manager must enter a valid landlord
      invitation code; admins can't self-register
- [ ] Verify email — click the link sent after signup, **or**, if you don't
      have it, use the "Didn't get a verification email? Resend it" link
      right on the login page (works from any device, any time — you don't
      need the original signup session). Confirm you **cannot** log in before
      verifying
- [ ] Open a dashboard URL while logged out, log in, and confirm you land on
      that page (not the generic dashboard); then idle 15+ minutes, reload a
      dashboard page, and confirm you're returned to it
- [ ] Log in / log out
- [ ] Forgot password — request a reset link, set a new password
- [ ] First-time setup (one-time only, your IT/deployer does this once) —
      create the very first admin account when the app is brand new

## Tenant flows

- [ ] Browse available properties and view details on one
- [ ] Schedule a viewing for a property before renting it
- [ ] Complete your profile (first **Apply Now** redirects to _Complete Your
      Profile_) — phone, year of birth, emergency contact, ID upload;
      previous landlord optional. Confirm the application can't be reached
      until the required fields are filled
- [ ] Apply to rent a property — the 3-step form (Applicant read-only,
      Employment, Review & Submit)
- [ ] _My Rentals_ — every current and past lease, linking to the property
- [ ] View "my dashboard" — see current lease/unit at a glance
- [ ] Submit a maintenance request (e.g. "kitchen tap is leaking") with
      photos, urgency level, and a preferred time
- [ ] Track a maintenance request — watch its status change as staff and
      vendors work on it
- [ ] View payment history — see past rent payments
- [ ] Pay rent (via Paystack, or the mock gateway in test environments) —
      the invoice becomes paid, a payment appears in history, and the
      manager/landlord get a notification
- [ ] Set up auto-pay — with no card payment yet it says "No saved card yet";
      after a card payment it offers **Enable Auto-Pay**, shows "Auto-pay is
      active (card ending …)", and **Cancel Auto-Pay** reverts it
- [ ] Sign a lease that is awaiting signature (card at the top of the
      dashboard)
- [ ] Message their landlord/manager directly in the app
- [ ] View the neighbourhood report for their property (safety, flooding,
      amenities, etc.)
- [ ] Get notified — a bell icon lights up when something changes
      (maintenance update, announcement, payment confirmation), with a
      popup preview and a full notifications page
- [ ] Change password from inside the dashboard (Settings)

## Landlord flows

- [ ] List a new property — multiple units (add/remove cards), service
      charge with the combined-total display, media upload step (real upload
      when storage is configured; "not available" note otherwise), then
      Submit for Verification. Force a unit failure if you can and confirm
      **Retry Failed Units** appears
- [ ] View their portfolio — all properties they own, at a glance
- [ ] Download Report — a CSV with one row per property; disabled with no
      properties
- [ ] Schedule Review — sends a message to the property's manager and opens
      the thread; disabled with "No manager assigned yet" when there's none
- [ ] Generate, copy and deactivate a manager invitation code
- [ ] Add a tenant — set up a new tenant + lease on one of their units
      (**note**: the lease starts as Pending; open that tenant's page and
      click **Activate Lease** afterward, which is what actually marks the
      unit occupied — this is an intentional second step, not a bug)
- [ ] View a tenant's details and lease terms
- [ ] See maintenance requests coming in on their properties
- [ ] Get notified when a tenant pays rent or submits a maintenance request
- [ ] Message tenants, managers, or vendors
- [ ] Change password from inside the dashboard (Settings)
- Subscription/paid-plan checkout exists but is off by default — see note
  above

## Property manager flows

Same as landlord, plus the day-to-day operational tools:

- [ ] Discover/browse properties across the portfolio they manage
- [ ] _My Properties_ — searchable list of managed properties with unit and
      occupancy counts
- [ ] Manage the tenant list — add, view, and track all tenants. Adding a
      tenant pre-fills the unit's service charge
- [ ] On a lease: **Renew Lease** (creates the new lease, expires the old),
      **Send Notice** (each type), **Send Invoice** (each type incl.
      Service Charge) — the tenant sees both
- [ ] Manage maintenance requests — see everything coming in, assign a
      vendor, track progress to completion
- [ ] View breakdown/reports — drill into numbers (e.g. properties,
      transactions, maintenance) from the dashboard
- [ ] Message tenants and vendors
- [ ] Change password from inside the dashboard (Settings)

## Vendor (contractor) flows

- [ ] See assigned jobs — the maintenance requests they've been assigned to
- [ ] View job details for a specific request
- [ ] Update job status as they work on it (in progress → completed)
- [ ] Create an invoice for a completed job (itemized costs, submit for
      payment) — **note**: whether submitting an invoice automatically
      marks the job Completed is a platform-wide setting an admin controls
      (Admin → Platform Settings); ask what it's set to before assuming
      either way
- [ ] Get notified when a new job is assigned to them
- [ ] Message the manager/landlord about a job
- [ ] Change password from inside the dashboard (Settings)

## Admin flows

- [ ] System overview — a bird's-eye dashboard of the whole platform
- [ ] Admins live in `/admin` — opening a regular dashboard address
      (e.g. `/dashboard/discover`) or the homepage's "Browse All Properties"
      should land on `/admin`, never an error page
- [ ] Manage users — view/manage every account on the platform across all
      roles:
      - Toggle between Cards view and Table view on desktop and mobile
      - Sticky compact toolbar remains visible on vertical scroll
      - Landlords and managers prominently display their active Properties Count
- [ ] Properties — the moderation queue:
      - Toggle between responsive Cards view and Table view on desktop and mobile
      - Sticky compact toolbar with status tabs (All, Pending Review, Approved, Rejected, Flagged, Merged)
      - Click "Review" or "View" to open slide-over popup drawer (right-side desktop, bottom sheet mobile, click-outside backdrop)
      - Inspect Landlord & Manager contact information in drawer and on full property page
      - Check Approved Date and [EDITED] badges on resubmitted listings
      - Quick Approve / Reject / Publish actions in drawer or full page
      - "FULL VIEW" link navigates directly to `/admin/properties/[id]`
- [ ] Landlord Property Controls:
      - Request Admin Approval without publishing immediately
      - Edit property details (auto-resubmits to `PENDING_REVIEW` with `[EDITED]` status and notifies admins)
      - Selective unit visibility: toggle individual units between Public (Marketplace) and Private (Selected Few)
- [ ] Security — the audit log page loads (a mostly-empty list is expected)
- [ ] Admin Controls tiles on System Overview: User Management, Security and
      Settings navigate; **Database** shows the "no in-app database console"
      note
- [ ] View reports
- [ ] Drill into breakdowns — same kind of detail view as managers get, but
      platform-wide
- [ ] Platform Settings — toggle platform-wide behavior (currently: whether
      a vendor invoice auto-completes its maintenance job)
- [ ] Open the admin-specific notifications view (bell + full page) —
      property creations and landlord edits trigger email/system notifications to admins
- [ ] Change password from inside the admin panel (Settings)

## Cross-cutting things worth testing regardless of role

- [ ] Messaging between any two roles that legitimately need to talk
      (tenant ↔ manager, manager ↔ vendor, etc.)
- [ ] Notifications — the bell icon, the popup, the sound, and the full
      notifications page, for every role
- [ ] Change password from inside the dashboard — every role has this
- [ ] Every "Back"/navigation button in the app

---

## Known, intentional limits (not defects)

- **Paid subscription checkout** is switched off by default — shows
  "Coming Soon" instead of a real charge, until billing is ready to go
  live.
- **Email, file uploads, and rent payment** each depend on a provider key
  being configured for this deployment (see the note at the top). Ask your
  technical contact which are live in the environment you're testing.
- **Adding a tenant is a two-step process** — creating the lease, then
  separately activating it — by design, not a missed step in the flow.

---

## Automated tests

- **API Integration suite (Vitest)** — `pnpm test`. 375 tests across 26 files in
  `tests/api/` (including bank reconciliation and vendor payouts in `tests/api/bank-reconciliation-and-payouts.test.ts`),
  real HTTP against a spawned `next dev` server and a dedicated
  `proplity_test_db` (dropped and recreated per run). Copy `.env.test.example`
  to `.env.test` first. Run in CI on every PR.
- **Fast Unit, Fuzz, Security & Anomaly suites (Vitest)** — `pnpm test:unit`
  (73 tests across 12 files, executes in ~2.8s without DB drops).
  - `pnpm test:fuzz` — runs adversarial input fuzzing against URL and body parsers (`tests/fuzz/`).
  - `pnpm test:security` — runs RBAC matrix and injection/smuggling checks (`tests/security/`).
  - `pnpm test:anomaly` — runs workflow state machine and financial edge invariant tests (`tests/anomaly/`).
- **Mutation Testing (Stryker Mutator)** — `pnpm test:mutation`. Evaluates test effectiveness against artificial code mutations. Achieves 85.71% mutation score across critical logic (`lib/propertyFingerprint`, `lib/uploadPolicy`, `lib/fileRef`, `lib/appUrl`, `lib/auth/jwt`).
- **Load & Stress Testing (Autocannon)** — `pnpm test:load`. Simulates concurrent user traffic across health, public property browsing, search filters, and auth rate limiting.
- **100k Units Scaling Benchmark** — `pnpm benchmark:100k`. Evaluates PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` query plans to confirm sub-millisecond index seek execution on 100,000+ unit scales.
- **UI suite (Playwright)** — `pnpm test:e2e` (also `:smoke`, `:flows`,
  `:ui`). 52 tests: marketing/auth smoke, per-role flows, session restore
  after idle, public-property sign-in redirects, the mock payment round trip,
  the dev email widget, and the mobile tab bar. Needs a seeded database
  (`pnpm db:seed2`) and a running app (`E2E_BASE_URL`). Run in CI as the
  `E2E (Playwright)` job against a production build.
- **Not covered by either**: the live Paystack charge call, real Cloudinary
  uploads, and recurring auto-charging (not built). The manual checklist
  above is where those are verified by hand.
