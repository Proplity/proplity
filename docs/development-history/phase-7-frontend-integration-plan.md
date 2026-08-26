# Phase 7 — Frontend Integration & State Hydration: step-by-step plan

**Status:** Approved, in progress. AddTenantForm's open question resolved by the user (minimal invite endpoint, console-transport email — see below).

## Why this needed its own plan

The original `domain-api-implementation-plan.md` deliberately left Phase 7 high-level ("scoped once Phases 1–6 exist"). Now that they do, research into the 5 target forms and their current wrapper pages surfaced real gaps between the mock-data UI and the actual Prisma-backed API that need explicit decisions, not just "call the endpoint":

- Every mock id is a `number` (`mockProperties.find(p => p.id === Number(id))`); every real id is a UUID `string`. The 5 wrapper pages under `app/dashboard/...` all currently do `Number(id)` conversions that need to come out.
- No data-fetching library is installed (no SWR/react-query, just `axios` via `lib/apiClient.ts`) — hooks will be plain `useState`/`useEffect` wrappers, not a new dependency.
- `MaintenanceRequestForm`'s category buttons are hardcoded strings (`'plumbing'`, `'electrical'`, ...); the real `MaintenanceCategory` is a DB table (Phase 2), so the form needs to fetch real categories and map button clicks to a real `categoryId`.
- `ScheduleViewing` collects a separate `date` + `timeSlot`; the real API takes one `scheduledAt` `DateTime` — these need combining client-side.
- `ListProperty` collects property AND unit fields (bedrooms, rent, etc.) in one form; the real API is two calls — `POST /properties` then `POST /properties/[id]/units` — needing to run in sequence.
- `VendorCreateInvoice` builds a multi-line-item breakdown (description/qty/rate/amount per row); the real `Invoice` model has a single `amount` + one `description` string, no line items. Resolution: sum the line items into `amount`, and serialize the breakdown into the `description` text — a formatting choice, not a blocking one.
- **`AddTenantForm` needed a real infrastructure decision, not just a formatting choice** — resolved below.

## Resolved: `AddTenantForm` — minimal invite flow, console-transport email

The form collects brand-new-tenant details (name, email, phone, NIN, employer) and its wrapper page's success message says *"An invitation has been sent to the tenant."* `POST /leases` (Phase 3) requires an existing `tenantId`, and there's no invite-a-new-user-by-email endpoint anywhere in the 6 built phases. **Decision (user-approved): build a minimal invite endpoint now, with a console-transport "email" (log the content server-side) instead of a real provider** — this makes the flow genuinely work end-to-end rather than leaving another half-built dead end, without pulling in real email infrastructure.

Concretely, this needs 4 small pieces of new infrastructure beyond the 5-form/apiClient/hooks scope, added as **Step 0**:

1. **`lib/email.ts`** — `sendEmail({ to, subject, body })` that `console.log`s the content instead of delivering it. A real provider swaps this one function later; nothing else changes.
2. **`app/api/v1/leases/route.ts` (Phase 3 route, extended)** — `POST` accepts `tenantId` **or** `tenantEmail`+`tenantName` (+ optional `tenantPhone`). If `tenantEmail` matches an existing `TENANT`, reuse that user (transparent "link existing" — no separate search UI needed, matching CLAUDE.md's "never auto-link accounts by unverified email" principle by only ever matching on an *already-verified, already-`ACTIVE`* existing user, never merging into a pending one). If no match, create a new `User` (`role: TENANT`, `status: PENDING_VERIFICATION`, a random unusable `passwordHash`), a `VerificationToken`, and console-"email" a verify link.
3. **`app/api/v1/auth/verify-email/route.ts` (extended)** — accepts an optional `password` alongside `token`; when present (only relevant for an invited user who never set one), hashes and stores it in the same transaction that flips `status` to `ACTIVE`. Backward compatible — `password` stays optional, existing token-only verification is unaffected.
4. **`app/verify-email/page.tsx` (new — no frontend page exists for this today, API-only)** — reads `?token=` from the URL, collects a password + confirmation, `POST`s to the extended route, redirects to `/` on success. Without this, the console-logged link has nowhere to go.

`login`'s existing `PENDING_VERIFICATION` → `403` check (already in place, untouched) is exactly what keeps an invited-but-not-yet-verified tenant from logging in early — no changes needed there.

`AddTenantForm`'s property-selection step also needs a real fix: the mock form only ever picks a *property*, but `Lease.unitId` needs a specific *unit*. Wiring it means fetching the selected property's real units (`GET /properties/[id]/units`), filtering to `VACANT`, and having the manager pick one (auto-selected if there's exactly one).

## Step-by-step plan for all 5 forms + infrastructure

### Step 1 — `lib/apiClient.ts`: domain-grouped typed methods

Keep the existing `apiClient` axios instance and its 401-refresh interceptor untouched (it's the thing Phase 0-pre's bug fix depends on). Add typed request/response wrappers grouped by domain, e.g.:

```ts
export const api = {
  properties: {
    list: (params?: PropertyListParams) => apiClient.get<Paginated<Property>>('/api/v1/properties', { params }),
    create: (body: CreatePropertyInput) => apiClient.post<{ data: Property }>('/api/v1/properties', body),
    createUnit: (propertyId: string, body: CreateUnitInput) =>
      apiClient.post<{ data: Unit }>(`/api/v1/properties/${propertyId}/units`, body),
    createViewing: (propertyId: string, body: CreateViewingInput) =>
      apiClient.post<{ data: Viewing }>(`/api/v1/properties/${propertyId}/viewings`, body),
  },
  maintenance: {
    categories: () => apiClient.get<{ data: MaintenanceCategory[] }>('/api/v1/maintenance/categories'),
    createRequest: (body: CreateMaintenanceRequestInput) =>
      apiClient.post<{ data: MaintenanceRequest }>('/api/v1/maintenance/requests', body),
  },
  leases: { create: (body: CreateLeaseInput) => apiClient.post<{ data: Lease }>('/api/v1/leases', body) },
  invoices: { create: (body: CreateInvoiceInput) => apiClient.post<{ data: Invoice }>('/api/v1/invoices', body) },
  accessCodes: {
    list: (unitId: string) => apiClient.get<{ data: AccessCode[] }>('/api/v1/access-codes', { params: { unitId } }),
    create: (body: CreateAccessCodeInput) => apiClient.post<{ data: AccessCode }>('/api/v1/access-codes', body),
  },
};
```

Types hand-written to match each route's actual Zod input/response shape (no codegen in this repo) — kept in `lib/api/types.ts`, one block per domain, matching each route file's schema.

### Step 2 — 5 hooks, one shared shape

Every hook returns `{ data, loading, error, refetch }` for reads and `{ submit, submitting, error }` for writes — plain `useState`/`useEffect`, no new dependency:

- **`hooks/useProperties.ts`** — `useProperties(filters)` (list), `useCreateProperty()`, `useCreateUnit(propertyId)`, `useCreateViewing(propertyId)`.
- **`hooks/useMaintenanceRequests.ts`** — `useMaintenanceCategories()`, `useCreateMaintenanceRequest()`.
- **`hooks/useLeases.ts`** — `useCreateLease()` (accepts either the `tenantId` shape or the `tenantEmail`/`tenantName`/`tenantPhone` invite shape, passed straight through to the extended route).
- **`hooks/useInvoices.ts`** — `useCreateInvoice()`.
- **`hooks/useAccessCodes.ts`** — `useAccessCodes(unitId)`, `useCreateAccessCode(unitId)` — not wired to a form this phase (no access-code form exists yet in the UI), built per the plan's explicit list but left unused/available for Phase 8+ or a future UI addition.

### Step 3 — Wire all 5 forms

- **`MaintenanceRequestForm.tsx`** → fetch real categories on mount via `useMaintenanceCategories()`, replace the 5 hardcoded category buttons' `id`s with real category records (falls back gracefully if a category name doesn't match one of the 7 seeded defaults). On submit: `useCreateMaintenanceRequest().submit({ unitId, title, description, categoryId, priority, mediaUrls: [] })`. **Needs a real `unitId`** — the wrapper page currently passes none; will thread it from the tenant's active lease (fetch via a lightweight `/api/v1/leases?status=ACTIVE` call scoped to the logged-in tenant, take the first result's `unitId` — a tenant has exactly one active lease in the seeded data model). Image upload stays a no-op display list (no file-storage endpoint exists in any phase) — `mediaUrls` submitted empty, noted as a known gap.
- **`ScheduleViewing.tsx`** → `propertyId` prop becomes `string`; combine `formData.date` + a mapped `timeSlot` into one `scheduledAt` ISO string (each slot label like "Morning (8AM–12PM)" maps to a fixed hour, e.g. 9:00 local). Submit via `useCreateViewing(propertyId).submit({ scheduledAt, notes: formData.specialRequirements })`.
- **`ListProperty.tsx`** → on final-step submit, `useCreateProperty().submit({...})` then `useCreateUnit(newProperty.id).submit({...})` in sequence; show a combined submitting/error state across both calls.
- **`VendorCreateInvoice.tsx`** → `jobId` prop becomes `string` (the real `maintenanceRequestId`); submit via `useCreateInvoice().submit({ maintenanceRequestId: jobId, type: 'MAINTENANCE', amount: total, dueDate: <+14 days>, description: <line items rendered as text> })`.
- **`AddTenantForm.tsx`** → property search uses `useProperties()` (real listing) instead of `mockAvailableProperties`; selecting a property fetches its units via `GET /properties/[id]/units`, filtered to `VACANT`, auto-selected if exactly one. Submit via `useCreateLease().submit({ unitId, tenantEmail, tenantName, tenantPhone, startDate, endDate, rentAmount, deposit, paymentFrequency })` — the server decides invite-vs-reuse, so the form itself doesn't need new branching logic.

### Step 4 — Wrapper pages

Update the 5 corresponding `page.tsx` files to drop `Number(id)` conversions, pass real string ids, and replace the `alert(...)` success messages with real success states driven by the hooks' `submitting`/`error`.

### Verification plan

- `pnpm exec tsc --noEmit`, `pnpm build` after each form is wired.
- Manual browser click-through per form (log in as the relevant demo role, fill and submit, confirm a real row lands in the DB via a one-off query, confirm the UI's success path fires) — this phase is the first one where "live-tested" means *through the browser*, not just `curl`, since the whole point is the UI path.
- Clean up test rows created during manual verification the same way prior phases did.
- Write `out/phases/domain-api-phase-7-frontend-integration.md` once done, per the standing convention.

## Next after this phase

Phase 8 — Background Workers & Cron Jobs (Rent Invoicer, Overdue Flagger, Maintenance Schedule Dispatcher, Access Code Expiry Janitor, Payment Reliability Scorer) — separately scoped, not started here.
