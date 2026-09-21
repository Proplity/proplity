# Proplity — End-to-End Testing Guide

A checklist of every flow currently available in Proplity, organized by who
would test it. Use this to walk through the app end to end before sign-off.

---

## Before you start: what depends on configuration

A few flows depend on external services being configured for this specific
deployment (an email provider, a file-storage provider, a payment
provider). If one isn't configured yet, the app doesn't break or behave
unpredictably — it clearly says "not available" instead of silently failing.
Worth knowing before you test:

- **Email** (verification links, password reset, tenant invites) — real
  delivery requires an email provider key. Without it, these emails are
  generated correctly but not actually delivered to an inbox.
- **Photo/document uploads** (maintenance request photos, rental
  application documents) — real file storage requires a storage provider
  key. Without it, you can still select a file in the form, but you'll see
  a clear notice that it won't be saved.
- **Rent payment** (Paystack) — requires a Paystack key, and the live
  charge call has not yet been run end-to-end against a real test-mode
  account. Worth a dedicated test pass on its own before relying on it.
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
- [ ] Create an account — sign up as a new user
- [ ] Verify email — click the link sent after signup, **or**, if you don't
      have it, use the "Didn't get a verification email? Resend it" link
      right on the login page (works from any device, any time — you don't
      need the original signup session)
- [ ] Log in / log out
- [ ] Forgot password — request a reset link, set a new password
- [ ] First-time setup (one-time only, your IT/deployer does this once) —
      create the very first admin account when the app is brand new

## Tenant flows

- [ ] Browse available properties and view details on one
- [ ] Schedule a viewing for a property before renting it
- [ ] Apply to rent a property — fill out the application form, including
      uploading ID and income documents
- [ ] View "my dashboard" — see current lease/unit at a glance
- [ ] Submit a maintenance request (e.g. "kitchen tap is leaking") with
      photos, urgency level, and a preferred time
- [ ] Track a maintenance request — watch its status change as staff and
      vendors work on it
- [ ] View payment history — see past rent payments
- [ ] Pay rent (via Paystack)
- [ ] Message their landlord/manager directly in the app
- [ ] View the neighbourhood report for their property (safety, flooding,
      amenities, etc.)
- [ ] Get notified — a bell icon lights up when something changes
      (maintenance update, announcement, payment confirmation), with a
      popup preview and a full notifications page
- [ ] Change password from inside the dashboard (Settings)

## Landlord flows

- [ ] List a new property — add address, details, photos
- [ ] View their portfolio — all properties they own, at a glance
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
- [ ] Manage the tenant list — add, view, and track all tenants
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
- [ ] Manage users — view/manage every account on the platform, across all
      roles
- [ ] View reports
- [ ] Drill into breakdowns — same kind of detail view as managers get, but
      platform-wide
- [ ] Platform Settings — toggle platform-wide behavior (currently: whether
      a vendor invoice auto-completes its maintenance job)
- [ ] Open the admin-specific notifications view (bell + full page) —
      **note**: nothing currently triggers a notification _to_ an admin, so
      there's no in-app action that will make one appear yet; this checks
      that the screen itself opens correctly, not a live notification
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
