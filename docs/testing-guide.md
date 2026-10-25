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
  account. Without a key (and no mock gateway) the screens say "Card payments
  are not available yet" and point to **Paid another way**; they switch on by
  themselves when the key is set, with no rebuild. In test environments, set `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED` to
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
- [ ] Contact form — fill in the contact page and send it: "Message sent!"
      appears only when the email went out (in a test environment, open the
      Sent Emails widget to see it, addressed to the team's contact mailbox
      with your address as the reply-to). On an environment with no email
      service set up, an error appears under the form instead and your text
      stays in the fields. Sending more than 5 in an hour from one address is
      refused with a "try again later" message
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
- [ ] Sign out of a dashboard and, straight away, go to the home page and open a listing: you stay on the public pages (no sudden jump to the sign-in screen)
- [ ] Forgot password — request a reset link, set a new password
- [ ] First-time setup (one-time only, your IT/deployer does this once) —
      create the very first admin account when the app is brand new

## Tenant flows

- [ ] Browse available properties and view details on one
- [ ] Schedule a viewing for a property before renting it: pick a date from tomorrow (a Sunday is refused) and a start time between 9:00 AM and 5:00 PM (Lagos time)
- [ ] One person at a time: with a viewing booked at a property for 10:00 AM (by another account, still requested or confirmed), open the same property's form on the same date. 10:00 AM is marked "(booked)", listed under the time field and cannot be chosen; another property, or another time, is free. After the manager declines the request (or its owner cancels it), 10:00 AM can be booked again. If someone books your time while you are on step 2, confirming sends you back to choose another time
- [ ] The dashboard's **Needs your attention** list shows a rent to sign, payments due or overdue, finished repairs to rate and an unfinished profile; each row opens the right screen
- [ ] Notifications arrive (bell, and an email in the dev inbox) for a rent to sign, a new invoice, a completed repair and an overdue payment
- [ ] Complete your profile (first **Apply Now** redirects to _Complete Your
      Profile_) — phone, year of birth, emergency contact, ID upload;
      previous landlord optional. Confirm the application can't be reached
      until the required fields are filled
- [ ] Apply to rent a property — the 3-step form (Applicant read-only,
      Employment, Review & Submit)
- [ ] _My Rentals_ — every current and past rent, linking to the property
- [ ] View "my dashboard" — see current rent/unit at a glance
- [ ] Submit a maintenance request (e.g. "kitchen tap is leaking") with
      photos, urgency level, and a preferred time
- [ ] Track a maintenance request — watch its status change as staff and
      vendors work on it
- [ ] When the vendor finishes, the request says **Needs your answer** (and
      the dashboard lists **Repairs to confirm**): the vendor's photos are
      shown; **Confirm fixed** records it, **Still a problem** needs a reason
      (photos optional) and tells the property team
- [ ] View payment history — see past rent payments
- [ ] With no Paystack key and no mock gateway, the dashboard's rent button
      reads "Card Payment Not Available Yet" and is disabled, with a note
      pointing to Paid another way; the auto-pay setup says it cannot be set
      up; a manager's vendor-invoice Pay button is replaced by the same
      message. Setting the key (or the mock gateway) brings the buttons back
- [ ] Pay rent (via Paystack, or the mock gateway in test environments) —
      the invoice becomes paid, a payment appears in history, and the
      manager/landlord get a notification
- [ ] **I paid by bank transfer** (payment history): record a transfer with
      its reference and, if uploads are on, a receipt file. It waits under
      **Transfers you recorded** until the property team confirms it; then the
      invoice is paid, the payment shows a **Receipt** link and you are told
- [ ] Every payment row has a **Receipt**: it shows who paid whom, how, the
      reference and what is still owing, and **Print / Save as PDF** works. A
      stranger (another tenant, a vendor, a signed-out visitor) cannot open it
- [ ] Set up auto-pay — with no card payment yet it says "No saved card yet";
      after a card payment it offers **Enable Auto-Pay**, shows "Auto-pay is
      active (card ending …)", and **Cancel Auto-Pay** reverts it
- [ ] Sign a rent that is awaiting signature (card at the top of the
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
- [ ] Add a tenant — set up a new tenant + rent on one of their units
      (**note**: the rent starts as Pending; open that tenant's page and
      click **Activate Rent** afterward, which is what actually marks the
      unit occupied — this is an intentional second step, not a bug)
- [ ] View a tenant's details and rent terms
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
- [ ] On a rent: **Renew Rent** (creates the new rent, expires the old),
      **Send Notice** (each type), **Send Invoice** (each type incl.
      Service Charge) — the tenant sees both
- [ ] **Bank Transfers** tab: transfers waiting for confirmation, confirmed
      and rejected. **Confirm payment** pays the invoice, creates the receipt
      and tells the tenant and vendor; **Reject** needs a reason. You cannot
      confirm a transfer you recorded yourself (only withdraw it); if you are
      the only one who could, an admin is told. On a repair's vendor
      invoice (Cost Tracking), **Paid another way** records a transfer or cash
      payment to the vendor, with the receipt file, and it waits for someone else
      to confirm. Rent recorded with **Record cash or transfer payment** on a
      tenant's record opens the same form and waits for someone else too; the
      server refuses (409) to mark a tenant's or a vendor's invoice paid by
      hand. A receipt shows a note only if a person typed one
- [ ] Manage maintenance requests — see everything coming in, assign a
      vendor, track progress to completion
- [ ] **Raise a repair** (Maintenance board): pick a property and a unit
      (including a vacant one), say what needs doing, optionally choose a
      vendor. It opens as a work order with "no tenant": nobody is asked to
      confirm it, the repair page says **Raised By** you, and the vendor (if
      chosen) is told. Someone living in the unit is told work is planned
- [ ] **Schedules** tab (Recurring maintenance): add a schedule (unit, what is serviced, how
      often, first due date), **Pause** and **Resume** it, **Edit** its date or
      cycle and **Remove** it (with a confirmation). A schedule on a vacant unit
      says its repairs will be work orders with no tenant. A schedule that starts
      on the 31st falls on the last day of a short month and comes back to the
      31st
- [ ] On a finished repair the **Sign-off** card shows the tenant's answer;
      **Approve work** records the sign-off (the invoice is unaffected). If the
      tenant disputed it: **Send back to vendor**, **Give to another vendor**
      (refused if the first vendor's invoice has been paid) and **Approve
      anyway**. There is no "Mark as Completed" button: only the vendor
      finishes a job
- [ ] View breakdown/reports — drill into numbers (e.g. properties,
      transactions, maintenance) from the dashboard
- [ ] Message tenants and vendors
- [ ] Change password from inside the dashboard (Settings)

- [ ] A viewing request shows the visitor's email, phone, "ID on file" and member-since; the ID link itself is never shown
- [ ] On a finished repair, **View invoice** under Cost Tracking lists the vendor's lines, VAT, total and notes
- [ ] The dashboard's **Needs your attention** list shows applications, viewing requests, repairs with no vendor, vendor invoices to pay and overdue rent

## Vendor (contractor) flows

- [ ] See assigned jobs — the maintenance requests they've been assigned to
- [ ] View job details for a specific request
- [ ] Update job status as they work on it (in progress → completed)
- [ ] Add before and after photos under **Work Photos**; a job cannot be
      closed (by invoice or **Mark work done**) without at least one after
      photo; photos lock once the repair is approved or confirmed
- [ ] A repair the tenant said is still a problem shows their reason and
      photos in a red box; fix it and press **Mark work done** (no second
      invoice)
- [ ] Create an invoice for a completed job (itemized costs, submit for
      payment) — **note**: whether submitting an invoice automatically
      marks the job Completed is a platform-wide setting an admin controls
      (Admin → Platform Settings); ask what it's set to before assuming
      either way
- [ ] **Invoices** shows a **Receipt** link on each payment, and you are
      told (bell, and an email for a payment recorded by hand) when an invoice
      is paid
- [ ] Get notified when a new job is assigned to them
- [ ] Message the manager/landlord about a job
- [ ] Change password from inside the dashboard (Settings)

## Admin flows

- [ ] System overview — a bird's-eye dashboard of the whole platform
- [ ] Admins live in `/admin` — opening a regular dashboard address
      (e.g. `/dashboard/discover`) or the homepage's "Browse All Properties"
      should land on `/admin`, never an error page
- [ ] Manage users — view/manage every account on the platform across all
      roles: - Toggle between Cards view and Table view on desktop and mobile - Sticky compact toolbar remains visible on vertical scroll - Landlords and managers prominently display their active Properties Count
- [ ] Properties — the moderation queue: - Toggle between responsive Cards view and Table view on desktop and mobile - Sticky compact toolbar with status tabs (All, Pending Review, Approved, Rejected, Flagged, Merged) - Click "Review" or "View" to open slide-over popup drawer (right-side desktop, bottom sheet mobile, click-outside backdrop) - Inspect Landlord & Manager contact information in drawer and on full property page - Check Approved Date and [EDITED] badges on resubmitted listings - Quick Approve / Reject / Publish actions in drawer or full page - "FULL VIEW" link navigates directly to `/admin/properties/[id]`
- [ ] Landlord Property Controls: - Request Admin Approval without publishing immediately - Edit property details (auto-resubmits to `PENDING_REVIEW` with `[EDITED]` status and notifies admins) - Selective unit visibility: toggle individual units between Public (Marketplace) and Private (Selected Few)
- [ ] **Bank Transfers** (`/admin/payments`) — the same list as the property
      team's; confirm a transfer a manager recorded when no landlord can, and
      check you cannot confirm one you recorded yourself
- [ ] Security — the audit log page loads (a mostly-empty list is expected)
- [ ] Admin Controls tiles on System Overview: User Management, Security and
      Settings navigate; **Database** shows the "no in-app database console"
      note
- [ ] View reports
- [ ] Drill into breakdowns — same kind of detail view as managers get, but
      platform-wide
- [ ] Platform Settings, charging and deletion — both cards are off; turning one on asks "Turn on …?" first, Cancel leaves it off; with the deployment flag unset the card says so; a retention period of 3 days is refused ("at least 30 days") and 365 / 90 are the defaults; every change is in the audit log as SETTINGS_CHANGED
- [ ] Platform Settings — toggle platform-wide behavior: whether a vendor
      invoice auto-completes its maintenance job, and whether tenants are
      asked to confirm finished repairs (turning it off leaves repairs already
      waiting for an answer answerable); the two second-person switches for
      payments the team records (tenant payments, vendor payments): off, the
      manager's entry on a tenant's record or a vendor's bill counts at once
      with a receipt and an audit row; on, it waits on Bank Transfers
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
- **Adding a tenant is a two-step process** — creating the rent, then
  separately activating it — by design, not a missed step in the flow.

---

## Automated tests

- **API Integration suite (Vitest)** — `pnpm test`. 769 tests across 62 files under
  `tests/` (647 in `tests/api/`, including bank reconciliation and vendor payouts in `tests/api/bank-reconciliation-and-payouts.test.ts`; the other 122 are the mocked unit, fuzz, security and anomaly tests that `pnpm test:unit` runs on their own),
  the API tests making real HTTP calls against a spawned `next dev` server and a dedicated
  `proplity_test_db` (dropped and recreated per run). Copy `.env.test.example`
  to `.env.test` first. Run in CI on every PR.
- **Fast Unit, Fuzz, Security & Anomaly suites (Vitest)** — `pnpm test:unit`
  (122 tests across 19 files, executes in ~2.8s without DB drops).
  - `pnpm test:fuzz` — runs adversarial input fuzzing against URL and body parsers (`tests/fuzz/`).
  - `pnpm test:security` — runs RBAC matrix and injection/smuggling checks (`tests/security/`).
  - `pnpm test:anomaly` — runs workflow state machine and financial edge invariant tests (`tests/anomaly/`).
- **Mutation Testing (Stryker Mutator)** — `pnpm test:mutation`. Evaluates test effectiveness against artificial code mutations. Achieves 85.71% mutation score across critical logic (`lib/propertyFingerprint`, `lib/uploadPolicy`, `lib/fileRef`, `lib/appUrl`, `lib/auth/jwt`).
- **Load & Stress Testing (Autocannon)** — `pnpm test:load`. Simulates concurrent user traffic across health, public property browsing, search filters, and auth rate limiting.
- **100k Units Scaling Benchmark** — `pnpm benchmark:100k`. Evaluates PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` query plans to confirm sub-millisecond index seek execution on 100,000+ unit scales.
- **UI suite (Playwright)** — `pnpm test:e2e` (also `:smoke`, `:flows`,
  `:ui`). 72 tests: marketing/auth smoke, per-role flows, session restore
  after idle, public-property sign-in redirects, the mock payment round trip,
  the dev email widget, the contact form (its two outcomes, with the route mocked), booked viewing times (marked on the form, and a time lost to someone else sends the person back), the mobile tab bar, and a layout check (`responsive/layout.spec.ts`: key pages at 320, 390 and 768 px must not scroll sideways, cut content off or scroll sideways inside the dashboard's main area). Needs a seeded database
  (`pnpm db:seed2`) and a running app (`E2E_BASE_URL`). Run in CI as the
  `E2E (Playwright)` job against a production build.
- **Running the API suite on a shared machine:** the suite's server uses port
  3101 (`tests/setup/constants.ts`). If another project's server is on that port
  every test fails with 404; change the port locally (do not commit it) and
  delete `.next-test/` if the build looks stale after switching branches.
- **Not covered by either**: the live Paystack charge call, real Cloudinary
  uploads, and recurring auto-charging (not built). The manual checklist
  above is where those are verified by hand.
