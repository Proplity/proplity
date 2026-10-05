# Proplity — Complete Step-by-Step Role Guide

> **Version:** 3.0 · **Updated:** 2026-10-04 · **Platform:** Proplity — AI-Powered Nigerian Property Management

---

## What is Proplity?

Proplity is an all-in-one property management platform built for the Nigerian real estate market. It connects four groups of people — **Tenants**, **Landlords**, **Property Managers**, and **Service Providers (Vendors)** — under one roof, with an **Admin** overseeing the entire platform.

Think of it like a digital office building:

- A **Tenant** is the person renting a flat.
- A **Landlord** owns the building and tracks their portfolio.
- A **Property Manager** is the landlord's trusted representative who handles day-to-day operations.
- A **Vendor** is a plumber, electrician, or other tradesperson called in to fix things.
- The **Admin** is the platform's system administrator who keeps everything running.

Every action — from paying rent to submitting a repair request to approving a tenancy application — flows through this platform.

---

## Quick Reference: Login Accounts

| Role                 | Email                   | Password       | What They Do                          |
| :------------------- | :---------------------- | :------------- | :------------------------------------ |
| **Visitor (Public)** | _(no login needed)_     | N/A            | Browse listings, view properties      |
| **Tenant**           | `tenant@proplity.com`   | `Password123!` | Pay rent, report repairs, view lease  |
| **Landlord**         | `landlord@proplity.com` | `Password123!` | Manage portfolio, track revenue       |
| **Property Manager** | `manager@proplity.com`  | `Password123!` | Run daily operations for landlords    |
| **Vendor**           | `vendor@proplity.com`   | `Password123!` | Complete repair jobs, submit invoices |
| **Admin**            | `admin@proplity.com`    | `Password123!` | Platform governance and oversight     |

---

## Before You Begin: Important Notes

| Feature                  | Works?           | Notes                                   |
| :----------------------- | :--------------- | :-------------------------------------- |
| Browsing properties      | ✅ Yes           | No setup needed                         |
| Login / Registration     | ✅ Yes           | Works immediately                       |
| Maintenance requests     | ✅ Yes           | All workflows work                      |
| Messaging                | ✅ Yes           | Real-time messages                      |
| Email delivery           | ⚙️ Config needed | Without a key, emails are logged in-app |
| File/Photo uploads       | ⚙️ Config needed | Cloudinary key needed                   |
| Rent payments (Paystack) | ⚙️ Config needed | Use mock gateway for testing            |
| Subscription billing     | 🔒 Coming soon   | Marked "Coming Soon" in the UI          |

---

# 🏁 SECTION 0: FIRST-TIME PLATFORM SETUP (Super Admin)

> **Who does this?** The very first person to deploy Proplity. One-time only. Once done, this page is permanently disabled.

## Step 0.1 — The Setup Page (`/setup`)

**What this is:**
When Proplity is installed for the very first time, there are no admin accounts at all. The `/setup` page is a special one-time wizard to create the first "super admin" account. After that first admin is created, this page automatically closes forever for security.

**What you see:**
A simple form asking for the name, email, and password for the first admin user.

**Screenshot — Desktop:** `docs/screenshots/setup_01_setup_page_desktop.png`

![Setup 01 Setup Page Desktop](screenshots/setup_01_setup_page_desktop.png)

**Screenshot — Mobile:** `docs/screenshots/setup_01_setup_page_mobile.png`

![Setup 01 Setup Page Mobile](screenshots/setup_01_setup_page_mobile.png)

> ⚠️ **If you see a redirect to login instead of the setup form**, the platform was already set up. The super admin already exists. See: `docs/screenshots/setup_01b_setup_complete.png`

![Setup 01B Setup Complete](screenshots/setup_01b_setup_complete.png)

**Step-by-step:**

1. Open `http://yourdomain.com/setup` (or `http://localhost:3000/setup` locally)
2. Fill in: **Full Name**, **Email Address**, **Password** (use a strong password)
3. Click **Create Admin Account**
4. You'll be redirected to the login page
5. Log in with the email and password you just set
6. You are now inside the Admin Dashboard — setup complete!

> 🔐 **Security note:** This page cannot be accessed again. To reset admin access, a developer must modify the database directly.

---

# 🌍 SECTION 1: VISITOR / PUBLIC EXPERIENCE (No Login Required)

> **Who is this?** Anyone who opens the website without logging in — a prospective tenant, a curious landlord, or just someone browsing.

## Step 1.1 — The Homepage

**What this is:**
The very first thing anyone sees when they visit Proplity. It showcases real properties available for rent across Nigerian cities.

**What you see:**

- A large hero banner with "Get Started" / "Browse Properties" buttons
- A "How it works" section (step-by-step for tenants and landlords)
- "Featured Properties" cards pulled from the live database

**Screenshots:**

- Desktop (full page): `docs/screenshots/visitor_01_homepage_desktop.png`

![Visitor 01 Homepage Desktop](screenshots/visitor_01_homepage_desktop.png)

- Desktop (hero): `docs/screenshots/visitor_01b_homepage_hero_desktop.png`

![Visitor 01B Homepage Hero Desktop](screenshots/visitor_01b_homepage_hero_desktop.png)

- Desktop (features section): `docs/screenshots/visitor_01c_homepage_features_desktop.png`

![Visitor 01C Homepage Features Desktop](screenshots/visitor_01c_homepage_features_desktop.png)

- Desktop (featured properties): `docs/screenshots/visitor_01d_homepage_properties_desktop.png`

![Visitor 01D Homepage Properties Desktop](screenshots/visitor_01d_homepage_properties_desktop.png)

- Tablet (768px): `docs/screenshots/visitor_01_homepage_tablet.png`

![Visitor 01 Homepage Tablet](screenshots/visitor_01_homepage_tablet.png)

- Mobile (390px): `docs/screenshots/visitor_01_homepage_mobile.png`

![Visitor 01 Homepage Mobile](screenshots/visitor_01_homepage_mobile.png)

**Navigation:**

- **Get Started** → registration page
- **Browse Properties** → prompts sign-in
- Click any property card → opens a quick-preview popup (see Step 1.2)

---

## Step 1.2 — Property Preview Modal (Pop-up Card)

**What this is:**
When you click a property card on the homepage, a **modal** (pop-up overlay) appears. It lets you quickly preview a property's key details without navigating away from the homepage.

**What you see inside:**

- Property photos with left/right arrows to slide through
- Bedrooms, bathrooms, and size
- Monthly rent
- Amenities list (e.g., "24/7 Generator", "Borehole Water", "Security Gatehouse")
- Neighbourhood scores (Safety, Flood Risk, Road Quality)
- A **"View Details"** button to open the full listing

**Screenshots:**

- Modal open (first property): `docs/screenshots/visitor_02_property_modal_desktop.png`

![Visitor 02 Property Modal Desktop](screenshots/visitor_02_property_modal_desktop.png)

- Modal (second property): `docs/screenshots/visitor_02b_property_modal_slide2_desktop.png`

![Visitor 02B Property Modal Slide2 Desktop](screenshots/visitor_02b_property_modal_slide2_desktop.png)

- Legacy: `docs/screenshots/visitor_02_property_modal.png`

![Visitor 02 Property Modal](screenshots/visitor_02_property_modal.png)

**Controls:** Use ← → arrows to slide · Press **Esc** or click outside to close · Click **View Details** to go to full page

---

## Step 1.3 — Full Property Detail Page

**What this is:**
The complete page for a single rental property. Everything a prospective tenant needs to decide if they want to apply.

**What you see:**

- High-resolution photo gallery
- Property name, location (area + city), and rent price
- Full description from the landlord/manager
- Complete amenities list
- Neighbourhood metrics scored out of 10 (Safety, Flood Risk, Road Infrastructure)
- **Schedule a Viewing** and **Apply for this Property** buttons

**Screenshots:**

- Desktop (top): `docs/screenshots/visitor_03_property_detail_desktop.png`

![Visitor 03 Property Detail Desktop](screenshots/visitor_03_property_detail_desktop.png)

- Desktop (scrolled — amenities): `docs/screenshots/visitor_03b_property_detail_scroll_desktop.png`

![Visitor 03B Property Detail Scroll Desktop](screenshots/visitor_03b_property_detail_scroll_desktop.png)

- Tablet: `docs/screenshots/visitor_03_property_detail_tablet.png`

![Visitor 03 Property Detail Tablet](screenshots/visitor_03_property_detail_tablet.png)

- Mobile: `docs/screenshots/visitor_03_property_detail_mobile.png`

![Visitor 03 Property Detail Mobile](screenshots/visitor_03_property_detail_mobile.png)

- Legacy: `docs/screenshots/visitor_03_property_detail.png`

![Visitor 03 Property Detail](screenshots/visitor_03_property_detail.png)

> **Cross-reference:** When a logged-in tenant views this page, "Apply" becomes fully active → see Section 2, Step 2.6.

---

## Step 1.4 — Login Page

**What this is:**
The sign-in page for all registered users.

**What you see:**

- Email and password fields
- **"Remember me"** checkbox (30-day session vs 1-day)
- Demo login buttons (test environments only — auto-fill credentials)
- Links to **Forgot Password** and **Resend Verification Email**

**Screenshots:**

- Desktop: `docs/screenshots/visitor_04_login_desktop.png`

![Visitor 04 Login Desktop](screenshots/visitor_04_login_desktop.png)

- Tablet: `docs/screenshots/visitor_04_login_tablet.png`

![Visitor 04 Login Tablet](screenshots/visitor_04_login_tablet.png)

- Mobile: `docs/screenshots/visitor_04_login_mobile.png`

![Visitor 04 Login Mobile](screenshots/visitor_04_login_mobile.png)

- Legacy: `docs/screenshots/visitor_04_login.png`

![Visitor 04 Login](screenshots/visitor_04_login.png)

**After login, each role goes to:**

- Tenant / Landlord / Manager / Vendor → `/dashboard`
- Admin → `/admin`

> ⚠️ Login is blocked if your email is not yet verified. A "Resend verification" link appears on the error message.

---

## Step 1.5 — Registration / Sign-Up

**What this is:**
Where new users create their Proplity account. First step is picking your account type.

**Step 1 — Role Selection (4 options):**

1. **Tenant** — "I'm looking for a place to rent"
2. **Landlord** — "I own properties I want to rent out"
3. **Property Manager** — "I manage properties for a landlord" _(needs landlord invitation code)_
4. **Service Provider** — "I provide repair/maintenance services"

**Screenshots (role cards):**

- Desktop: `docs/screenshots/visitor_05_register_roles_desktop.png`

![Visitor 05 Register Roles Desktop](screenshots/visitor_05_register_roles_desktop.png)

- Mobile: `docs/screenshots/visitor_05_register_roles_mobile.png`

![Visitor 05 Register Roles Mobile](screenshots/visitor_05_register_roles_mobile.png)

- Legacy: `docs/screenshots/visitor_05_signup.png`

![Visitor 05 Signup](screenshots/visitor_05_signup.png)

**Step 2 — Fill in Your Details (Tenant example):**

- Full legal name, email, Nigerian phone number
- State of residence, occupation, employer
- Password (must have uppercase, number, and symbol)

**Screenshot:** `docs/screenshots/visitor_06_register_tenant_form_desktop.png`

![Visitor 06 Register Tenant Form Desktop](screenshots/visitor_06_register_tenant_form_desktop.png)

**After submitting:**

- Verification email sent to your inbox
- You see a "Please verify your email" notice
- You cannot log in until you click the link
- Use "Resend Verification" if you don't receive it

**Full registration flow screenshots:**

- Role selection: `tenant_reg_01_select_role.png`
- Form filled: `tenant_reg_02_form.png`
- Verification notice: `tenant_reg_03_notice.png`
- After clicking verification link: `tenant_reg_04_verified.png`
- First dashboard: `tenant_reg_05_welcome_dashboard.png`

---

## Step 1.6 — Forgot Password & Password Recovery

**What this is:**
If a user forgets their password, this page enables them to initiate a secure recovery workflow.

**What you see:**

- Registered email address input field
- "Send Reset Link" button
- "Back to Login" navigation link
- Built-in anti-enumeration security (generic response prevents user account harvesting)

**Screenshots:**

- Desktop: `docs/screenshots/visitor_07_forgot_password_desktop.png`

![Visitor 07 Forgot Password Desktop](screenshots/visitor_07_forgot_password_desktop.png)

- Mobile: `docs/screenshots/visitor_07_forgot_password_mobile.png`

![Visitor 07 Forgot Password Mobile](screenshots/visitor_07_forgot_password_mobile.png)

**Step-by-step:**

1. Navigate to `/forgot-password` (or click "Forgot password?" on the login page)
2. Enter your registered account email
3. Click **Send Reset Link**
4. Check your email inbox for the 60-minute single-use secure reset token
5. Click the link to set your new password on the password reset page

---

## Step 1.7 — Marketing / Info Pages

These pages explain the platform to prospective users. No login needed.

| Page          | URL              | What it contains                 |
| :------------ | :--------------- | :------------------------------- |
| About         | `/about`         | Platform story and team          |
| For Landlords | `/for-landlords` | Features for property owners     |
| For Tenants   | `/for-tenants`   | Features for renters             |
| For Vendors   | `/for-vendors`   | Features for service providers   |
| Pricing       | `/pricing`       | Subscription plans (Coming Soon) |

---

# 🏠 SECTION 2: TENANT FLOW

> **Login:** `tenant@proplity.com` / `Password123!`
>
> **Who is this?** A person renting a property through Proplity. They pay rent, report repairs, chat with their manager, and manage their tenancy here.

## Step 2.1 — Tenant Dashboard (Home Screen)

**What this is:**
After logging in, you land on your personal dashboard — the command centre showing everything important at a glance.

**What you see:**

- **Current Property card** — your unit address, floor, lease link
- **Payment panel** — outstanding rent invoice with "Pay Now" button
- **Quick Actions** — 3 shortcut buttons:
  - 🗓 **Generate Report** — download a printable tenancy summary
  - 💬 **Message Manager** — opens a direct chat with your manager
  - 🔧 **Request Repair** — submit a maintenance/repair request
- **Active Lease tracker** — start date, end date, signing status
- **Maintenance tracker** — all your open and resolved repair tickets
- **AI Assistant** — a chat widget for property questions

**Screenshots:**

- Desktop (top): `docs/screenshots/tenant_01_dashboard_desktop.png`

![Tenant 01 Dashboard Desktop](screenshots/tenant_01_dashboard_desktop.png)

- Desktop (scrolled): `docs/screenshots/tenant_01b_dashboard_scroll_desktop.png`

![Tenant 01B Dashboard Scroll Desktop](screenshots/tenant_01b_dashboard_scroll_desktop.png)

- Mobile: `docs/screenshots/tenant_01_dashboard_mobile.png`

![Tenant 01 Dashboard Mobile](screenshots/tenant_01_dashboard_mobile.png)

- Legacy: `docs/screenshots/tenant_01_dashboard.png`

![Tenant 01 Dashboard](screenshots/tenant_01_dashboard.png)

---

## Step 2.2 — My Lease / Rentals

**What this is:**
Shows all lease agreements on your account — current and past.

**What you see:**

- Active lease card: property name, unit, monthly rent, lease dates
- Lease status badge: ACTIVE / EXPIRED / PENDING SIGNATURE
- **Sign Lease** button (if awaiting your digital signature)
- Past lease history

**Screenshot:** `docs/screenshots/tenant_02_my_lease_desktop.png`

![Tenant 02 My Lease Desktop](screenshots/tenant_02_my_lease_desktop.png)

> 💡 **Tip:** "PENDING SIGNATURE" means a lease is ready for you but you haven't signed yet. Click the card, review the terms, and sign digitally — no printing needed!

---

## Step 2.3 — Pay Rent (Payment Flow)

**What this is:**
Rent is paid directly through Proplity using Paystack. Monthly invoices are generated automatically — you just click to pay.

**How to pay:**

1. On your dashboard, look for the outstanding invoice in the Payment Panel
2. Click **Pay Now** → a modal shows the exact amount due
3. Click **Proceed to Payment** → redirected to Paystack checkout
4. Choose payment method: card, bank transfer, or USSD
5. Complete payment on Paystack
6. Redirected back to Proplity with "Payment Successful" confirmation

**Screenshots:**

- Pay Now modal: `docs/screenshots/tenant_03_pay_rent_modal_desktop.png`

![Tenant 03 Pay Rent Modal Desktop](screenshots/tenant_03_pay_rent_modal_desktop.png)

- Paystack checkout: `docs/screenshots/tenant_payment_02_paystack_checkout.png`

![Tenant Payment 02 Paystack Checkout](screenshots/tenant_payment_02_paystack_checkout.png)

- Mock Paystack gateway: `docs/screenshots/mock_01_paystack_gateway.png`

![Mock 01 Paystack Gateway](screenshots/mock_01_paystack_gateway.png)

- Payment success: `docs/screenshots/tenant_payment_03_payment_success.png`

![Tenant Payment 03 Payment Success](screenshots/tenant_payment_03_payment_success.png)

- Payment history: `docs/screenshots/tenant_10_payment_receipt_desktop.png`

![Tenant 10 Payment Receipt Desktop](screenshots/tenant_10_payment_receipt_desktop.png)

- Legacy history views: `docs/screenshots/tenant_04_payment_history.png`, `docs/screenshots/tenant_06_payment_history.png`

![Tenant 04 Payment History](screenshots/tenant_04_payment_history.png)

---

## Step 2.4 — Browse Properties

**What this is:**
Browse all published rental properties — useful when you want to move or find a new home.

**What you see:**

- Grid of property cards with photo, name, location, beds/baths, rent
- Search and filter options at the top
- **"Details"** button on each card

**Screenshots:**

- Desktop grid: `docs/screenshots/tenant_02_browse_properties_desktop.png`

![Tenant 02 Browse Properties Desktop](screenshots/tenant_02_browse_properties_desktop.png)

- Legacy: `docs/screenshots/tenant_02_browse.png`

![Tenant 02 Browse](screenshots/tenant_02_browse.png)

---

## Step 2.5 — Property Detail (Tenant View)

**What this is:**
Same as the visitor view, but with **Apply** and **Schedule Viewing** buttons fully active.

**Screenshots:**

- Desktop: `docs/screenshots/tenant_03_property_detail_desktop.png`

![Tenant 03 Property Detail Desktop](screenshots/tenant_03_property_detail_desktop.png)

- Scrolled (amenities): `docs/screenshots/tenant_03b_property_detail_scroll.png`

![Tenant 03B Property Detail Scroll](screenshots/tenant_03b_property_detail_scroll.png)

- From dashboard: `docs/screenshots/tenant_dashboard_property_detail.png`

![Tenant Dashboard Property Detail](screenshots/tenant_dashboard_property_detail.png)

- Apply view: `docs/screenshots/tenant_apply_01_property.png`

![Tenant Apply 01 Property](screenshots/tenant_apply_01_property.png)

---

## Step 2.6 — Schedule a Viewing (Book Inspection)

**What this is:**
Before applying, you can request to physically visit a property. The manager confirms a time.

**Steps:**

1. On a property detail page, click **Schedule Viewing**
2. A modal appears with a date picker and time slot
3. Pick your preferred date and time
4. Click **Submit Request**
5. Manager receives the request and confirms (or suggests a new time)
6. Confirmation email is sent to you

**Screenshots:**

- Viewing modal (desktop): `docs/screenshots/tenant_04_schedule_viewing_desktop.png`

![Tenant 04 Schedule Viewing Desktop](screenshots/tenant_04_schedule_viewing_desktop.png)

- Viewing modal (mobile): `docs/screenshots/tenant_04_schedule_viewing_mobile.png`

![Tenant 04 Schedule Viewing Mobile](screenshots/tenant_04_schedule_viewing_mobile.png)

- Legacy: `docs/screenshots/tenant_03_schedule_viewing.png`

![Tenant 03 Schedule Viewing](screenshots/tenant_03_schedule_viewing.png)

---

## Step 2.7 — Apply for a Property (3-Step Application)

**What this is:**
A formal 3-step online application form that a tenant fills in to apply for a rental. The manager reviews and approves or rejects.

> ⚠️ **Your profile must be complete before applying.** If key details are missing (year of birth, occupation, ID), the system redirects you to complete your profile first.

**Step 0 — Complete Profile (if required):**

- Screenshot: `docs/screenshots/tenant_apply_00_complete_profile.png`

![Tenant Apply 00 Complete Profile](screenshots/tenant_apply_00_complete_profile.png)

- Fill in: employment, year of birth, emergency contact, ID document

**Step 1 — Personal Information:**

- Screenshot: `docs/screenshots/tenant_apply_02_step1_personal.png`

![Tenant Apply 02 Step1 Personal](screenshots/tenant_apply_02_step1_personal.png)

- Your name and contact details (pre-filled from profile)

**Step 2 — Employment & Financial Info:**

- Screenshot: `docs/screenshots/tenant_apply_03_step2_employment.png`

![Tenant Apply 03 Step2 Employment](screenshots/tenant_apply_03_step2_employment.png)

- Employer, job title, monthly income (helps manager assess affordability)

**Step 3 — Review & Submit:**

- Screenshot: `docs/screenshots/tenant_apply_04_step3_review.png`

![Tenant Apply 04 Step3 Review](screenshots/tenant_apply_04_step3_review.png)

- Review everything, then click **Submit Application**

**After submission:**

- Screenshot: `docs/screenshots/tenant_apply_06_submitted_confirmation.png`

![Tenant Apply 06 Submitted Confirmation](screenshots/tenant_apply_06_submitted_confirmation.png)

- Manager is notified and will review your application
- Track status from "My Rentals"

> **Cross-reference:** Manager's application review → Section 4, Step 4.6

---

## Step 2.8 — Maintenance Request (Report a Repair)

**What this is:**
Something broken? Use this form to report it. The manager assigns a tradesperson (vendor) to fix it.

**How to submit:**

1. Click **Request Repair** from your dashboard
2. Fill in the form:
   - **Category:** Plumbing / Electrical / HVAC / Structural / Other
   - **Urgency:** Low / Medium / High / Emergency
   - **Title:** Short description (e.g. "Leaking kitchen tap")
   - **Details:** Full description of the problem
   - **Photos:** Optional — attach pictures (requires Cloudinary config)
   - **Access Time:** When is it OK for someone to visit?
3. Click **Submit Request**
4. Your request appears in "Track a Maintenance Request" on your dashboard

**Screenshots:**

- Maintenance list: `docs/screenshots/tenant_04_maintenance_list_desktop.png`

![Tenant 04 Maintenance List Desktop](screenshots/tenant_04_maintenance_list_desktop.png)

- Create modal: `docs/screenshots/tenant_05_create_maintenance_modal_desktop.png`

![Tenant 05 Create Maintenance Modal Desktop](screenshots/tenant_05_create_maintenance_modal_desktop.png)

- Maintenance form: `docs/screenshots/tenant_09_maintenance_form_desktop.png`

![Tenant 09 Maintenance Form Desktop](screenshots/tenant_09_maintenance_form_desktop.png)

- Legacy: `docs/screenshots/tenant_05_maintenance_request.png`

![Tenant 05 Maintenance Request](screenshots/tenant_05_maintenance_request.png)

> **Cross-reference:** Manager sees this in their Maintenance Board → Section 4, Step 4.7

---

## Step 2.9 — Messages

**What this is:**
A built-in messaging system connecting you directly with your property manager (and landlord). One conversation thread per tenancy — created automatically the first time you message.

**How to use:**

1. Click **Messages** in sidebar or **Message Manager** quick action on dashboard
2. The conversation thread opens
3. Type your message at the bottom
4. Press **Enter** or click ➤ to send
5. Manager sees your message in real time

**Screenshots:**

- Inbox: `docs/screenshots/tenant_07_messages.png`

![Tenant 07 Messages](screenshots/tenant_07_messages.png)

- Typing: `docs/screenshots/tenant_msg_typing.png`

![Tenant Msg Typing](screenshots/tenant_msg_typing.png)

- Message sent: `docs/screenshots/tenant_msg_sent.png`

![Tenant Msg Sent](screenshots/tenant_msg_sent.png)

---

## Step 2.10 — Notifications

**What this is:**
A notification centre — keeps you informed about new invoices, maintenance updates, lease changes, and application status.

**How to access:** Click the 🔔 bell icon (top-right) or navigate from sidebar.

**Types of notifications:**

- 💰 "Your rent invoice for November is ready"
- ✅ "Your maintenance request has been assigned"
- 📄 "Your lease renewal is ready for signing"
- 🏠 "Your application has been approved"

**Screenshot:** `docs/screenshots/tenant_08_notifications.png`

![Tenant 08 Notifications](screenshots/tenant_08_notifications.png)

---

## Step 2.11 — Lease Documents

**What this is:**
View your lease agreements, digital signatures, addenda, and notices from your landlord or property manager.

**Screenshots:**

- Lease documents: `docs/screenshots/tenant_08_lease_documents_desktop.png`

![Tenant 08 Lease Documents Desktop](screenshots/tenant_08_lease_documents_desktop.png)

- Active lease breakdown: `docs/screenshots/tenant_07_lease_details_desktop.png`

![Tenant 07 Lease Details Desktop](screenshots/tenant_07_lease_details_desktop.png)

---

## Step 2.12 — Tenant AI Assistant

**What this is:**
An integrated AI chat assistant designed to answer tenant inquiries, explain Nigerian tenancy laws, draft maintenance issue descriptions, and clarify rent payment questions.

**What you see:**

- Chat interface with interactive prompt suggestions
- AI responses referencing real platform data and tenancy terms
- Direct link to initiate repair requests from AI suggestions

**Screenshot:** `docs/screenshots/tenant_06_ai_chat_desktop.png`

![Tenant 06 Ai Chat Desktop](screenshots/tenant_06_ai_chat_desktop.png)

---

# 🏗 SECTION 3: LANDLORD FLOW

> **Login:** `landlord@proplity.com` / `Password123!`
>
> **Who is this?** A property owner. They list their properties and delegate day-to-day management to a Property Manager, but want visibility into portfolio performance.

## Step 3.1 — Landlord Dashboard

**What this is:**
The bird's-eye view of the entire property portfolio — how many properties, how many tenants, revenue summary.

**What you see:**

- Portfolio summary: total properties, total units, occupied vs. vacant
- Revenue summary: monthly income vs expenses
- Recent activity feed
- Quick links to all sections

**Screenshots:**

- Desktop: `docs/screenshots/landlord_01_dashboard_desktop.png`

![Landlord 01 Dashboard Desktop](screenshots/landlord_01_dashboard_desktop.png)

- Overview variant: `docs/screenshots/landlord_01_dashboard_overview_desktop.png`

![Landlord 01 Dashboard Overview Desktop](screenshots/landlord_01_dashboard_overview_desktop.png)

- Legacy: `docs/screenshots/landlord_01_portfolio.png`

![Landlord 01 Portfolio](screenshots/landlord_01_portfolio.png)

---

## Step 3.2 — My Properties (Portfolio View)

**What this is:**
A full list of all properties the landlord owns and has listed on Proplity, with occupancy status.

**Screenshots:**

- Desktop list: `docs/screenshots/landlord_02_properties_desktop.png`

![Landlord 02 Properties Desktop](screenshots/landlord_02_properties_desktop.png)

- Alternative view: `docs/screenshots/landlord_02_properties_list_desktop.png`

![Landlord 02 Properties List Desktop](screenshots/landlord_02_properties_list_desktop.png)

- Property detail: `docs/screenshots/landlord_02_property_detail.png`

![Landlord 02 Property Detail](screenshots/landlord_02_property_detail.png)

---

## Step 3.3 — List a New Property (3-Step Wizard)

**What this is:**
How to add a new rental property to the platform so tenants can find and apply for it.

**Step 1 — Basic Information:**

- Property name, type (Flat, House, Commercial)
- Full address: street, area, city, state
- Description text
- Neighbourhood scores (you rate your area)
- Screenshot: `docs/screenshots/landlord_03_list_step1.png`

![Landlord 03 List Step1](screenshots/landlord_03_list_step1.png)

**Step 2 — Units & Amenities:**

- Number of units (if block of flats)
- Bedrooms, bathrooms, rent per unit
- Optional service charge
- Amenities checkboxes (power, water, security, internet)
- Screenshot: `docs/screenshots/landlord_04_list_step2.png`

![Landlord 04 List Step2](screenshots/landlord_04_list_step2.png)

**Step 3 — Photos & Publish:**

- Upload property photos and video walkthrough
- Preview your listing
- Click **Publish** to go live
- Screenshot: `docs/screenshots/landlord_05_list_step3.png`

![Landlord 05 List Step3](screenshots/landlord_05_list_step3.png)

**Additional screenshots:**

- Add property form (desktop): `docs/screenshots/landlord_03_add_property_desktop.png`

![Landlord 03 Add Property Desktop](screenshots/landlord_03_add_property_desktop.png)

- Unit management view: `docs/screenshots/landlord_04_unit_management_desktop.png`

![Landlord 04 Unit Management Desktop](screenshots/landlord_04_unit_management_desktop.png)

---

## Step 3.4 — Tenant Overview

**What this is:**
A page showing all tenants currently renting across all your properties.

**What you see:** Tenant name, unit, lease dates, payment status. Click any row for full details.

**Screenshots:**

- Tenant list: `docs/screenshots/landlord_06_tenants.png`

![Landlord 06 Tenants](screenshots/landlord_06_tenants.png)

- Tenant detail: `docs/screenshots/landlord_06_tenant_details_desktop.png`

![Landlord 06 Tenant Details Desktop](screenshots/landlord_06_tenant_details_desktop.png)

---

## Step 3.5 — Applicant Screening

**What this is:**
All rental applications submitted to the landlord's properties — monitor who is applying.

**Screenshot:** `docs/screenshots/landlord_05_applicant_screening_desktop.png`

![Landlord 05 Applicant Screening Desktop](screenshots/landlord_05_applicant_screening_desktop.png)

> **Cross-reference:** The Property Manager handles approving/rejecting → Section 4, Step 4.6

---

## Step 3.6 — Financial Summary & Reports

**What this is:**
Overview of the landlord's financial position — rent collected, outstanding payments, expenses.

**Screenshots:**

- Financial dashboard: `docs/screenshots/landlord_07_financial_summary_desktop.png`

![Landlord 07 Financial Summary Desktop](screenshots/landlord_07_financial_summary_desktop.png)

- Maintenance costs: `docs/screenshots/landlord_07_maintenance.png`

![Landlord 07 Maintenance](screenshots/landlord_07_maintenance.png)

---

## Step 3.7 — Manager Invitation Codes

**What this is:**
Landlords generate special codes and share them with people they want to appoint as Property Managers. A manager needs this code when registering — it links them to your account.

**How it works:**

1. Navigate to the Manager Codes section
2. Click **Generate New Code**
3. Share the code with the person you want as manager (WhatsApp, email, etc.)
4. When they register as "Property Manager", they paste your code in the form
5. They appear in your manager list automatically

---

# 👔 SECTION 4: PROPERTY MANAGER FLOW

> **Login:** `manager@proplity.com` / `Password123!`
>
> **Who is this?** A professional who manages properties on behalf of landlords. They handle tenant applications, maintenance, rent collection, and vendor coordination.
>
> **Note:** Must have registered using a landlord's invitation code.

## Step 4.1 — Manager Dashboard

**What this is:**
The most information-dense dashboard in the platform. Shows everything the manager needs to run daily operations.

**What you see:**

- Stats: properties managed, active tenants, open maintenance tickets, pending applications
- Recent activity feed
- Quick access to all sections

**Screenshots:**

- Desktop: `docs/screenshots/manager_01_dashboard_desktop.png`

![Manager 01 Dashboard Desktop](screenshots/manager_01_dashboard_desktop.png)

- Desktop (metrics): `docs/screenshots/manager_01b_dashboard_metrics_desktop.png`

![Manager 01B Dashboard Metrics Desktop](screenshots/manager_01b_dashboard_metrics_desktop.png)

- Tablet (768px): `docs/screenshots/manager_01_dashboard_tablet.png`

![Manager 01 Dashboard Tablet](screenshots/manager_01_dashboard_tablet.png)

- Mobile (390px): `docs/screenshots/manager_01_dashboard_mobile.png`

![Manager 01 Dashboard Mobile](screenshots/manager_01_dashboard_mobile.png)

- Legacy: `docs/screenshots/manager_01_dashboard.png`

![Manager 01 Dashboard](screenshots/manager_01_dashboard.png)

---

## Step 4.2 — Properties List (Manager's View)

**What this is:**
All properties the manager is responsible for, with occupancy status and key metrics.

**Screenshots:**

- Desktop: `docs/screenshots/manager_02_properties_list_desktop.png`

![Manager 02 Properties List Desktop](screenshots/manager_02_properties_list_desktop.png)

- Legacy: `docs/screenshots/manager_02_discover.png`

![Manager 02 Discover](screenshots/manager_02_discover.png)

---

## Step 4.3 — Property Detail (Manager's View)

**What this is:**
Detailed view of a single property — all units, who's in them, vacancy status, and ability to edit property details.

**What you can do:**

- See all units (occupied / vacant)
- Click a unit to see its history
- Edit property info and amenities

**Screenshots:**

- Property detail: `docs/screenshots/manager_04_property_detail_desktop.png`

![Manager 04 Property Detail Desktop](screenshots/manager_04_property_detail_desktop.png)

- Add property modal: `docs/screenshots/manager_03_add_property_modal_desktop.png`

![Manager 03 Add Property Modal Desktop](screenshots/manager_03_add_property_modal_desktop.png)

---

## Step 4.4 — Adding a Tenant (Direct Invite — 3 Steps)

**What this is:**
When a unit is ready, the manager can directly invite a tenant via email, bypassing the online application process.

**Step 1 — Select Unit & Tenant:**

- Choose property and unit
- Enter tenant's email (they receive an invitation)
- Set monthly rent and any service charge
- Screenshot: `docs/screenshots/manager_03_add_tenant_step1.png`

![Manager 03 Add Tenant Step1](screenshots/manager_03_add_tenant_step1.png)

**Step 2 — Configure the Lease:**

- Set start and end dates
- Payment schedule (monthly, quarterly)
- Special terms
- Screenshot: `docs/screenshots/manager_04_add_tenant_step2.png`

![Manager 04 Add Tenant Step2](screenshots/manager_04_add_tenant_step2.png)

**Step 3 — Review & Send:**

- Review all terms
- Click **Send Invite** — tenant gets an email to accept and set a password
- Screenshot: `docs/screenshots/manager_05_add_tenant_step3.png`

![Manager 05 Add Tenant Step3](screenshots/manager_05_add_tenant_step3.png)

**Modal view:** `docs/screenshots/manager_06_add_tenant_modal_desktop.png`

![Manager 06 Add Tenant Modal Desktop](screenshots/manager_06_add_tenant_modal_desktop.png)

---

## Step 4.5 — Tenant Management List

**What this is:**
Full list of all current and past tenants. Where daily tenant management happens.

**What you can do:**

- View profiles, payment history, lease details
- Send invoices manually
- Record payments
- Issue lease renewal or termination notices

**Screenshots:**

- Tenant list: `docs/screenshots/manager_05_tenants_list_desktop.png`

![Manager 05 Tenants List Desktop](screenshots/manager_05_tenants_list_desktop.png)

- Legacy: `docs/screenshots/manager_06_tenants_list.png`

![Manager 06 Tenants List](screenshots/manager_06_tenants_list.png)

---

## Step 4.6 — Reviewing Tenant Applications (4-Stage Approval)

**What this is:**
When a tenant applies online, it lands in the manager's queue. The manager reviews, approves or rejects, creates the lease, and activates it.

**Stage 1 — Review Pending Applications:**

- View tenant profile, employment info, ID document
- Screenshot: `docs/screenshots/manager_review_01_pending_applications.png`

![Manager Review 01 Pending Applications](screenshots/manager_review_01_pending_applications.png)

**Stage 2 — Approve the Application:**

- Click "Approve" to accept the tenant
- Screenshot: `docs/screenshots/manager_review_02_application_approved.png`

![Manager Review 02 Application Approved](screenshots/manager_review_02_application_approved.png)

**Stage 3 — Create the Tenancy:**

- Set lease dates, rent, service charge
- Screenshot: `docs/screenshots/manager_review_03_create_tenancy.png`

![Manager Review 03 Create Tenancy](screenshots/manager_review_03_create_tenancy.png)

**Stage 4 — Activate the Lease:**

- Send for e-signatures from both parties. Once both sign, lease activates.
- Screenshot: `docs/screenshots/manager_review_04_activate_lease.png`

![Manager Review 04 Activate Lease](screenshots/manager_review_04_activate_lease.png)

> **Cross-reference:** Tenant signs the lease → Section 2, Step 2.2

---

## Step 4.7 — Maintenance Board (Kanban View)

**What this is:**
The manager's maintenance control centre — a Kanban-style board (like Trello) showing all repair requests organised by status.

**Kanban columns:**

- **New** — freshly submitted, not yet assigned
- **In Progress** — vendor assigned, work underway
- **Resolved** — work done, awaiting tenant confirmation
- **Closed** — fully done

**How the manager uses it:**

1. New ticket appears in "New" column
2. Manager reviews and clicks **Assign Vendor**
3. Select the right vendor from the dropdown (e.g., plumber for water issue)
4. Vendor receives a notification
5. Status moves through the board as work progresses

**Screenshots:**

- Kanban board (desktop): `docs/screenshots/manager_07_maintenance_desktop.png`

![Manager 07 Maintenance Desktop](screenshots/manager_07_maintenance_desktop.png)

- Ticket detail: `docs/screenshots/manager_08_maintenance_detail_desktop.png`

![Manager 08 Maintenance Detail Desktop](screenshots/manager_08_maintenance_detail_desktop.png)

- Legacy: `docs/screenshots/manager_07_maintenance.png`

![Manager 07 Maintenance](screenshots/manager_07_maintenance.png)

> **Cross-reference:** Vendor sees their assigned jobs → Section 5, Step 5.1

---

## Step 4.8 — Financial Overview (Manager)

**What this is:**
All financial activity across the manager's properties — rent collected, outstanding invoices, payment history per tenant.

**Screenshot:** `docs/screenshots/manager_09_financials_desktop.png`

![Manager 09 Financials Desktop](screenshots/manager_09_financials_desktop.png)

---

## Step 4.9 — Messages (Manager)

**What this is:**
The manager's messaging inbox — shows conversations with all tenants and the landlord.

**Screenshot:** `docs/screenshots/manager_08_messages.png`

![Manager 08 Messages](screenshots/manager_08_messages.png)

---

## Step 4.10 — AI Assistant (Manager)

**What this is:**
A built-in AI chat assistant for property management questions, drafting notices, and platform guidance.

> **Note:** Currently uses a demo/mock interface. Full AI requires additional backend configuration.

**Screenshot:** `docs/screenshots/manager_10_ai_assistant_desktop.png`

![Manager 10 Ai Assistant Desktop](screenshots/manager_10_ai_assistant_desktop.png)

---

# 🔧 SECTION 5: VENDOR / SERVICE PROVIDER FLOW

> **Login:** `vendor@proplity.com` / `Password123!`
>
> **Who is this?** A tradesperson or service company (plumber, electrician, AC technician) who receives and fulfils maintenance jobs assigned by property managers.

## Step 5.1 — Vendor Dashboard

**What this is:**
Home screen showing all maintenance jobs assigned to this vendor.

**What you see:**

- Job cards: property address, tenant name, problem description, urgency level
- Job status: New / In Progress / Completed
- Total jobs completed, invoices submitted

**Screenshots:**

- Desktop: `docs/screenshots/vendor_01_dashboard_desktop.png`

![Vendor 01 Dashboard Desktop](screenshots/vendor_01_dashboard_desktop.png)

- Ticket list: `docs/screenshots/vendor_02_ticket_list_desktop.png`

![Vendor 02 Ticket List Desktop](screenshots/vendor_02_ticket_list_desktop.png)

- Legacy: `docs/screenshots/vendor_01_dashboard.png`

![Vendor 01 Dashboard](screenshots/vendor_01_dashboard.png)

---

## Step 5.2 — Job Detail View

**What this is:**
Full details of a single maintenance job — what needs fixing, where, when, and any photos from the tenant.

**What you see:**

- Full problem description
- Tenant photos of the issue
- Property address and unit number
- Preferred access time
- Job timeline/history
- **Update Status** button (move job from In Progress → Completed)

**Screenshots:**

- Job detail: `docs/screenshots/vendor_02_job_detail_desktop.png`

![Vendor 02 Job Detail Desktop](screenshots/vendor_02_job_detail_desktop.png)

- Ticket details: `docs/screenshots/vendor_03_ticket_details_desktop.png`

![Vendor 03 Ticket Details Desktop](screenshots/vendor_03_ticket_details_desktop.png)

- Status update: `docs/screenshots/vendor_04_ticket_update_desktop.png`

![Vendor 04 Ticket Update Desktop](screenshots/vendor_04_ticket_update_desktop.png)

- Legacy: `docs/screenshots/vendor_02_job_detail.png`

![Vendor 02 Job Detail](screenshots/vendor_02_job_detail.png)

---

## Step 5.3 — Submit an Invoice

**What this is:**
After completing a job, the vendor submits an itemised invoice to the manager for payment.

**Steps:**

1. Open a completed job
2. Click **Create Invoice** or **Submit Invoice**
3. Add line items (e.g., "Labour – 3 hours", "Replacement pipe fitting")
4. Total is calculated automatically
5. Click **Submit Invoice** → manager receives it for approval

**Screenshot:** `docs/screenshots/vendor_03_create_invoice.png`

![Vendor 03 Create Invoice](screenshots/vendor_03_create_invoice.png)

---

## Step 5.4 — Messages (Vendor)

**What this is:**
Direct messaging with the property manager — for clarifying job details, requesting access, or following up on payment.

**Screenshot:** `docs/screenshots/vendor_04_messages.png`

![Vendor 04 Messages](screenshots/vendor_04_messages.png)

---

# 🛡 SECTION 6: ADMIN FLOW

> **Login:** `admin@proplity.com` / `Password123!`
>
> **Who is this?** The platform system administrator — sees all users, properties, transactions, and audit logs.
>
> **Note:** Admin navigates to `/admin`, not `/dashboard`.

## Step 6.1 — Admin Overview (Dashboard)

**What this is:**
Platform-wide statistics and health — the admin sees everything from one screen.

**What you see:**

- Total users, active tenants, listed properties, transactions
- System health indicators
- Recent platform events
- Navigation sidebar to all admin sections

**Screenshot:** `docs/screenshots/admin_01_overview.png`

![Admin 01 Overview](screenshots/admin_01_overview.png)

---

## Step 6.2 — User Management

**What this is:**
A searchable table of every registered user on the platform. The admin can manage any account.

**What the admin can do:**

- Search by name, email, or role
- View a user's full profile and activity history
- Suspend or re-activate an account
- Change a user's role

**Screenshot:** `docs/screenshots/admin_02_users.png`

![Admin 02 Users](screenshots/admin_02_users.png)

---

## Step 6.3 — Properties Moderation Queue

**What this is:**
Every new property listing from a landlord goes through admin review before publishing publicly.

**Admin action:**

- Review listing details and photos
- **Approve** → goes live on the platform
- **Reject** → listing hidden, landlord notified with a reason

**Screenshot:** `docs/screenshots/admin_06_properties.png`

![Admin 06 Properties](screenshots/admin_06_properties.png)

---

## Step 6.4 — Reports & Analytics

**What this is:**
Platform-wide reporting — properties listed, active tenants, revenue, maintenance volumes, and more.

**Screenshot:** `docs/screenshots/admin_03_reports.png`

![Admin 03 Reports](screenshots/admin_03_reports.png)

---

## Step 6.5 — Security & Audit Logs

**What this is:**
A chronological log of every significant action on the platform — used for security investigations.

**What you see:**

- Timestamp, user email, role
- Action taken (e.g., "Updated Lease #123", "Failed login from IP 102.89.x.x")
- IP address

**Screenshot:** `docs/screenshots/admin_05_notifications.png`

![Admin 05 Notifications](screenshots/admin_05_notifications.png)

---

## Step 6.6 — Platform Settings

**What this is:**
System-wide configuration — feature toggles, payment settings, email template configuration.

**Screenshot:** `docs/screenshots/admin_04_settings.png`

![Admin 04 Settings](screenshots/admin_04_settings.png)

---

# 🔀 CROSS-ROLE LIFECYCLE: FULL TENANT APPLICATION → ACTIVE LEASE

This shows how all roles work together in sequence for the platform's most important workflow.

```
TENANT                          MANAGER                         SYSTEM
  │                                │                               │
  ├─ Browses properties            │                               │
  ├─ Schedules viewing ──────────► ├─ Receives viewing request     │
  │                                ├─ Confirms viewing time        │
  │                                │                               │
  ├─ Submits application ────────► ├─ Reviews application          │
  │                                ├─ Approves / Rejects           │
  │  ◄── Notification ────────────┤                               │
  │                                ├─ Creates lease agreement      │
  │                                │                               ├─ Sends e-sign to both
  ├─ Signs lease digitally         │                               │
  │ ──────────────────────────────►│                               ├─ Lease → ACTIVE
  │                                │                               │
  │  ◄── Rent invoice ─────────────┼───────────────────────────────┤ (monthly auto-generated)
  ├─ Pays rent via Paystack        │                               │
  │ ──────────────────────────────►│                               ├─ Payment recorded
  │                                │                               │
  ├─ Reports a repair ────────────►├─ Assigns to VENDOR            │
  │                                │       │                       │
  │                                │   VENDOR completes job        │
  │                                │   VENDOR submits invoice      │
  │                                │                               │
  │  ◄── Repair confirmed ─────────┤                               │
```

---

# 📱 RESPONSIVE DESIGN SUMMARY

Proplity works on all screen sizes:

| Breakpoint  | Width  | Device                 |
| :---------- | :----- | :--------------------- |
| **Desktop** | 1400px | Monitor / workstation  |
| **Laptop**  | 1280px | Standard laptop        |
| **Tablet**  | 768px  | iPad (portrait)        |
| **Mobile**  | 390px  | iPhone 14 / smartphone |

Multi-resolution screenshots captured for:
Homepage, Login, Registration, Property detail, Tenant dashboard, Schedule viewing modal, Manager dashboard (desktop + tablet + mobile), Vendor dashboard.

---

_Generated: 2026-10-04 · Proplity v0.1.0 · Screenshots at 1400×900 desktop unless labelled_
