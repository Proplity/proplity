# 0009 — Uploads support several storage providers through one gateway

Status: Proposed
Decided by: roji-tech (pending acceptance) · Date: 2026-10-11
Recorded: 2026-10-11
<!-- Extends ADR-0008, which introduced the StorageDriver interface with Cloudinary only. -->

## Context

ADR-0008 put storage behind an interface but implemented only Cloudinary. A sister project's notes describe the same need for S3, R2, MinIO, Supabase, ImageKit, Vercel Blob and local disk, and show two pitfalls worth avoiding: silent fallbacks (an unconfigured deployment quietly landing on another provider) and access decided only by provider-side bucket settings.

## Decision

1. Two driver shapes behind `getStorage()` (`lib/storage/`, one file per provider in `providers/`):
   - **direct** (Cloudinary): the browser uploads straight to the provider; private files are `authenticated` assets, read through a signed, expiring link.
   - **proxy** (S3, R2, MinIO, Supabase via one S3-compatible driver; ImageKit; Vercel Blob; local disk): the file goes through `POST /api/v1/uploads/file`, which enforces role, size (`UPLOAD_MAX_BYTES`, default 4 MB) and content type (JPEG/PNG/WebP/GIF/PDF) before storing.
2. Access is explicit per folder (`FOLDER_ACCESS`), and for proxy drivers it is part of the key: `private/<folder>/<ownerId>/…` vs `public/<folder>/<ownerId>/…`. The public reader (`GET /uploads/public`) can only ever construct `public/…` keys and only for public folders; private files are read only through `GET /uploads/private`, which authorises first and streams with `nosniff` and `no-store`.
3. Selection is explicit (`STORAGE_PROVIDER`, default `cloudinary`). No credential auto-detection, no fallback; an unknown name throws; `local` is refused when `NODE_ENV=production`.
4. Replacing an ID document deletes the old private file (best effort).

## Alternatives Considered

- **Auto-detect the provider from whichever credentials exist:** rejected, two sets of credentials silently pick one.
- **Only presigned direct uploads for every provider:** better for large files, rejected for now as more per-provider code that cannot be tested here; proxy uploads work everywhere.
- **Stream every download through the server for Cloudinary too:** rejected, the signed redirect avoids server bandwidth.

## Consequences

- Proxy uploads are limited by the host's request-body cap, so video (the 360° tour) is **not** supported on proxy providers; use Cloudinary for that.
- Switching providers does not move existing files; old references stop resolving.
- Only the local driver, the S3-compatible request shape and the Cloudinary destroy call are covered by tests here. **S3/R2/MinIO/Supabase, ImageKit and Vercel Blob have not been run against real services**; ImageKit's signed-URL scheme is written from documentation and flagged unverified.
- **Revisit if:** large uploads over proxy providers are needed (add presigned PUT), or a provider is retired.

## Enforced by

`tests/api/storage-drivers.test.ts` (refs and keys, local driver, S3 driver with a fake client, provider selection, owner folders, public/private separation, Cloudinary destroy) and `tests/api/uploads-private.test.ts`.

## Binds

- `lib/storage/` (`index.ts`, `files.ts`, `types.ts`, `providers/*`), `lib/privateRef.ts`, `lib/uploadPolicy.ts`, `lib/uploadClient.ts`
- `app/api/v1/uploads/{sign,file,public,private}/route.ts`, `app/api/v1/auth/me/route.ts`
