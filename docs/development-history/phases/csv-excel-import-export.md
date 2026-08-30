# CSV/Excel import-export (PRD §5.1)

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

`docs/development-history/project-audit.md`: "CSV/Excel import-export — absent, PRD §5.1." PRD §5.1's "Property & Unit Management" bullet lists it explicitly: "Import/export data (CSV, Excel)." First of three items the user asked to work through in order (CSV/Excel → e-signature → settings page).

## Scope decision

Scoped to Property & Unit Management specifically (what the PRD bullet is actually under) — export every unit across the caller's properties as one flattened spreadsheet row each (property name/address/city/state, unit number, bedrooms/bathrooms/sqft, rent, status, current tenant if any); import bulk-creates units onto one property from an uploaded CSV/XLSX. Not scoped to other domains (invoices, leases, tenants) — those weren't named in the PRD bullet and would each need their own scoping pass.

## What was built

**`lib/csv.ts`** — hand-rolled RFC 4180 CSV reader/writer, no dependency needed for a format this simple (proper quoting/escaping for embedded commas, quotes, newlines).

**`lib/xlsx.ts`** — thin wrapper around `exceljs` (new dependency) for real `.xlsx` generation and parsing. `parseXlsx` returns the same `Record<string,string>[]` shape as `parseCsv`, so import validation logic doesn't care which format was uploaded.

**`GET /api/v1/properties/export?format=csv|xlsx`** — one row per unit, scoped exactly like the existing `GET /properties?scope=mine` (ADMIN sees everything, MANAGER/LANDLORD see only their own properties). Streams a real file with the correct `Content-Type`/`Content-Disposition` for a browser download.

**`POST /api/v1/properties/[id]/units/import`** — multipart file upload (`.csv` or `.xlsx`, detected by filename), `canManageProperty()`-scoped. Each row is its own create — a bad row (missing `unitNumber`, non-numeric `rentAmount`, duplicate `unitNumber` within the property) is collected into a per-row `errors` array rather than aborting the whole import, so a 500-row file with 3 typos still creates the other 497.

**Frontend**: `DashboardBreakdownPage.tsx`'s properties view gained "Export CSV"/"Export Excel" links (plain `<a href>` downloads — cookies ride along automatically, no JS needed). `PropertyDetail.tsx`'s "Units & Tenants" card gained an "Import Units (CSV/Excel)" file picker showing a created/skipped-rows summary after upload. `lib/apiClient.ts`/`hooks/useProperties.ts` gained `importUnits`/`useImportUnits` (FormData upload, explicitly clearing the client's default JSON `Content-Type` so the browser sets the correct multipart boundary itself).

**Test infra**: `tests/helpers/client.ts`'s `apiFetch()` extended (additive, backward-compatible) to detect a `FormData` body and send it unmodified without forcing JSON headers, and to return the raw `Response.headers` — needed to assert `Content-Type`/`Content-Disposition` on the export routes and to drive the multipart import tests.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 190/190 passing (183 → 190: new `tests/api/csv-excel-import-export.test.ts` — export role-gating, per-caller scoping, tenant-info inclusion, xlsx content-type, import ownership-gating, partial-success row reporting, duplicate-unitNumber handling).
- `pnpm build` — production build succeeds; both new routes present.

## What's next

E-signature support (PRD §5.1/§5.2), then a real account-settings page (to give the already-built `BankAccount` backend a UI). After that: repo-wide CSRF coverage, real AI/LLM integration.
