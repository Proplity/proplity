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

# 📋 COMPLETE MASTER FEATURE DIRECTORY (EVERY FEATURE IN PROPLITY)

> **Overview:** An exhaustive, granular index of all 154 built and verified features, workflows, controls, and background processes in Proplity, organized across 12 functional domains.

### Summary Metrics

- **154** Verifiable Features & Controls
- **94** Production REST API Route Handlers
- **43** PostgreSQL Prisma Schema Models
- **10** Scheduled Idempotent Background Workers
- **101** Database B-Tree Performance Indexes
- **6** User Roles (Tenant, Landlord, Manager, Vendor, Admin, Visitor)

---

### Domain 1: Public Discovery, Listings & Visitor Experience (15 Features)

1. **Dynamic Homepage Hero & Portfolio Metrics**: Live stats, value proposition, and role-based CTA buttons (\`/\`, \`LandingPage.tsx\`).
2. **Instant Role-Aware Navigation**: Root layout session extraction passes user into auth context without flash or latency (\`RootLayout\`, ISS-057).
3. **Multi-Criteria Property Search & Filters**: Search by city, state, price range, bedrooms, bathrooms, and property type (\`PropertyDiscovery.tsx\`).
4. **Nigerian Metro Location Targeting**: Fast location matching across Lekki, Victoria Island, Ikeja, Yaba, Abuja, and Port Harcourt.
5. **Interactive Quick-Preview Property Modal**: Pop-up card with photo gallery and arrow navigation (\`FeaturedPropertyModal.tsx\`).
6. **Full Listing Page with Metadata & OpenGraph**: SEO-optimized canonical property detail view (\`/properties/[id]\`, \`PublicPropertyDetail.tsx\`).
7. **Unlimited Photo Gallery Display (+N Toggle)**: Full photo gallery with "+N more" expander toggle (\`Property.photoUrls\`, ISS-014).
8. **360° Virtual Tour & Video Tour Embedding**: Direct integration of 360-degree virtual tours and video walkthroughs (\`Property.virtualTourUrl\`).
9. **Neighborhood Quality Metrics & Radar Ratings**: Scored breakdown (0-10) for Safety, Flood Risk, Roads, Power, Water, and Schools (\`NeighbourhoodReport.tsx\`, ISS-016).
10. **Dynamic Property Trust Score Badge**: Algorithmic trust rating badge computed daily by background workers (\`Property.trustScore\`, ISS-013).
11. **Inspection Viewing Booking**: Interactive calendar picker with morning/afternoon slots for on-site property visits (\`ScheduleViewing.tsx\`).
12. **Dedicated Role Landing Pages**: Informational landing pages for Landlords (\`/for-landlords\`), Tenants (\`/for-tenants\`), and Service Providers (\`/for-vendors\`).
13. **Tiered Subscription Pricing Matrix**: Transparent plan comparison table for Free, Starter, Pro, and Enterprise tiers (\`/pricing\`).
14. **Platform Inquiries & Contact Form**: Validated platform contact and support submission form (\`/contact\`, \`ContactPage.tsx\`).
15. **Interactive Platform Guide**: Visual role-by-role guide with 100+ interactive fullscreen screenshots (\`/proplity-guide\`).

---

### Domain 2: Authentication, Authorization & Account Security (20 Features)

16. **Multi-Role Self-Registration**: Dedicated registration workflows for Tenants, Landlords, Managers, and Vendors (\`/register\`).
17. **Admin Self-Registration Lockout**: Registration endpoint strictly forbids ADMIN creation; admin requires setup bootstrap.
18. **Two-Step Landlord Onboarding**: Frictionless signup without demanding upfront banking or property entries (ADR-0002).
19. **Case-Insensitive Email Canonicalization**: Lowercases emails across registration, login, and queries, preventing duplicate accounts (ISS-002, ADR-0006).
20. **Cryptographic Email Verification**: Single-use 32-byte hex token links required before initial login is permitted (\`/verify-email\`).
21. **Rate-Limited Verification Resend**: Throttled resend verification links with anti-enumeration protection (\`POST /api/v1/auth/resend-verification\`).
22. **Anti-Enumeration Password Recovery**: Identical generic confirmation message whether or not the account exists (\`/forgot-password\`).
23. **Expiring Password Reset Tokens**: 60-minute time-limited cryptographic tokens invalidated on first use (\`/reset-password\`).
24. **In-App Authenticated Password Change**: Password change requiring verification of the current password before updating (\`POST /api/v1/auth/change-password\`).
25. **Edge-Compatible 15-Minute JWTs**: Stateless access tokens verified at edge proxies without database round-trips (\`lib/auth/jwt.ts\`).
26. **Rotating Refresh Token Families**: Opaque refresh tokens with \`familyId\` rotation; reuse detection revokes entire token family.
27. **Remember Me Variable Session Lifespans**: 30-day session with Remember Me vs. 1-day standard session.
28. **Device-Wide Logout Token Revocation**: Decodes token signatures on logout (even after expiry) to revoke server refresh sessions.
29. **Instant Account Suspension Enforcement**: Dynamic user status checks via \`withAuth\` immediately terminate suspended sessions.
30. **CSRF Origin & Custom Header Guard**: Validates SameSite request origins and \`x-csrf-token\` headers on state-modifying calls (\`lib/auth/csrf.ts\`).
31. **Sliding-Window DB Rate Limiter**: Advisory-locked sliding window limiter preventing burst-doubling and pruning stale logs (\`lib/auth/rateLimit.ts\`, ISS-021).
32. **Manager Invitation Code System**: Landlords generate single-use invite codes linking managers to their portfolios (\`ManagerInviteCode\`, ADR-0011).
33. **Manager Code Brute-Force Rate Limiting**: Dedicated rate limiting on public code checks (\`GET /api/v1/manager-codes/check\`).
34. **First-Run Super Admin Setup Wizard**: One-time bootstrap at \`/setup\` permanently locking itself after creating the first admin.
35. **Backslash Smuggling Open-Redirect Sanitizer**: Sanitizer blocking open-redirect attempts using backslash normalization (\`lib/safeRedirect.ts\`, ISS-058).

---

### Domain 3: Tenant Operations & Tenancy Experience (18 Features)

36. **Tenant Dashboard Command Center**: Unified overview displaying active lease terms, current unit, pending bills, and quick action shortcuts.
37. **Rent Payment Countdown & Due Alert**: Visual banner showing upcoming rent, overdue days, late fees, and direct Pay Now trigger.
38. **Online Rent Checkout**: Card, USSD, and bank transfer payment via Paystack checkout with real-time balance recalculation.
39. **Card Tokenization & Reusable Mandates**: Secure storage of payment authorization tokens (\`AutoPayMandate\`) for recurring rent charging (ISS-056).
40. **Automatic Rent Charging Background Worker**: Daily worker charging due invoices using saved mandate tokens (\`autopayCharger.ts\`, ISS-011).
41. **Offline Bank Transfer Proof Submission**: File upload and transaction metadata submission for offline bank deposits (\`/api/v1/bank-transfers\`, ISS-012).
42. **Bank Transfer Duplicate Reference Guard**: Prevents re-submitting previously registered transfer references (\`bankTransferService.ts\`, ISS-012).
43. **Transfer Reconciliation Status Tracker**: Real-time visibility into whether transfer proof is PENDING, APPROVED, or REJECTED with notes.
44. **Digital Lease Agreement Console**: View active and historical tenancy agreements, clauses, rent cycles, and deposit terms (\`/dashboard/rentals\`).
45. **In-Browser Digital E-Signature Execution**: Sign binding lease agreements online with digital signature image, timestamp, and IP logging.
46. **Itemized Payment Ledger & Digital Receipts**: Payment history with transaction references, method badges, and downloadable receipts.
47. **3-Step Structured Tenancy Application**: Form capturing personal identity, employer info, monthly income, and references (\`PropertyApplicationForm.tsx\`).
48. **Mandatory Profile Completion Verification Gate**: Enforced profile completion screen (\`/dashboard/profile/complete\`) before application submission.
49. **Identity Document Gateway Upload**: Secure upload of government IDs (NIN, Driver's License, Passport) behind private file gateway.
50. **Multi-Category Maintenance Ticket Filing**: Submit repair tickets with category selection, 4 urgency levels, photos, and access preferences.
51. **Maintenance Progress Tracking & Updates**: Live ticket timeline showing status transitions from Submitted -> Assigned -> In Progress -> Completed.
52. **Post-Repair 5-Star Satisfaction Rating**: Rate completed vendor repairs (1-5 stars) with written feedback for vendor performance scoring.
53. **Visitor Gate Pass Access Code Generator**: Generate single-use or time-bounded visitor access codes with customizable validity periods.

---

### Domain 4: Landlord Portfolio & Asset Management (15 Features)

54. **Landlord Executive Financial Dashboard**: Portfolio KPI overview: Total Properties, Occupancy Rate, Total Rent Roll, Revenue Collected, and Overdue Balances.
55. **Conditional First-Run Setup Banner**: Contextual banner alerting landlords only when required banking or property entries are missing (ISS-018).
56. **Multi-Property Portfolio Management View**: Catalog of all owned properties showing unit counts, occupancy percentage, and publication status.
57. **3-Step Property Creation Wizard**: Form-driven wizard (\`/dashboard/properties/new\`) supporting single-unit homes or multi-unit buildings.
58. **Service Charge Rate Configuration**: Configure recurring building service charges as a fixed Naira fee or percentage of annual rent.
59. **Property Photo Manager for Existing Listings**: Interactive modal to add, reorder, delete, and set cover photos on live listings (ISS-014).
60. **Address Duplicate Fingerprint Detection**: Computes SHA-256 address hash to warn landlords against accidental duplicate listings (ISS-025).
61. **Portfolio-Wide Tenant Directory**: Roster of all tenants living across owned buildings with lease dates, unit numbers, and payment status badges.
62. **Tenant Applicant Screening & Approvals**: Review employment verification, salaries, and references; approve or reject applicants with notifications.
63. **One-Click Lease Generation from Application**: Instantly convert an approved applicant into a binding tenancy agreement with pre-filled profile details.
64. **Server-Side Financial Breakdown Pages**: Detailed breakdown views (\`/dashboard/breakdown/[type]\`) totaling revenue and paging full data (ISS-049).
65. **Manager Invitation Code Dispatch**: Send customized email invitations to property managers; monitor active codes and deactivate anytime.
66. **Disbursement Bank Account Management**: Register and manage verified Nigerian bank accounts (NUBAN) for receiving rental payouts.
67. **Vendor Maintenance Payout Approvals**: Review and approve vendor repair invoices before disbursements are processed (ISS-012).
68. **Subscription Plan Management & Upgrades**: Manage platform tier subscriptions (Free, Starter, Pro), switch billing tiers with safe downgrade confirmations.

---

### Domain 5: Property Manager Operations & Tenancy Administration (18 Features)

69. **Manager Operations Command Center**: Daily task hub highlighting pending viewings, open repair tickets, expiring leases, and uncollected rent.
70. **Role-Scoped Assigned Properties Directory**: Property catalog strictly isolated to buildings where the manager is designated as Property.managerId.
71. **Property Detail Management Console**: In-depth console displaying all constituent units, condition reports, and equipment inventory.
72. **Direct Tenant Onboarding / Lease Invite**: Invite tenants by email (\`/dashboard/tenants/add\`); system creates lease and emails activation link.
73. **Tenant Detail & Tenancy Management**: Console per tenant displaying active lease, ledger, notices, and lease action tools.
74. **Official Legal Tenancy Notices**: Issue legal notices (Payment Reminders, Maintenance Alerts, Evictions, Policy Updates) with attachments.
75. **Internal Private Lease Notes**: Private chronological notes attached to leases for internal conduct and dispute records.
76. **Lease Renewal & Rent Terms Review**: Adjust rent amounts and renewal terms, dispatching renewal contracts to tenants for digital execution.
77. **Visual Kanban Maintenance Board**: Multi-column board organizing repairs into Submitted, Assigned, In Progress, and Completed stages.
78. **Vendor Job Assignment with Email Alerts**: Assign maintenance tickets to verified vendors with automated email dispatch and direct ticket linkage.
79. **Manager-Scoped Invoice Creation**: Generates rent or utility invoices strictly scoped to managed leases, preventing out-of-portfolio billing (ISS-050).
80. **Bank Transfer Statement Reconciliation**: Review tenant transfer proofs, verify bank receipt files, and atomically mark invoices as paid (ISS-012).
81. **Vendor Maintenance Payout Processing**: Initiate vendor payouts for completed jobs and execute disbursement via Paystack Transfer API or manual log (ISS-012).
82. **Neighborhood Report Metric Editor**: Custom editor screen allowing managers to update area safety and infrastructure scores (ISS-016).
83. **Unit Move-In / Move-Out Condition Reports**: Create detailed room-by-room condition checklists with rating scores, notes, and inspection photos.
84. **Unit Lease Violation Tracking**: Log lease violations (noise complaints, property damage, unauthorized pets) with attached photographic evidence.
85. **Property Equipment & Appliance Inventory**: Track building appliances, generators, water pumps, and elevators with serial numbers and service schedules.
86. **Property-Wide Broadcast Announcements**: Publish announcements displayed on all active tenant dashboards in a building.

---

### Domain 6: Service Provider & Field Operations Management (12 Features)

87. **Trade-Specific Vendor Registration**: Collects business name, CAC registration number, primary trade categories, and coverage zones (ISS-043).
88. **Comprehensive Trade Categories**: Support for Plumbing, Electrical, HVAC, Carpentry, Painting, Masonry, Cleaning, and Security trades.
89. **Geographic Service Coverage Areas**: Designate serviceable LGAs and cities, enabling landlords to filter local providers for urgent jobs.
90. **Admin Verification Status Badge**: Verified badge displayed on vetted vendor profiles after administrative credential review.
91. **Vendor Jobs Overview Dashboard**: Central console displaying assigned repair jobs, open tickets, completed orders, and unbilled work.
92. **Job Detail & Tenant Access Instructions**: Full problem description, unit address, tenant contact info, access times, and damage photos.
93. **Job Progress State Transitions**: Vendors update job status from In Progress to Completed once on-site work is concluded.
94. **Dynamic Itemized Invoice Builder**: Form-driven builder starting empty and loading real job info for itemized billing (ISS-044).
95. **Automated Maintenance Invoice Payer Assignment**: Routes vendor invoice payment directly to the managing property manager or property landlord (ISS-051).
96. **Vendor Bank Account Registration**: Link verified NUBAN bank accounts to receive direct electronic transfer disbursements.
97. **Vendor Payout Disbursement Tracking**: Real-time payout ledger tracking approval, processing, and transfer settlement references (ISS-012).
98. **Direct Messaging with Assigning Manager**: Two-way in-app messaging channel with the property manager for site access or material approvals.

---

### Domain 7: Platform Administration, Governance & Compliance (14 Features)

99. **Super Admin Overview Command Center**: Executive platform overview (\`/admin\`) featuring global counts for properties, units, users, revenue, and active leases.
100. **Server-Side Platform Aggregates**: High-performance SQL aggregates calculating accurate numbers without page-1 query truncation (ISS-049).
101. **Searchable & Paged User Management Table**: Complete user roster (\`/admin/users\`) with live search, role filters, status filters, and pagination (ISS-054).
102. **Audited User Account Suspension**: Locks bad actors out immediately; enforces a mandatory documented reason recorded in the security audit log (ISS-054).
103. **Account Reactivation & Role Modification**: Restore suspended accounts or adjust user roles with audit entries logging the responsible administrator.
104. **Property Moderation & Publishing Queue**: Review all newly created listings before public release; approve, reject with feedback, or request edits.
105. **Duplicate Property Detection Badges**: Moderation queue flags identical addresses using automated fingerprint hashes (\`Property.listingHash\`, ISS-025).
106. **Duplicate Property Merge & Undo-Merge**: Merge duplicates into a canonical listing via \`Property.mergedIntoId\`; excludes from search while supporting undo.
107. **Security Audit Log Explorer & Filters**: Searchable, filterable audit log (\`/admin/security\`) with action filters, date selectors, and JSON metadata viewer (ISS-055).
108. **Global Platform Settings Console**: Configure invoice auto-completion thresholds, grace periods, and maintenance dispatch toggles.
109. **Service Provider Verification Queue**: Verify or decline vendor registrations before they become eligible for maintenance dispatch.
110. **Automated Database Migration Verification**: 25 Prisma migrations verified against staging schema with zero drift and duplicate constraint guards.
111. **Automated Health & Uptime Probe**: Public \`/api/v1/health\` probe verifying database connection latency, system uptime, and environment health.
112. **Automated Data Retention & Erasure Worker**: Background privacy worker (\`retention.ts\`) deleting expired identity documents according to NDPR periods (ADR-0012).

---

### Domain 8: Financial Engine, Webhooks & Payout Settlement (14 Features)

113. **Paystack Online Checkout Initialization**: Initializes secure Paystack payments, returning authorization URLs and tracking session states.
114. **HMAC-SHA512 Webhook Cryptographic Guard**: Verifies \`x-paystack-signature\` header using crypto HMAC before processing payment events.
115. **Advisory Row-Locked Payment Allocation**: Postgres \`SELECT ... FOR UPDATE\` row locks on invoices prevent concurrent payment double-credit races (ISS-052).
116. **Unique Transaction Reference Enforced**: \`Payment.transactionRef\` @unique index guarantees identical webhook retries can never credit twice (ISS-052).
117. **Partial Payment Running Balance Accounting**: Invoices track cumulative payments, marking status PARTIALLY_PAID until full balance reaches zero (ISS-052).
118. **Automated Overdue Flagger Worker**: Scheduled worker identifying UNPAID invoices past due, updating status to OVERDUE, and sending reminders.
119. **Configurable Late Fee Calculation**: Computes either fixed Naira late fees or daily percentage penalties applied to delinquent leases.
120. **Tenant Security Deposit Escrow Accounting**: Dedicated balance tracking for security deposits with refund calculation during lease termination.
121. **Automated Rent Cycle Invoicer Worker**: Generates next rent billing invoice and recurring service charge invoice in advance of upcoming cycle.
122. **Auto-Pay Mandate Storage & Charger Daemon**: Recurring charging worker (\`autopayCharger.ts\`) charging due invoices via Paystack recurring authorization (ISS-011).
123. **Bank Transfer Submission Workflow**: API endpoint (\`/api/v1/bank-transfers\`) for submitting receipt proofs into private reconciliation storage (ISS-012).
124. **Bank Transfer Statement Reconciliation**: Reconciliation approval endpoint creating Payment record, updating invoice to PAID, and notifying tenant (ISS-012).
125. **Multi-Stage Vendor Payout Disbursement**: Full lifecycle: Initiate -> Landlord Approval -> Paystack Transfer Disbursement, with invoice cap limits (ISS-012).
126. **Manual Cash & Transfer Payment Recording**: Allows managers/landlords to record manual payments with payment method audit logs (CASH, TRANSFER, ISS-053).

---

### Domain 9: Secure File Gateway & Media Architecture (12 Features)

127. **Multi-Provider Storage Driver Abstraction**: Pluggable StorageDriver supporting Cloudinary, AWS S3-compatible, Vercel Blob, ImageKit, and Local Disk (ADR-0008, 0009).
128. **Private File Gateway (8 Protected Folders)**: Controlled file proxy covering maintenance-requests, applications, profile, properties, notices, leases, communications, and reconciliation (ISS-038).
129. **Contextual File Read Authorization**: \`canReadFile\` evaluates permissions dynamically so tenants only view their own files, and managers see their properties.
130. **Strict File Ownership Assertion**: \`assertOwnsFileUrls\` ensures file references linked in notices, leases, messages, violations, and avatars belong to the caller (ISS-034, ISS-038).
131. **App-Wide Responsive File Viewer Modal**: Global modal (\`FileViewerModal.tsx\`) previewing images, PDFs, videos, audio, and documents across the app.
132. **Image Pan, Zoom (400%) & 90° Rotation**: Interactive inspection tools with zoom scaling from 50% to 400%, 90-degree rotation, and reset controls.
133. **In-Browser Scrollable PDF Viewer**: Direct iframe PDF rendering enabling users to review signed agreements without downloading external apps.
134. **Video & Audio Players with Variable Speed**: HTML5 players with custom speed buttons (0.5x, 1x, 1.5x, 2x) and Picture-in-Picture support.
135. **Syntax-Styled Text/CSV File Preview**: Monospace code and spreadsheet preview with 1-click clipboard copy button.
136. **Keyboard Accessibility Navigation**: Full keyboard control: Esc closes modal, Left/Right arrows navigate file galleries, +/- adjusts zoom.
137. **Presigned Direct Uploads Architecture**: Upload signature endpoint (\`/api/v1/uploads/sign\`) issuing short-lived signatures for direct client-to-storage uploads.
138. **Identity Document Privacy Retention Erasure**: Scheduled worker (\`retention.ts\`) automatically deletes expired identity documents according to NDPR periods (ADR-0012).

---

### Domain 10: Progressive Web App (PWA) & Mobile UX (8 Features)

139. **Installable Progressive Web App (PWA)**: Next.js metadata manifest (\`app/manifest.ts\`) with theme colors, names, and 192px/512px app icons.
140. **Offline Service Worker Caching**: Versioned service worker (\`public/sw.js\`) caching app shells and core assets for rapid offline launches.
141. **User-Facing Offline Fallback Screen**: Dedicated \`/offline\` screen with friendly reconnection prompts and cached action reminders.
142. **Home Screen Install Prompt Banner**: Modern backdrop-blurred prompt (\`PwaRegister.tsx\`) with native installation trigger and dismiss memory.
143. **Standalone Mobile Display Mode**: Launches as an independent app without mobile browser URL bars or browser controls.
144. **Floating Mobile Bottom Tab Bar**: Shows the top 3 role-specific tabs plus an expandable "More" sheet containing every remaining feature (ISS-026).
145. **Mobile Admin Slide-Over Drawer**: Collapsible slide-over drawer navigation tailored for admin management on compact touchscreens.
146. **Touch-Target Optimization**: Enforces 44px+ minimum tap target sizes, touch scrolling momentum, and mobile form inputs.

---

### Domain 11: In-App Communications & Real-Time Notifications (10 Features)

147. **Role-to-Role In-App Messaging Portal**: Real-time conversation portal (\`/dashboard/messages\`) between tenants, landlords, managers, and vendors.
148. **Contextual Conversation Threading**: Threads link directly to specific properties, units, or maintenance tickets for context.
149. **Protected Attachment Sharing in Chat**: Share images and documents inside chat, stored securely behind communications file gateway (ISS-038).
150. **Notification Bell & Live Unread Badges**: Interactive header bell (\`NotificationBell.tsx\`) with live count badge and audio chime alerts.
151. **Dedicated Notification Center Console**: Full-page notification feed (\`/dashboard/notifications\`) with category filtering and deep entity links.
152. **One-Click Mark-All-Read Action**: Atomically mark all unread notifications across all categories as read (\`POST /notifications/mark-all-read\`).
153. **Transactional Email Dispatch via Resend**: Sends verified emails for account activation, password resets, tenant invites, and viewing confirmations.
154. **Development "Sent Emails" Inbox Widget**: Opt-in floating panel (\`EmailInboxWidget.tsx\`) capturing outgoing emails during development and testing.
155. **Automated Audio Notification Chime**: Subtle Web Audio synthetic chime alerting users when a new high-priority notification arrives.
156. **Multi-Category Notification Types**: Categorizes alerts into SYSTEM, MAINTENANCE_STATUS, and ANNOUNCEMENT for easy scanning.

---

### Domain 12: Scalability, Database Optimization & Automated Workers (10 Features)

157. **10 Idempotent Scheduled Background Workers**: Rent Invoicer, Overdue Flagger, Autopay Charger, Maintenance Dispatcher, Access Code Janitor, Payment Scorer, Property Scorer, Retention, Storage Janitor, and Cron Fanout.
158. **Daily Cron Fanout Architecture (02:00 UTC)**: Single daily cron endpoint (\`/api/v1/cron/all\`) that safely executes all workers in strict dependency order.
159. **101 PostgreSQL B-Tree Performance Indexes**: 10 newly added single/composite indexes ensuring sub-millisecond query seeks on 100k+ unit workloads (ISS-030).
160. **100k Units EXPLAIN ANALYZE Scaling Benchmark**: Automated scaling harness (\`scripts/benchmark-100k-units.ts\`) proving sub-0.15ms query seek latency.
161. **Autocannon Multi-Phase Load Stress Testing**: Performance test harness (\`scripts/load-test.ts\`) measuring throughput, p99 latency, and concurrent requests.
162. **Stryker Mutation Testing Verified (85.7% Score)**: Automated code mutation suite injecting arithmetic, equality, and logical mutations to prove test test quality.
163. **1,000+ Payload Adversarial Fuzzing Suites**: Rigorous fuzz tests against URL parsers and API handlers testing malformed JSON, SQLi strings, and buffer overflows.
164. **Comprehensive RBAC Authorization Matrix**: Matrix testing proving unauthorized roles (e.g. Tenant accessing Admin routes) are universally rejected.
165. **Workflow & Financial State Anomaly Tests**: Verifies state machine resilience against negative payments, leapfrog approvals, and invalid status jumps.
166. **Access Code Expiry Janitor Worker**: Automated scheduled background janitor marking past-due visitor gate access codes as EXPIRED.

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
3. **Property Manager** — "I manage properties for a landlord" _(landlord invitation code optional — can link later)_
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

## Step 1.8 — Registering for Each Role (Start Here)

Follow your path: **Tenant / Landlord / Service Provider:** create account → verify email → sign in → your role's section. **Property Manager:** use a landlord invitation (Step 1.10), or register without a code and link to a landlord later from your dashboard → verify email → sign in. Email addresses are not case-sensitive. Landlords register in two steps; banking and properties are added later from the dashboard banner.

![Role selection](screenshots/reg_01_role_selection.png)

![Tenant form](screenshots/reg_02_tenant_form.png)

![Tenant check your email](screenshots/reg_03_tenant_check_email.png)

![Landlord form (two steps)](screenshots/reg_07_landlord_form_two_steps.png)

![Landlord check your email](screenshots/reg_08_landlord_check_email.png)

![Landlord setup banner](screenshots/reg_09_landlord_dashboard_setup_banner.png)

![Service provider form](screenshots/reg_10_vendor_form.png)

**Stuck?** No email: check spam, use "Resend verification email" on the sign-in error. Too many attempts: wait five minutes.

**Next:** Step 1.9.

## Step 1.9 — Verifying Your Email

The link opens `/verify-email`; press **Activate Account**, then sign in. In test environments the **Sent Emails** panel replaces a real inbox.

![Sent emails panel](screenshots/reg_04_email_inbox_widget.png)

![Verify page](screenshots/reg_05_verify_email_page.png)

![Account activated](screenshots/reg_06_account_activated.png)

**Next:** sign in (Step 1.4), then your role's section.

## Step 1.10 — Inviting a Property Manager

Landlord: dashboard → **Manager Access Codes** → **Invite via Email**. The manager receives a one-use code and a link to `/register?role=manager&code=…` with the code already verified (5 invitations per 5 minutes; codes can be deactivated). **Quick Code** generates a code to hand over personally.

![Invite form](screenshots/invite_01_landlord_access_codes.png)

![Invitation sent](screenshots/invite_02_invite_sent.png)

![Invitation email](screenshots/invite_03_invite_email.png)

![Registration with code verified](screenshots/invite_04_register_prefilled_code.png)

**Next:** the manager verifies their email (Step 1.9), signs in and follows Section 4.

## Step 1.11 — Password Reset

`/forgot-password` → enter email → follow the emailed link to `/reset-password`. The confirmation is identical whether or not the account exists.

![Forgot password](screenshots/auth_02_forgot_password.png)

![Reset link sent](screenshots/auth_03_forgot_password_sent.png)

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

Open **Neighbourhood report** on the property page to rate security, electricity, water, roads, flooding, amenities and demographics (0-10), add a status, features (one per line) and notes. Tenants and applicants see the latest saved version; each save keeps the earlier one.

- Neighbourhood report editor: `docs/screenshots/landlord_02c_neighbourhood_editor.png`

![Neighbourhood report editor](screenshots/landlord_02c_neighbourhood_editor.png)

Every photo uploaded with a listing now appears in the public gallery (cover, exterior, then the rest, with a "+N more" button).

- Public property page gallery: `docs/screenshots/public_property_gallery.png`

![Public property page gallery](screenshots/public_property_gallery.png)

**Photo Management:**
Landlords and property managers can manage images on any listing by clicking **Manage Photos** on the Property Details page. This opens the Photo Management dialog (`PropertyPhotoManager.tsx`), which supports:

- Adding image URLs or uploading new photos directly
- Dragging or moving photos to change their display order
- Setting any photo as the **Cover photo** (`Property.imageUrl`) or **Exterior photo**
- Deleting individual photos
- Saving updates via `PATCH /api/v1/properties/[id]`, which updates `Property.photoUrls` and instantly reflects on the public listing and gallery.

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

- Search by name, email or phone, and filter by role and status (the list is paged, 20 at a time)
- Suspend an account (the person is signed out straight away and emailed your reason) or reactivate it
- Change the role of a person who has no properties, tenancy or jobs yet
- Every one of these asks for a reason, which is saved in the audit log. You cannot change your own account or another admin's

**Screenshot:** `docs/screenshots/admin_02_users.png`

![Admin 02 Users](screenshots/admin_02_users.png)

Suspending (or changing a role) asks for a reason first. It is saved in the audit log and the person is signed out straight away.

![Admin 07 Suspend an account](screenshots/admin_07_user_suspend.png)

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

A listing at the same address and city as another live listing shows a **Possible duplicate** badge, and its review notes name the match. Nothing is merged or rejected automatically; you decide.

- Possible duplicate listings: `docs/screenshots/admin_09_duplicate_listing.png`

![Possible duplicate listings](screenshots/admin_09_duplicate_listing.png)

**Duplicate Detection, Merging & Undo Merge:**

- **Automated Fingerprinting:** Each listing gets an automatic `listingHash` (SHA-256 of lowercase address & city, punctuation and spaces stripped; `lib/propertyFingerprint.ts`), recomputed whenever the address changes.
- **Duplicate Badge:** If a new or updated listing matches an existing property, a **Possible duplicate** badge appears in the table.
- **Merge Duplicates Dialog:** Admins can click **Merge** on flagged listings to open `MergeDuplicateModal.tsx`. The admin confirms the primary listing and the duplicate to merge. When merged (`POST /api/v1/properties/[id]/merge`), units, active leases, and applications are consolidated into the primary listing, `Property.mergedIntoId` is set, the duplicate is hidden from public browse listings, and an audited event (`PROPERTY_MERGE`) is written to the Security Audit Log.
- **Merged Tab & Undo Merge:** A dedicated **Merged** filter tab on `/admin/properties` lists all merged properties. Admins can click **Undo Merge** (`POST /api/v1/properties/[id]/unmerge`) at any time to restore the listing, clearing `mergedIntoId` and logging a `PROPERTY_UNMERGE` audit event.

---

## Step 6.4 — Reports & Analytics

**What this is:**
Platform-wide reporting — properties listed, active tenants, revenue, maintenance volumes, and more.

**Screenshot:** `docs/screenshots/admin_03_reports.png`

![Admin 03 Reports](screenshots/admin_03_reports.png)

---

## Step 6.5 — Security & Audit Logs

**What this is:**
A chronological log of significant actions on the platform — used for security investigations.

**What you see:**

- Timestamp and who did it (or "System")
- What happened (e.g., "User suspended", "Payment recorded manually") and what it was about, shown by name (a person, an invoice number, a property)
- Click an entry to open its details

**What you can do:**

- Filter by what happened, what it was about, who did it, and a date range
- Page through older entries

**Screenshot:** `docs/screenshots/admin_08_security.png`

![Admin 08 Security](screenshots/admin_08_security.png)

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
