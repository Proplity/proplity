# 0002: Private Document Uploads (ISS-031 / ISS-032)

- **Period / Focus:** 2026-10-11 (Sensitive document exposure)
- **Status:** Completed
- **Priority:** High
- **Assignee:** Claude
- **Target Branch / PR:** `fix/private-uploads` (merged into `dev`)
- **Started:** 2026-10-11 12:00:00 UTC
- **Ended:** 2026-10-12 21:00:00 UTC

> **How to tick:** change `[ ]` to `[x]`. _Currently: nothing running._

## 1. Objective

Stop identity/application documents being readable by anyone holding a URL, and restrict who can sign uploads into which folder.

## 2. Context & Related Docs

- [ADR-0007](../adr/0007-identity-documents-are-private-cloudinary-assets.md) (proposed); issues ISS-031, ISS-032 in `docs/issues/issues.md`.

## 3. Work Breakdown

- [x] `lib/privateRef.ts` (client-safe reference helpers), `lib/cloudinary.ts#privateDownloadUrl` (signed, expiring)
- [x] `POST /uploads/sign`: `type=authenticated` for `profile`/`applications`; per-folder role allow-list
- [x] `lib/uploadClient.ts` stores the opaque reference for private folders
- [x] `GET /api/v1/uploads/private` with owner / admin / related manager-landlord authorisation
- [x] Tests `tests/api/uploads-private.test.ts` (9)
- [ ] Manual check against a real Cloudinary account (upload, then open via the endpoint; confirm the old plain URL 404s)
- [ ] Decide: backfill/re-upload existing public ID documents
- [ ] UI to let a manager/landlord open an applicant's ID (endpoint exists; no screen links to it yet)
- [ ] File size/type limits at signing (upload preset)

## 4. Unified Verification & Quality Gates

- [x] `pnpm typecheck` clean
- [ ] `pnpm format:check` clean
- [ ] `pnpm build` succeeds
- [ ] Full API suite
- [ ] Full Playwright suite

## 5. Notes

- The Cloudinary calls (authenticated upload + API download URL) are unit-tested for shape only; they have **not** been run against Cloudinary (no keys in this environment).

## 6. Output & Deliverables

- **Branch:** `fix/private-uploads` · **PR:** —
