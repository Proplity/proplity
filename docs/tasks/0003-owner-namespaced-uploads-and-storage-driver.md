# 0003: StoredFile, File Gateway and Storage Providers (ISS-034 and follow-ups)

- **Period / Focus:** 2026-10-11
- **Status:** In Progress
- **Priority:** Medium
- **Assignee:** Claude
- **Target Branch / PR:** `feat/storage-owner-prefix` (PR #40, stacked on `feature/registration-ux-and-e2e`, PR #38)
- **Started:** 2026-10-11 14:00:00 UTC
- **Ended:** —

> **How to tick:** change `[ ]` to `[x]`. _Currently: nothing running._

## 1. Objective

Replace provider-shaped file references with a `StoredFile` table and one audited gateway, support several storage providers, make maintenance photos private. See [ADR-0010](../adr/0010-uploads-are-storedfile-rows-behind-one-file-gateway.md) (supersedes 0007–0009); issues ISS-015, ISS-031, ISS-032, ISS-034, ISS-035, ISS-036.

## 2. Work Breakdown

- [x] `StoredFile` model + migration `20261011163702_add_stored_file`
- [x] Providers in `lib/storage/providers/`: cloudinary (direct), S3-compatible (s3 / r2 / minio / supabase, presigned PUT and GET), local, imagekit, vercel-blob
- [x] `lib/storage/service.ts`: pending → ready uploads, access rules, gateway resolution, delete, attachment ownership, janitor
- [x] Routes: `uploads/sign`, `uploads/file`, `uploads/complete`, `files/[id]`; removed `uploads/private`, `uploads/public`
- [x] Maintenance photos private; request create / completion proof reject files the caller does not own
- [x] `PATCH /auth/me` requires an owned `READY` profile file; replacing deletes the old file
- [x] Audit: `FILE_UPLOADED`, `FILE_READ`, `FILE_DELETED`, `FILE_PROVIDER_MISMATCH`
- [x] `storage-janitor` cron job (stale `PENDING` uploads)
- [x] Test server uses `STORAGE_PROVIDER=local`; tests `files.test.ts` (15), `storage-drivers.test.ts` (14)
- [ ] **Not verified against real services:** Cloudinary (upload → complete → read), S3 / R2 / MinIO / Supabase (CORS + presigned PUT/GET), ImageKit, Vercel Blob
- [ ] Route remaining file fields (`Notice.documentUrl`, `Lease.signedAgreementUrl`, `Message.attachmentUrls`, `avatarUrl`, `evidenceUrls`) through the gateway when they get upload paths (ISS-033)
- [x] Decide retention / erasure for identity documents (NDPR) — ADR-0012; `retention` cron job, enable with `RETENTION_ENABLED=true` after compliance confirms the periods
- [ ] Backfill if any pre-existing Cloudinary URLs need `StoredFile` rows (none in production when written)

## 3. Unified Verification & Quality Gates

- [x] `pnpm typecheck`
- [x] `pnpm format:check`
- [x] `pnpm build`
- [x] Full API suite: 279 / 279 pass
- [x] Playwright (tenant maintenance request, landlord, vendor flows) on a production build, :3022, `STORAGE_PROVIDER=local`: 4 / 4 pass

## 4. Notes

- Reference notes: `out/certificate_or_file_access/proplity-storage-review-2026-10-11.md`.
- Presigned PUT cannot cap upload size; `complete` inspects the object and deletes it if it breaks limits.

## 5. Output & Deliverables

- **Branch:** `feat/storage-owner-prefix` · **PR:** #40
