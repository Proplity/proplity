# Product Requirements Document (PRD)
## ProplityTMS – AI-Native Rental Intelligence & Tenant Management Platform

---

## 1. Product Overview

### 1.1 Vision
To become Nigeria’s most trusted, intelligent, and human-centric property management platform, transforming rental operations from fragmented, manual workflows into a unified, automated, and insight-driven experience.

### 1.2 Mission
Make property management simple, scalable, and intelligent by combining automation, AI, and trust infrastructure tailored to the realities of Nigeria’s rental market.

### 1.3 Problem Statement
Property management in Nigeria is characterized by:
* Fragmented tools (spreadsheets, WhatsApp, paper files)
* Manual rent tracking and renewals
* Poor communication between tenants, landlords, managers, and vendors
* High fraud risk (fake listings, agent manipulation)
* No centralized source of truth
* Heavy administrative burden that does not scale

Existing tools are either:
* Too generic and foreign
* Not AI-native
* Not adapted to Nigerian behaviors (WhatsApp-first, informal payments, trust deficit)

---

## 2. Target Users & Personas

### 2.1 Primary User Segments
1. **Landlords** (1–50 units)
2. **Property / Facility Managers** (50–5,000+ units)
3. **Tenants**
4. **Community Associations & Estate Managers**
5. **Service Providers** (Vendors, Technicians)

### 2.2 Key Personas

* **Landlord (Semi-Professional)**
  * Owns multiple units
  * Wants predictable rent, fewer calls, clean records
  * **Pain:** Tracking renewals, payments, maintenance

* **Estate / Facility Manager**
  * Manages large estates or communities
  * Needs operational visibility, access control, compliance
  * **Pain:** Coordination, transparency, resident trust

* **Tenant**
  * Wants convenience, clarity, and fast response
  * **Pain:** Chasing receipts, reporting issues, unclear communication

* **Service Provider**
  * Wants steady jobs and fast payment
  * **Pain:** Disorganized requests, delayed payments

---

## 3. Value Proposition

ProplityTMS is not just property software, it is a trusted operating system for rentals.
* One platform for payments, communication, documents, maintenance, and intelligence
* AI automates repetitive admin tasks
* Trust and verification baked into listings and operations
* Built for Nigeria’s scale, behaviors, and infrastructure realities

---

## 4. Product Scope

### 4.1 In Scope (MVP → v1.5)
* Property listing
* Property & tenant management
* Rent collection & renewals
* Maintenance workflows
* Owner & tenant portals
* Accounting & reporting
* Role-based access
* AI-assisted tenant management
* Estate & access management
* Vendor ecosystem

### 4.2 Out of Scope (Initial Phase)
* Mortgage lending
* Property sales marketplace (future expansion)
* Monthly rent payment

---

## 5. Core Functional Requirements

### 5.1 Landlord & Property Manager Features

* **Property & Unit Management**
  * Create and manage properties and units
  * Assign tenants, owners, service providers
  * Import/export data (CSV, Excel)

* **Rent & Renewals**
  * Rent setup with terms, frequency, grace periods
  * Automated invoicing
  * Auto late fees & penalties
  * Rent renewal workflows
  * AI-generated renewal and rent increase notices
  * E-signature support for the rent agreement

* **Payments**
  * Online payments via Paystack
  * Bank transfer reconciliation
  * Auto-pay for tenants
  * Real-time payment status
  * Multiple bank accounts per entity

* **Maintenance Management**
  * Tenant-submitted requests (text, image, video)
  * AI-triaged issue categorization & urgency
  * Auto-assignment rules
  * Service provider portals
  * Recurring maintenance scheduling
  * Equipment & warranty tracking
  * Maintenance request board (Kanban-style)

* **Communication**
  * Unified messaging (tenant ↔ landlord ↔ manager ↔ vendor)
  * Automated notifications (email, in-app, push)
  * WhatsApp AI tenant assistant integration

### 5.2 Tenant Features
* Secure tenant portal
* Rent payment & receipts
* Auto-pay setup
* Maintenance reporting & tracking
* Digital rental agreements & notices
* Access code management (gates, garages, amenities)
* Messaging with management
* Rent balance visibility

### 5.3 Community & Estate Management
* Resident directories
* Community announcements & discussion boards
* Association fee collection
* Vendor payments
* Violation tracking
* Maintenance approval workflows
* Access control with time-bound codes
* Full audit trail of access activity

### 5.4 Service Provider Features
* Professional business profile
* Job intake & dispatch
* AI-structured work tickets
* Messaging with stakeholders
* Job status tracking
* Invoice generation
* Online payments
* Work history & reputation signals

---

## 6. AI & Intelligence Layer (Core Differentiator)

### 6.1 AI-First Tenant Management

* **AI Tenant Assistant (WhatsApp-First)**
  * Rent balance inquiries
  * Maintenance intake (voice, text, images)
  * Lease questions
  * Smart escalation to humans
  * **Success Metric:** Reduce admin workload and off-hour calls by 60–70%

* **Smart Rent Intelligence**
  * Late payment prediction
  * Personalized reminder timing
  * Message tone optimization
  * Escalation rules (reminder → call → notice)

* **Lease & Document Intelligence**
  * AI-drafted:
    * Renewal offers
    * Rent increase notices
    * Default notices
  * Clause completeness checks
  * Expiration alerts
  * Risk flagging

### 6.2 AI-Enhanced Property Discovery (House Hunting Intelligence Layer)

Proplity introduces a trust-first, AI-powered property discovery system that eliminates fraud, reduces search time, and increases decision confidence through structured data, verification, and intelligent matching.

#### 6.2.1 AI-Verified Listing Media (Trust Enforcement Layer)
* **Requirement:** All property listings must meet mandatory structured media standards before publication.
* **Specifications:**
  * Required uploads:
    * 360° walkthrough video
    * Photos of every room
    * Exterior building view
  * AI validation pipeline:
    * Detect missing required media → block listing
    * Identify reused / stock / AI-generated images via computer vision
    * Validate consistency between media and listing metadata
* **System Behavior:**
  * Listings failing validation are auto-rejected or flagged for manual review
  * Trust score updated based on media authenticity
* **Outcome:** Eliminates fake or misleading listings → “what you see is what exists”

#### 6.2.2 Neighbourhood Intelligence Layer (Map-Based Insight Engine)
* **Requirement:** Each listing must display a dynamic, data-rich neighbourhood profile.
* **Data Integrations:**
  * Satellite imagery (road/access quality inference)
  * Government flood maps
  * Power infrastructure (NEPA/PHCN reliability signals)
  * Proximity data (schools, markets, transport hubs)
  * Community-reported:
    * Security ratings
    * Noise levels
    * Livability feedback
* **User Experience:**
  * Interactive map overlays
  * Key indicators: Power outage frequency, Road condition score, Safety rating, Accessibility index
* **Outcome:** Tenants evaluate environmental quality before physical inspection

#### 6.2.3 Real-Time Availability & Payment-Linked Status
* **Requirement:** Listing availability must be programmatically tied to transaction state.
* **System Logic:**
  * When Lease is confirmed AND Payment is successfully processed → Listing is automatically deactivated
* **Agent Accountability:**
  * Repeated stale listings trigger: Ranking penalties, Temporary suspension
* **Outcome:** Removes stale listings and aligns incentives toward accuracy

#### 6.2.4 Property Fingerprinting & De-Duplication
* **Requirement:** Prevent duplicate listings across multiple agents.
* **AI Techniques:**
  * Address normalization
  * Image hashing
  * Floor plan similarity detection
* **System Behavior:**
  * Detect duplicate submissions → Merge into a single canonical listing, OR Flag duplicates for moderation
* **Outcome:** Eliminates multi-agent duplication and inspection fee exploitation

#### 6.2.5 Conversational AI Search & Smart Shortlisting
* **Requirement:** Enable natural language-based property search and ranking.
* **User Input Example:** *“3-bedroom flat in Lekki, max ₦800k/year, ground floor, good security, near a school.”*
* **System Capabilities:**
  * NLP parsing of constraints and preferences
  * Weighted scoring of listings
  * AI-generated ranked shortlist
* **Output:** High-confidence matches and explanation of why each listing fits
* **Outcome:** Reduces search cycle from months → days or weeks

#### 6.2.6 Structured Condition Reports (Pre-Inspection Transparency)
* **Requirement:** Every listing must include a standardized condition report.
* **Data Fields:** Room dimensions (with photo validation), Bathroom/toilet condition, Water supply type (borehole, PHCN, tank), Electrical setup (grid, inverter, generator), Security infrastructure
* **AI Validation:** Detect inconsistencies between claims and evidence; Flag unverifiable claims
* **Outcome:** Creates an auditable, pre-visit property baseline

#### 6.2.7 System-Level Impact

| Dimension | Before (Current Market) | After (Proplity) |
| :--- | :--- | :--- |
| **Search Method** | Manual calls & trial-and-error | AI-curated shortlist |
| **Trust Level** | Fake listings & duplicate agents | Verified listings & data-backed decisions |
| **Inspection Process** | Numerous physical inspections | Minimal physical inspections |

**Net Effect:** Proplity transforms property discovery from unstructured, trust-deficient, and agent-driven into structured, AI-verified, and tenant-optimized. This establishes discovery as a core competitive moat, not just a feature.

### 6.3 Estate & Community AI
* Sentiment analysis on complaints and messages
* Early dispute detection
* Resident satisfaction scoring
* Operational risk alerts

---

## 7. Non-Functional Requirements

* **Security & Compliance:**
  * End-to-end encryption
  * Role-based access control (RBAC)
  * Audit logs
  * Secure payment handling
  * Data privacy aligned with NDPR

* **Performance:**
  * Handle 100,000+ units
  * Sub-2s response time for core actions
  * Offline-tolerant mobile experience

* **Availability:**
  * 99.5% uptime SLA
  * Graceful degradation during outages

---

## 8. Platform Architecture (High Level)

* Web app (Landlords, Managers, Owners)
* Mobile-responsive tenant & vendor portals
* WhatsApp AI interface
* API-first backend
* Modular AI services (NLP, CV, prediction engine)
* Secure payment gateway integrations

---

## 9. Success Metrics (KPIs)

* **Business:**
  * Monthly Active Properties
  * Rent collection rate
  * Renewal conversion rate
  * Churn rate (landlords & tenants)

* **Operational:**
  * Reduction in manual admin hours
  * Maintenance resolution time
  * Late payment reduction

* **Trust & Engagement:**
  * Tenant satisfaction score
  * AI assistant resolution rate
  * Dispute frequency

---

## 10. Competitive Positioning

| Dimension | ProplityTMS | Local Tools | Foreign Tools |
| :--- | :---: | :---: | :---: |
| **AI-Native** | ✅ | ❌ | ⚠️ |
| **Nigeria-Specific** | ✅ | ⚠️ | ❌ |
| **WhatsApp-First** | ✅ | ❌ | ❌ |
| **Trust & Verification** | ✅ | ❌ | ❌ |
| **Estate-Scale Ready** | ✅ | ⚠️ | ⚠️ |

---

## 11. Risks & Mitigation

| Risk | Mitigation |
| :--- | :--- |
| **Adoption resistance** | WhatsApp-first onboarding |
| **Data quality** | AI validation & deduplication |
| **Trust concerns** | Verification, audit trails |
| **Payment failures** | Multi-channel payments |

---

## 12. Roadmap (High Level)

* **Phase 1 (MVP):** Core TMS, Payments, Maintenance, Tenant portals, Basic AI assistant
* **Phase 2:** Advanced AI rent intelligence, Owner portals, Estate access control, Vendor ecosystem
* **Phase 3:** AI house search, Neighborhood intelligence, Market analytics

---

## 13. Summary

ProplityTMS is designed to be Nigeria’s rental operating system, not just software, but an intelligent, trusted partner that replaces chaos with clarity, manual work with automation, and distrust with data-backed confidence.

---

## Appendix: Onboarding Workflow

### ID Verification - API Integration
* **First Name**
* **Last Name**
* **Phone Number**
* **Describe yourself in a few sentences:** *I currently live in Lugbe and I am looking for an apartment in Maitama.* (Optional)
* **What is your reason for moving?** (Optional)
* **Number of tenants** (Optional)
* **Move-in date:** *As soon as possible* or *Select a date*