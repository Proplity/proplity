# Proplity — Role-by-Role Step-by-Step Operational & Testing Guide

**Comprehensive visual walkthrough with high-resolution interface captures across all platform personas, including the complete Tenant Application → Manager Approval lifecycle and interactive in-app messaging.**

---

## Document Metadata

- **Platform:** Proplity (AI-Powered Nigerian Property Management Platform)
- **Document Version:** 2.1 (Updated with Full Application Approval Lifecycle & Real-Time UI Messaging)
- **Environments Covered:** Local (`http://localhost:3099`), Staging / Production (`https://proplity-ecru.vercel.app`)
- **Default Test Password:** `Password123!` (Uniform across all seeded test accounts)

---

## Quick Reference: Role Accounts & Primary Duties

| Role                 | Test Email              | Default Password | Primary Platform Focus                                                                |
| :------------------- | :---------------------- | :--------------- | :------------------------------------------------------------------------------------ |
| **Visitor / Public** | _Unauthenticated_       | N/A              | Property search, featured listings, viewing requests, applications                    |
| **Tenant**           | `tenant@proplity.com`   | `Password123!`   | Tenancy oversight, rental application, rent payment, messaging                        |
| **Landlord**         | `landlord@proplity.com` | `Password123!`   | Portfolio monitoring, listing creation, revenue, tenant overview                      |
| **Property Manager** | `manager@proplity.com`  | `Password123!`   | Daily operations, reviewing/approving applications, lease activation, vendor dispatch |
| **Vendor**           | `vendor@proplity.com`   | `Password123!`   | Assigned job fulfillment, job tracking, itemized invoice submission                   |
| **Administrator**    | `admin@proplity.com`    | `Password123!`   | System analytics, user accounts, platform governance, reports                         |

---

## 1. Visitor / Public Flow (Unauthenticated)

### Step 1.1: Browse the Public Portal & Hero Section

- **Location:** `/`
- **Actions:** Visit the homepage to discover featured rental opportunities across major Nigerian cities (Lagos, Abuja, Port Harcourt). Filter by property type, rent range, and state.
- **Visual Capture:** `docs/screenshots/visitor_01_homepage.png`

### Step 1.2: Interactive Property Preview Modal

- **Location:** Homepage Featured Carousel
- **Actions:** Click directly on any property preview card. A modal overlay opens displaying full photos, bedroom/bathroom specs, square footage, security/power ratings, and monthly/annual rent.
- **Visual Capture:** `docs/screenshots/visitor_02_property_modal.png`

### Step 1.3: Deep Property Details & Neighborhood Metrics

- **Location:** `/properties/[id]`
- **Actions:** View room-by-room photos, comprehensive amenity badges (24/7 solar/generator power, borehole water, security gatehouse), and neighborhood scores (Safety, Flood Risk, Road Infrastructure).
- **Visual Capture:** `docs/screenshots/visitor_03_property_detail.png`

### Step 1.4: Sign In

- **Location:** `/login`
- **Actions:** Enter credentials. Features instant links for password reset and email verification resend.
- **Visual Capture:** `docs/screenshots/visitor_04_login.png`

### Step 1.5: User Registration

- **Location:** `/register`
- **Actions:** Sign up by selecting account type (Tenant, Landlord, Manager, or Vendor) and providing name, email, phone number, and password.
- **Visual Capture:** `docs/screenshots/visitor_05_signup.png`

---

## 2. Tenant Role Flow (Including Self-Registration, Application & Messaging)

- **Login:** `tenant@proplity.com` / `Password123!`
- **Alternate Accounts:** `adewale.j@email.com`, `tunde@email.com`, `chioma.tenant@proplity.com`

### Step 2.0: Tenant Self-Registration Flow

- **Location:** `/register`
- **Flow Steps:**
  1. **Select Account Type:** Pick Tenant role from the role options card (`tenant_reg_01_select_role.png`).
  2. **Personal & Employment Details:** Fill out legal name, email, Nigerian phone number, state of residence (Lagos), occupation (Senior Product Designer), employer (Fintech Africa), and secure password (`tenant_reg_02_form.png`).
  3. **Verification Notification:** Confirm account dispatch notification (`tenant_reg_03_notice.png`).
  4. **Email Activation Link:** Follow email verification link to `/verify-email?token=...` and click Activate Account (`tenant_reg_04_verified.png`).
  5. **Welcome Dashboard Landing:** First-time login lands on resident portal with welcome notification, quick actions, and vacant property browsing (`tenant_reg_05_welcome_dashboard.png`).

### Step 2.1: Resident Dashboard (Active Lease)

- **Location:** `/dashboard`
- **Actions:** Review active tenancy, lease validity dates, monthly/annual rent commitments, and upcoming due dates.
- **Visual Capture:** `docs/screenshots/tenant_01_dashboard.png`

### Step 2.2: Discover & Browse Properties

- **Location:** `/dashboard/discover` (Verified Route)
- **Actions:** Search and filter active, verified properties across Nigeria. View rent rates, location badges, and property specifications.
- **Visual Capture:** `docs/screenshots/tenant_02_browse.png`

### Step 2.3: In-Dashboard Property Showcase & Virtual Tour

- **Location:** `/dashboard/properties/[id]`
- **Actions:** View high-resolution photo gallery, 360° virtual tour, specifications (4 Bed, 4 Bath, 2,800 sq ft), neighborhood intelligence scores, and rental booking/application card directly inside the dashboard.
- **Visual Capture:** `docs/screenshots/tenant_dashboard_property_detail.png`

### Step 2.4: Complete Rental Application Process (Profile Gate + 3 Steps)

- **Location:** `/dashboard/properties/[id]/apply`
- **Flow Steps:**
  1. **Property Showcase:** View Eko Atlantic Penthouse inside dashboard (`tenant_dashboard_property_detail.png`).
  2. **Complete-Profile Gate:** Tenants with an incomplete profile are redirected to `/dashboard/profile/complete` before the application form ever renders. Phone, year of birth, emergency contact (name/relationship/phone), and an ID document upload are required; previous landlord details are optional (`tenant_apply_00_complete_profile.png`).
  3. **Step 1 — Applicant (read-only):** Name, email, phone, and year of birth are prefilled from the now-complete profile and shown read-only, with an "Edit" link back to the profile form instead of re-entering them (`tenant_apply_02_step1_personal.png`).
  4. **Step 2 — Employment & Move-in:** Employment status, employer, job title, monthly income, employment duration, move-in date, and pets. Lease duration and number-of-occupants fields were removed — the lease term is set by the manager at tenancy creation, not requested from the applicant (`tenant_apply_03_step2_employment.png`).
  5. **Step 3 — Review & Submit:** Reason for moving, additional notes, and the terms agreement. This step replaces the old separate References and Documents steps — references now live on the tenant profile and bank statement/proof of income/employment letter uploads were dropped entirely (`tenant_apply_04_step3_review.png`).
  6. **Submission Confirmation:** Form submitted successfully; application enters `PENDING` status for property manager evaluation (`tenant_apply_06_submitted_confirmation.png`).

### Step 2.5: Maintenance & Repair Request Submission

- **Location:** `/dashboard/tenant-maintenance` or _Request Repair_ modal
- **Actions:** Select issue category (Plumbing, Electrical, HVAC, Structural, Other), define urgency, enter issue description, attach photos, and specify access availability.
- **Visual Capture:** `docs/screenshots/tenant_05_maintenance_request.png`

### Step 2.6: Online Rent Payment via Paystack Gateway

- **Location:** `/dashboard` → Paystack Checkout Modal → `/dashboard/payment-history`
- **Flow Steps:**
  1. **Initiating Payment from Resident Dashboard:** Tenant views the **Payment Information** card on the resident dashboard showing the upcoming rent invoice (₦150,000 for October 2026 rent, due in 5 days) alongside total outstanding balance (₦167,737.50). The tenant clicks the blue **"Pay Rent Online"** action button (`tenant_payment_01_initiate.png`).
  2. **Paystack Hosted Checkout Gateway:** The application calls `/api/v1/payments/initialize` and opens the Paystack checkout modal. The modal displays the payment amount (₦150,000), tenant email (`tenant@proplity.com`), multi-channel payment options (Debit/Credit Card, Bank Transfer, USSD), and prefilled test credentials. Clicking **"Pay ₦150,000"** simulates instant payment completion (`tenant_payment_02_paystack_checkout.png`).
  3. **Webhook Verification & Settlement Confirmation:** Paystack delivers the `charge.success` webhook which automatically settles the invoice in PostgreSQL. The tenant is redirected back to the payment ledger (`/dashboard/payment-history`) with a confirmation toast (_"Payment successful (test mode) — webhook delivered."_). The ledger updates total paid metrics (₦3,695,000 total paid, 67% on-time) and displays the new settled transaction row with a green `Paid` status badge and transaction reference (`tenant_payment_03_payment_success.png`).

### Step 2.7: Payment History & Invoicing

- **Location:** `/dashboard/payment-history`
- **Actions:** Review past payment receipts with separate, dedicated **Period** (calendar billing cycle, e.g. Oct 2026) and **Description** (line-item details, repair parts, and notes) columns. Track status, method, and transaction references.
- **Visual Capture:** `docs/screenshots/tenant_04_payment_history.png`

### Step 2.8: Interactive In-App Messaging via UI

- **Location:** `/dashboard/messages`
- **Live Behavior:**
  1. **Conversation History:** Active conversation thread with manager Alex Vance displays previous chat history and timestamps (`tenant_07_messages.png`).
  2. **Typing Message:** User types in the input field: _"Hello Alex, I also wanted to check if there are any specific visitor parking regulations I should be aware of?"_ (`tenant_msg_typing.png`).
  3. **Real-Time Delivery:** Clicking **Send** immediately renders the blue resident speech bubble with delivery timestamp (`tenant_msg_sent.png`).

### Step 2.9: Notifications & Alerts Center

- **Location:** `/dashboard/notifications`
- **Actions:** Review real-time system alerts including maintenance status transitions and payment confirmations.
- **Visual Capture:** `docs/screenshots/tenant_08_notifications.png`

---

## 3. Landlord (Property Owner) Flow

- **Login:** `landlord@proplity.com` / `Password123!`

### Step 3.1: Portfolio Command Dashboard

- **Location:** `/dashboard`
- **Visual Capture:** `docs/screenshots/landlord_01_portfolio.png`

### Step 3.2: Property & Unit Drilldown

- **Location:** `/dashboard/properties/[id]`
- **Visual Capture:** `docs/screenshots/landlord_02_property_detail.png`

### Step 3.3: Listing a Property (Step 1: General Info)

- **Location:** `/dashboard/properties/new`
- **Visual Capture:** `docs/screenshots/landlord_03_list_step1.png`

### Step 3.4: Listing a Property (Step 2: Units, Specifications & Pricing)

- **Location:** `/dashboard/properties/new` (Step 2)
- **Actions:** Each unit is its own card (bedrooms, bathrooms, size, rent amount, service charge, rent frequency, and a computed "Total per cycle" line). Mixed-unit buildings — e.g. a mix of studios and 2-bedroom flats — are supported by clicking **+ Add Another Unit** to add independent unit cards, each submitted as its own `Unit` record. Submission is sequential per unit (no bulk-create endpoint), with per-unit status and a Retry option if any individual unit creation fails.
- **Visual Capture:** `docs/screenshots/landlord_04_list_step2.png`

### Step 3.5: Listing a Property (Step 3: Media Upload & Submission)

- **Location:** `/dashboard/properties/new` (Step 3)
- **Visual Capture:** `docs/screenshots/landlord_05_list_step3.png`

### Step 3.6: Tenants Directory & Lease Tracking

- **Location:** `/dashboard/tenants`
- **Visual Capture:** `docs/screenshots/landlord_06_tenants.png`

### Step 3.7: Portfolio Maintenance Oversight

- **Location:** `/dashboard/maintenance`
- **Visual Capture:** `docs/screenshots/landlord_07_maintenance.png`

---

## 4. Property Manager Flow (Including Application Review & Approval)

- **Login:** `manager@proplity.com` / `Password123!`

### Step 4.1: Manager Command Center

- **Location:** `/dashboard`
- **Visual Capture:** `docs/screenshots/manager_01_dashboard.png`

### Step 4.2: Property Marketing & In-App Ad Campaigns

- **Location:** `/dashboard/discover`
- **Visual Capture:** `docs/screenshots/manager_02_discover.png`

### Step 4.3: Full Process: Reviewing & Approving Tenant Application

- **Location:** `/dashboard/properties/[id]` → `/dashboard/tenants/add`
- **Lifecycle Sequence:**
  1. **View Pending Applications:** Manager navigates to property detail page. Under **Rental Applications**, the applicant (Jordan Hayes, Unit PH1) is listed with **Approve** and **Reject** buttons (`manager_review_01_pending_applications.png`).
  2. **Approve Application:** Manager clicks **Approve**. The application status updates to `APPROVED` (`manager_review_02_application_approved.png`).
  3. **Create Tenancy:** Manager links approved tenant Jordan Hayes to the vacant unit, configuring agreed rent and lease dates (`manager_review_03_create_tenancy.png`).
  4. **Tenancy Activation:** Tenancy created in `PENDING` status; manager clicks **Activate Lease** to formally mark unit as Occupied (`manager_review_04_activate_lease.png`).

### Step 4.3b: Alternative Path — Standalone Add Tenant Wizard (Lease Details & Service Charge)

- **Location:** `/dashboard/tenants/add` (Step 3: Lease Details)
- **Actions:** Independently of the application-approval path above, a manager can add a tenant directly. The Lease Details step now carries a dedicated **Service Charge** field alongside Rent Amount, combined into a "Total per cycle" figure — billed as its own separate `SERVICE_CHARGE` invoice line, never merged into rent. The previous **Security Deposit** and **Agency Fee** fields were removed (the latter was already dead — collected but never submitted to the API).
- **Visual Capture:** `docs/screenshots/manager_05_add_tenant_step3.png`

### Step 4.4: Maintenance Management & Vendor Dispatch

- **Location:** `/dashboard/maintenance`
- **Visual Capture:** `docs/screenshots/manager_07_maintenance.png`

### Step 4.5: Manager Messaging Inbox & Reply via UI

- **Location:** `/dashboard/messages`
- **Actions:** Manager reviews incoming questions and sends replies directly from the UI (`manager_08_messages.png`).

---

## 5. Vendor Flow

- **Login:** `vendor@proplity.com` / `Password123!`
- **Dashboard:** `docs/screenshots/vendor_01_dashboard.png`
- **Job Details:** `docs/screenshots/vendor_02_job_detail.png`
- **Itemized Invoicing:** `docs/screenshots/vendor_03_create_invoice.png`
- **Job Coordination Messaging:** `docs/screenshots/vendor_04_messages.png`

---

## 6. Administrator Flow

- **Login:** `admin@proplity.com` / `Password123!`
- **Overview:** `docs/screenshots/admin_01_overview.png`
- **User Management:** `docs/screenshots/admin_02_users.png`
- **Reports:** `docs/screenshots/admin_03_reports.png`
- **Platform Settings:** `docs/screenshots/admin_04_settings.png`
- **Notifications:** `docs/screenshots/admin_05_notifications.png`

### Step 6.6: Properties Moderation Queue

- **Location:** `/admin/properties`
- **Actions:** New sidebar tab closing a previously-missing gap — admins land here to review newly listed properties (status filter chips: All/Pending Review/Approved/Rejected/Flagged, defaulting to Pending Review), search by name/address/manager, and open a property for approval. The System Overview dashboard's attention-items list now also links pending properties directly here.
- **Visual Capture:** `docs/screenshots/admin_06_properties.png`
