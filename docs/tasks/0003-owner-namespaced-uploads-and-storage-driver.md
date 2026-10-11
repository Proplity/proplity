# 0003: Owner-namespaced Private Uploads, Storage Driver and Providers (ISS-034)

- **Period / Focus:** 2026-10-11
- **Status:** In Progress
- **Priority:** Medium
- **Assignee:** Claude
- **Target Branch / PR:** `feat/storage-owner-prefix` (stacked on `feature/registration-ux-and-e2e`, PR #38)
- **Started:** 2026-10-11 14:00:00 UTC
- **Ended:** —

> **How to tick:** change `[ ]` to `[x]`. _Currently: nothing running._

## 1. Objective

Bind private file references to their owner and put storage behind an interface. Context: [ADR-0008](../adr/0008-private-uploads-are-namespaced-by-owner-behind-a-storage-driver.md), ISS-034.

## 2. Work Breakdown

- [x] Sign private uploads into `<folder>/<userId>/`; client uses the folder the server returns
- [x] `PATCH /auth/me` rejects another user's private reference
- [x] `GET /uploads/private` derives the owner from the reference
- [x] `lib/storage/` (`StorageDriver`, Cloudinary driver, `getStorage()` / `STORAGE_PROVIDER`)
- [x] Tests: `tests/api/uploads-private.test.ts` (14) and `tests/api/storage-drivers.test.ts` (11)
- [x] Providers in `lib/storage/providers/`: cloudinary (direct), local, S3-compatible (s3 / r2 / minio / supabase), imagekit, vercel-blob
- [x] Proxy upload route `POST /uploads/file` (role, size, type checks), public reader `GET /uploads/public`, private gateway streams for proxy providers
- [x] `delete` on replace of an ID document; explicit `FOLDER_ACCESS`; `server-only` guards; `STORAGE_PROVIDER` documented in `.env.example`
- [x] Live check with the local provider on a dev server: sign, role gate (403), type (415) and size (413) limits, owner read, vendor 404, anonymous 401, public read, private key via public route 404, replacing the ID deletes the old file
- [ ] **Not verified against real services:** S3 / R2 / MinIO / Supabase, ImageKit (signed-URL scheme from docs), Vercel Blob, Cloudinary
- [ ] Presigned direct upload for S3-compatible providers (large files / video)
- [ ] Manual check against a real Cloudinary account

## 3. Unified Verification & Quality Gates

- [x] `pnpm typecheck`
- [ ] `pnpm format:check`
- [ ] `pnpm build`
- [ ] Full API suite
- [ ] Playwright (profile completion flow)

## 4. Notes

- Not run against Cloudinary (no keys here); signing and URL shape are unit-tested only.

## 5. Output & Deliverables

- **Branch:** `feat/storage-owner-prefix` · **PR:** —
