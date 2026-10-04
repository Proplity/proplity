# UI/UX gap audit — service charge, multi-unit listings, tenant profile gate, and every dead stub wired

**Status:** Complete and verified. **Dates:** 2026-09-28 → 2026-10-01 (PRs #16, #18–#20, #22–#26, released to `main` in #27).

## Why

Before going further into staging/production readiness the user asked for a full pass over every role's flow ("add / manage / acquire / renew properties") to find gaps. The audit read the real code (not the UI copy) and produced a punch list of confirmed defects and stub features — buttons that called `alert()`, forms that collected data nothing stored, and nav entries with no destination. Everything below was verified against file and line before being fixed.

## What was built

### Defects and larger features (PRs #16, #18–#20)

- **Register password focus bug** — typing in the password field lost focus on every keystroke (component re-created per render). Fixed.
- **Admin property-approval queue** — the admin sidebar had no entry point to the moderation endpoint that already existed. Added `/admin/properties` (filter chips, search, pending-first, approve/reject) and a Properties nav entry. `GET /api/v1/properties?scope=mine` now includes `manager`.
- **Service charge** — `InvoiceType.SERVICE_CHARGE` restored (migration `20260928085653_add_service_charge`), `Unit.serviceCharge` and `Lease.serviceCharge`. Billed as its **own invoice line** (initial invoice in `POST /leases`' transaction; recurring in `rentInvoicer.ts`, same cycle and due date as RENT with a separate idempotency check) — never merged into the RENT amount. Wired through `ListProperty` (per-unit field), `AddTenantForm` (prefilled from the unit, combined "Total per cycle"), and the tenant rent tile (combined total + breakdown).
- **Agency fee / security deposit removed** from `AddTenantForm` — no backing fields existed.
- **Schedule Viewing** — real confirmation modal and confirmation email.
- **Multi-unit listing form** — `ListProperty` keeps `units: UnitFormData[]` (repeatable cards, min 1). Submission creates the property once, then each unit through its own `createUnit` call (there is no bulk endpoint). Per-unit status (`pending`/`creating`/`created`/`failed`) shows in the review step with **Retry Failed Units**, which retries only the failed units instead of recreating the property.
- **Tenant profile gate + 3-step application** — migrations `20260928092021_tenant_profile_fields` and `20260928092131_tenant_year_of_birth` add `previousLandlordPhone/Email`, `idDocumentUrl`, `yearOfBirth` to `User`. `lib/tenantProfile.ts#isTenantProfileComplete` requires phone, year of birth, all three emergency-contact fields and an ID document; previous landlord is optional (first-time renters may not have one). `/dashboard/profile/complete` is the one-time form; the apply page redirects there (`?next=`) before ever rendering the application. `PropertyApplicationForm` went from four steps to three (Applicant read-only, Employment, Review & Submit); `leaseDuration` and `numberOfOccupants` were removed outright because lease terms are the manager's call. Fixed a real bug on the way: the "Next vs Submit" condition still said `step < 4`.
- **Role-scoped "Properties" nav** — manager/landlord get **My Properties** (searchable, unit/occupancy counts); tenant gets **My Rentals** (current and past leases, linking to the property). Admin keeps the moderation queue. A follow-up (`5d94121`) fixed the mobile tab bar, which only shows the first three tabs.
- **Renew Lease** (#19) — `TenantDetail` "Renew Lease" creates the successor lease and expires the old one.

### Dead stubs wired (PRs #22–#26)

| PR  | Stub                                                | What it does now                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #22 | `TenantDetail` Send Notice / Send Invoice           | Inline expand-forms. Notice posts a `Notice` of the chosen type via `useCreateNotice`; Invoice creates a real invoice (incl. Service Charge) the tenant sees.                                                                                                                                                |
| #23 | `ListProperty` media upload                         | Real direct-to-Cloudinary upload (`lib/uploadClient.ts`, new `'properties'` folder in `POST /uploads/sign`); payload now sends `imageUrl`, `video360Url`, `exteriorPhotoUrl`. Without Cloudinary the step says uploads aren't available. The demo button is gone.                                           |
| #24 | `TenantDashboard` auto-pay                          | No card UI by design. `GET /api/v1/payments/authorization` reads the reusable `authorization_code` from the tenant's stored `Payment.rawProviderPayload`; the dashboard offers **Enable** / **Cancel Auto-Pay** over the existing `AutoPayMandate` CRUD. The mock gateway now returns `authorization.reusable: true`. |
| #25 | `LandlordDashboard` Download Report / Schedule Review | Report downloads a one-row-per-property CSV (`lib/csv.ts#toCsv`). Schedule Review creates (or reuses) a DIRECT conversation with the property's manager, posts a message and navigates to it; disabled with "No manager assigned yet" otherwise.                                                          |
| #26 | `AdminDashboard` Security / Database / Settings tiles | New `GET /api/v1/admin/audit-logs` + `/admin/security` page (`useAuditLogs`). Settings navigates to Platform Settings. **Database** is honestly a note — Proplity has no in-app database console, and inventing one was out of scope.                                                                  |

Behind those PRs: `lib/api/types.ts` and `lib/apiClient.ts` gained the new endpoints/types; `AdminChrome` gained the Security nav entry.

## Design decisions worth remembering

- **Replace dead buttons with the smallest honest thing** — an inline expand-form rather than a modal for Notice/Invoice; an explanatory note rather than a fake feature (Database tile); a different real mechanism when the labelled one doesn't exist (Schedule Review is a message, not a calendar integration).
- **Auto-pay stores no card.** The reusable Paystack authorization already lives in the first card payment's raw payload; reading it avoids a card-capture UI and any PCI surface. **Nothing yet charges a mandate on a schedule** — that is the next piece of auto-pay.
- **Service charge is a separate invoice, not part of rent**, so reports, late fees and receipts keep distinguishing the two.
- **`useApiSubmit` is a plain per-render function** — wrapping it in `useCallback([])` reintroduces the stale-closure bug fixed earlier.

## Verification performed

- `pnpm typecheck`, `pnpm format:check`, `pnpm build` clean on every PR; CI's three jobs (Typecheck/format/build, Integration tests, E2E) green.
- Playwright and API suites extended where behaviour changed; final counts 247 Vitest tests / 36 Playwright tests.
- Browser smoke tests of each wired flow against a local dev server (several early "failures" were test timing/selector issues — Playwright can't use `getByLabel` here because the form labels have no `htmlFor`).

## What's next

- Manager gets no aggregate list or notification when a tenant submits an application — the review UI is still buried per property in `PropertyDetail`.
- `AddTenantForm` document upload.
- A cron step that charges active `AutoPayMandate`s.
- A real-account Paystack test-mode run of `/payments/initialize`.
