# Proplity — Step-by-Step Flow Guide

_Last updated 2026-10-04 — covers everything through the UI/UX gap audit
(tenant profile gate, 3-step applications, multi-unit listings with service
charge, real media upload, auto-pay, lease renewal/notices/invoices, the
landlord report download, and the admin Properties/Security pages)._

Every flow below was walked through click by click against a real, seeded
database — not just read from the code — including the flows where two or
three people (e.g. a tenant and a manager, or a manager and a vendor) act
at the same time and need to see each other's actions. Each numbered list
is the exact sequence of clicks/taps a person would follow.

---

## Before you start: what depends on configuration

A few flows depend on external services being configured for this specific
deployment (an email provider, a file-storage provider, a payment
provider). If one isn't configured yet, the app doesn't break or behave
unpredictably — it clearly says "not available" instead of silently
failing.

- **Email** (verification links, password reset, tenant invites, viewing
  confirmations) — real delivery requires an email provider key. Without
  one the emails are logged on the server instead; testers can switch on
  the in-app **Sent Emails** button (floating, bottom corner) to read them.
- **Photo/document uploads** (maintenance photos, rental-application
  profile ID, property photos/video) — real file storage requires a
  storage provider key. Without it you can still select a file, but you'll
  see a note that it won't be saved.
- **Rent payment** (Paystack) — requires a Paystack key. Test environments
  can instead switch on the **mock payment gateway**, which shows a
  Paystack-style checkout page; "paying" there runs the real payment
  recording logic.
- **Paid subscription plans** — switched off by default ("Coming Soon")
  until billing is ready to go live.

---

## Visitor flow (not logged in)

**1. Open the home page** and scroll to **Featured Properties Available for
Rent**. These are the real, published listings on the platform (up to six,
newest first) — not sample data.

**2. Click anywhere on a property card** — a popup opens with the photo
area, description, beds/baths/size, amenities, security/power/road scores,
and rent. Nothing navigates yet.

**3. Browse with the side arrows** — use the left/right arrows on either
side of the popup (or the keyboard's ← / → keys) to step through the
properties; the counter (e.g. _2 / 4_) shows where you are, and it wraps
around at the ends. Press **Esc**, click **×**, or click outside to close.

**4. Open the full listing** — click **View Details** in the popup, or the
**View Details** button on the card itself (which skips the popup), to reach
that property's own page.

**5. Create an account** — click _Get Started_/_Register_, choose your
role (Tenant, Landlord, Property Manager or Service Provider), fill in your
details and submit. A verification link is emailed to you; **your account
can't sign in until you click it** (the login page says so and offers a
_Resend it_ link). Property managers also need a **landlord invitation
code** from the landlord they'll work for, checked live as you type it.

**6. Browse All Properties** — takes you to sign in (or, if you're already
logged in, to your own property browser: _Discover_ for managers, _Browse_
for tenants; admins go to their admin area).

---

## Tenant flow

**1. Log in** at `/login` with your email and password.

**2. Your dashboard** shows your current unit, lease dates, a payment panel,
and three quick actions: _Generate Report_, _Message Manager_, _Request
Repair_. If you have a lease waiting for your signature, a signing card
appears at the top.

**3. Message your manager** — click _Message Manager_ (dashboard quick
action, or the "Messages" link under your Current Property card). This
opens a conversation with your property's manager and landlord — created
automatically the first time, reused every time after. Type a message and
press Enter or click the send icon.

**4. Submit a maintenance request** — click _Request Repair_.

1.  Pick a category (Plumbing, Electrical, HVAC, Structural, Other).
2.  Pick an urgency level.
3.  Enter a title and description.
4.  Optionally attach photos and a preferred access time.
5.  Click **Submit Request**. You're returned to your dashboard, and the
    request now appears under "Track a maintenance request."

**5. Browse and view a property** — open _Browse Properties_ from the
sidebar (or the bottom tab bar on mobile). Click **Details** on any
listing to see full information, photos, amenities, and its neighbourhood
scores.

**6. Schedule a viewing** — from a property's detail page, click **Schedule
Viewing**.

1.  Pick a date, then a time slot, and click **Continue**.
2.  Fill in your name, email, and phone number.
3.  Click **Confirm Viewing**. A "Viewing Scheduled!" confirmation appears
    and a confirmation email is sent.

**7. Complete your profile (once)** — the first time you click **Apply Now**
on a property you're taken to **Complete Your Profile** instead of the
application. It collects, once and for good: phone number, year of birth,
an emergency contact (name, relationship, phone), a government ID upload,
and — optionally — a previous landlord's phone/email (a first-time renter
may not have one). Save, and you're sent back to the application you
started.

**8. Apply to rent a property** — from a property's detail page, click
**Apply Now** (3 steps):

1.  _Applicant_: your name, email and profile details, shown read-only
    (change them in your profile, not here).
2.  _Employment Information_: employment status, employer, income,
    move-in date, pets.
3.  _Review & Submit_: any notes for the manager, accept the terms, then
    click **Submit Application**.

**9. View your rentals** — open _My Rentals_ from the sidebar for every
lease you've had — current and past — with its dates, rent and status.
Click one to open that property's page.

**10. Pay rent** — open _Payment History_ (or use the payment panel on your
dashboard). If you owe a balance, **Pay Rent Online** takes you to the
payment page (Paystack, or the mock gateway in test environments); once
paid, the invoice flips to paid and your manager is notified. Past
payments are listed under Recent Payments.

**11. Set up auto-pay (optional)** — on the dashboard's payment panel click
**Setup Auto-Pay**. Auto-pay reuses the card from a rent payment you've
already made online, so:

- If you haven't paid by card yet it says **No saved card yet** — pay one
  invoice online first.
- Otherwise it shows the card (last 4 digits) — click **Enable Auto-Pay**.
- Once active, the panel reads **Auto-pay is active (card ending ….)** with
  a **Cancel Auto-Pay** link.

_Note: enabling auto-pay records your authorization, but automatic
charging each cycle isn't switched on yet — keep paying invoices as
normal._

**12. Notifications** — the bell icon in the header shows a live count and
a popup preview; click it to open the full notifications page.

**13. Change your password** — open the avatar/Settings area →
_Change Password_, enter your current and new password, and save.

**14. On a phone**, the sidebar is replaced by a floating bottom tab bar
(Dashboard / Browse / Payments / More). Anything that doesn't fit — plus
Log Out — lives under **More**. Settings and Sign Out also fold into a
single menu off your avatar in the header, instead of three separate
icons.

**15. Log out** via the header (desktop) or the avatar menu (mobile).

---

## Landlord flow

**1. Log in.** Your dashboard is your **Portfolio** — every property you
own, at a glance (total units, occupancy, listed rent).

**2. View a property** — click **View Details** on any property card to
see its full listing, units, and occupancy breakdown.

**3. List a new property** — click **List Property** (sidebar or bottom
tab bar's _More_ menu on mobile).

1.  _Property Info_: type, address, city, state.
2.  _Details_: add one or more **units** — each has a unit number/label,
    bedrooms, bathrooms, rent, optional **service charge**, size and a
    payment frequency; use **+ Add Another Unit** for more (the review
    step shows each unit's combined total per cycle). Then amenities and
    utilities.
3.  _Media Upload_: **360° walkthrough video**, **photos of every room**
    and **exterior photos**, each uploaded directly. The first room photo
    becomes the listing's main image. If file storage isn't configured you'll
    see a "not available in this environment" note and can continue without
    media.
4.  _Review_ → **Submit for Verification**. The property is created first,
    then each unit; if a unit fails you get a **Retry Failed Units** button
    instead of having to start over. New listings need admin approval
    before they go live.

**4. View your tenants** — open _Tenants_ from the sidebar to see everyone
renting from you, their property, rent, and payment status.

**5. Open a tenant's detail page** — click any tenant to see their lease
terms, payment history, and documents. Click **Message Tenant** to open a
direct conversation with them (shared with your property manager, so
either of you can pick it up).

**6. View maintenance requests** on your properties from the _Maintenance_
tab.

**7. Owner actions** (bottom of your dashboard):

- **Download Report** — saves a CSV financial summary per property (units,
  occupancy, listed rent, collected, pending). Disabled until you have a
  property.
- **Schedule Review** — opens a short form that sends your property manager
  a message proposing a review (pick the manager if you have more than one),
  then takes you to that conversation. Disabled with "No manager assigned
  yet" until a property has a manager.
- **Manager codes** — generate, copy, and deactivate invitation codes for
  managers who'll work for you.

**8. Change your password** and **log out** the same way as any role (see
Tenant flow, steps 13–15).

---

## Property manager flow

Everything a landlord can do, plus the day-to-day operational tools:

**1. Log in.** Your dashboard shows portfolio stats — total properties,
active leases, rent collected, pending maintenance — each one clickable
through to a detailed breakdown (e.g. **View All Renewals →**).

**2. My Properties** — open _My Properties_ for a searchable list of the
properties you manage, with unit and occupancy counts; click one for its
page. (Also: **Discover Properties** — below.)

**2b. Discover properties** — open _Discover Properties_. As the manager of
these listings, you'll see a **Create Ad** button on each one (a tenant or
vendor browsing the same page won't see it — it's manager/landlord-only).

1.  Click **Create Ad**, pick a budget and duration, click **Launch Ad**.
    The listing now shows "Ad Running" with live impressions/clicks.
2.  Click **Cancel Ad** → **Yes, Cancel** to stop it early.

**3. Add a tenant** — click **Add Tenant**.

1.  _Tenant Info_: name, email, phone (NIN/occupation optional).
2.  _Link Property_: pick a property, then one of its **vacant** units.
3.  _Lease Details_: start/end date (rent and **service charge** auto-fill
    from the unit, adjustable, with a combined total shown), frequency.
4.  _Review_ → **Create Tenancy**. You're returned to the tenant list —
    **the new tenancy starts as Pending**, not Active.
5.  Open that tenant from the list and click **Activate Lease** — this
    is the deliberate second step that actually marks the unit occupied,
    not a bug in the flow.

**3b. Run a tenancy** — open a tenant from the list. On the lease page:

- **Renew Lease** — pre-fills a same-length term starting the day after the
  current lease ends (edit dates, rent, deposit), then creates the renewal
  and takes you to the new lease; the old one is marked expired.
- **Send Notice** — pick a type (Payment Reminder, Rent Increase, Renewal
  Offer, Default, Expiration Alert, Termination), write a message, send.
- **Send Invoice** (Quick Actions) — pick a type (including Service Charge),
  amount, due date, optional description; the tenant sees it immediately.
- **Terminate Lease**, **Message Tenant**, and lease-terms editing
  (grace period, late fee) as before.

**4. Manage maintenance requests** — open _Maintenance_ to see every
request across your portfolio. Open one to:

- Click **Message about this request** to reach the shared thread with
  the tenant (and vendor, once assigned).
- Click **Assign Vendor**, search or pick one from the list — they're
  notified and the job appears in their queue immediately.
- Once a vendor's invoice is submitted, the request completes
  automatically by default (configurable in Admin → Platform
  Settings) — or click **Mark as Completed** yourself at any time.

**5. Messages** — your inbox lists every conversation across tenants,
vendors, and landlords you're connected to.

**6. Change your password** and **log out**.

---

## Vendor (service provider) flow

**1. Log in.** Your dashboard lists your assigned jobs and invoices (one
combined view).

**2. Open a job** — click any job card to see the full request: property,
description, priority, photos, and access details.

**3. Message the manager about the job** — click **Message Manager** to
open (or reuse) the thread tied to that specific request; the tenant and
landlord are on it too.

**4. Update job status** as you work — mark it In Progress, and add notes
as you go.

**5. Create an invoice** — once the job's done, click **Mark Complete &
Create Invoice**.

1.  Add line items (description, quantity, rate) — the total updates
    live.
2.  Click **Submit Invoice**.
3.  By default, submitting the invoice **automatically marks the job
    Completed** — an admin can turn this off platform-wide if vendors
    need to invoice interim costs without closing out the job early.

**6. Change your password** and **log out**.

---

## Admin flow

**1. Log in** — admins land on `/admin`, a separate area from the tenant/
landlord/manager/vendor dashboard. If an admin opens a regular dashboard
address (e.g. `/dashboard/discover`), they are sent back to `/admin`.

**2. System Overview** — a bird's-eye view of the whole platform.

**3. User Management** — every account on the platform, filterable by
role (chips: All / Admin / Manager / Landlord / Tenant / Vendor) and
searchable by name, email, or phone.

**4. Reports** — platform-wide reporting.

**5. Properties** — the **moderation queue**. Filter chips (Pending Review
by default, Approved, Rejected, Flagged) and search show who submitted each
listing; open one to approve or reject it. Pending listings also appear
under "Items Needing Attention" on System Overview.

**5b. Security** — an **audit log** of sensitive platform actions (actor,
action, entity, time). It is genuinely sparse today — little writes to it
yet — so an empty list means little has happened, not that it's broken.

**5c. Platform Settings** — currently one live toggle: whether a vendor's
invoice automatically completes its maintenance job. Flip it and it takes
effect immediately for every request platform-wide.

_On System Overview, the **Admin Controls** tiles go to User Management,
Security and Settings; **Database** shows a note that backups and logs are
managed at the hosting level — there is no in-app database console._

**6. Notifications** — the bell and full notifications page open
correctly; note that nothing currently triggers a notification _to_ an
admin, so this checks the screen itself, not a live alert.

**7. Change your password** and **log out**.

---

## Cross-role example: a request from start to finish

This is the same lifecycle a real maintenance issue goes through, with
three different people (a tenant, their manager, and a vendor) all acting
in their own account, live:

1. **Tenant** clicks _Message Manager_ and sends a note — the manager
   sees it appear in their inbox within a few seconds (messaging polls
   automatically; no refresh needed).
2. **Manager** replies from their side — the tenant sees the reply appear
   the same way.
3. **Tenant** submits a new maintenance request (e.g. "Leak in the
   bathroom").
4. **Manager** sees it appear in their Maintenance list, opens it, and
   assigns a vendor.
5. **Vendor** sees the job appear in their queue immediately, opens it,
   and submits an invoice for the completed work.
6. **Both the manager and the tenant** see the request move to
   **Completed** — automatically, the moment the invoice was submitted.

---

## Known, intentional limits (not defects)

- **Paid subscription checkout** is switched off by default — shows
  "Coming Soon" instead of a real charge, until billing is ready to go
  live.
- **Email, file uploads, and rent payment** each depend on a provider key
  being configured for this deployment (see the note at the top).
- **Adding a tenant is a two-step process** — creating the lease, then
  separately activating it — by design, not a missed step in the flow.
- **Listing a new property requires admin review** before it goes live —
  by design, to keep listings trustworthy.
- **Admin notifications** — the screen is real and open correctly, but no
  platform event currently triggers one; nothing to test there yet beyond
  the screen opening.
- **Auto-pay records the authorization but doesn't charge yet** — a
  recurring-charge job isn't built; tenants keep paying invoices manually.
- **The Security audit log is sparse** — only a few actions write to it so
  far.
- **"Schedule Review" is a message, not a calendar booking** — there's no
  meeting/appointment feature behind it.
- **Several room photos, one stored** — the listing form accepts many room
  photos but only the first is saved as the main image.
