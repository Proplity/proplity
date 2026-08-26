# E-signature support for the rent agreement (PRD §5.1/§5.2)

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

`out/project-audit.md`: "E-signature support — absent beyond marketing copy; no signing flow, no signature field on Lease/Notice." PRD §5.1 lists "E-signature support for the rent agreement" as a real requirement. `Lease.signedAgreementUrl`/`agreementSignedAt` already existed in the schema but nothing ever wrote to either.

## Scope decision

No file-storage endpoint exists anywhere in this codebase (a documented, pre-existing gap — maintenance photo upload is display-only for the same reason). A drawn or uploaded signature *image* isn't buildable without one. Went with **click-wrap e-signature** instead: typed full legal name + server timestamp + IP address, recorded as a real, auditable signature event — the same legal category as "click to agree" checkout flows, not a fake stand-in. `signedAgreementUrl` stays untouched (still null — honest gap, no PDF generation exists either).

## What was built

**Schema**: new `LeaseSignature` model (migration `20260826184018_lease_signature`) — `leaseId`, `signerId`/`signerRole`, `fullNameTyped`, `ipAddress`, `signedAt`, `@@unique([leaseId, signerId])` (one signature per person per lease). `Lease.signatures` back-relation added.

**`POST /api/v1/leases/[id]/sign`**: accepts `{ fullName }`. Authorized for the lease's owning TENANT or the property's managing MANAGER/LANDLORD/ADMIN (`canManageProperty()`). A second signing attempt by the same person 409s (the `@@unique` constraint backs this, not just an app-level check). CSRF-checked (`validateCSRF()`) even though repo-wide CSRF coverage remains an open gap elsewhere — a new, legally-consequential route was worth protecting on its own rather than waiting for that larger pass. Once both a `TENANT`-role signature and a `MANAGER`/`LANDLORD`/`ADMIN`-role signature exist on a lease, `Lease.agreementSignedAt` is stamped server-side in the same transaction — the field a schema comment always implied would exist but nothing ever set.

**`GET /api/v1/leases/[id]`** extended to include `signatures` (with signer name/role) so the UI can render status without a separate fetch.

**Frontend**: `LeaseSignatureCard` (defined in and exported from `TenantDetail.tsx`, reused in `TenantDashboard.tsx`) shows both parties' signature status and a typed-name sign form for whoever hasn't signed yet. Manager side: rendered directly in `TenantDetail.tsx` (the lease is already loaded there in full). Tenant side: `TenantDashboard.tsx`'s `useActiveLease()` only returns `ACTIVE` leases, which would never include a lease still awaiting its first signature — so a small separate fetch (`useLeases({status:'PENDING'})` for the id, then `useLease(id)` for full detail incl. signatures) surfaces a "Lease Agreement Signature" prompt above Quick Actions specifically for that pre-activation window.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors (after `prisma generate` re-run for the new model).
- `pnpm test` — full suite, 194/194 passing (190 → 194: new `tests/api/e-signature.test.ts` — stranger/non-managing-manager rejection, tenant sign + duplicate-sign 409, agreementSignedAt only stamped once both sides have signed, malformed-body 400).
- `pnpm build` — production build succeeds; `/api/v1/leases/[id]/sign` present in the route manifest.

## What's next

Account-settings page (to give the already-built `BankAccount` backend a UI) — the last of the three items requested in this order. After that: repo-wide CSRF coverage, real AI/LLM integration.
