# 0010 — Uploads are StoredFile rows served through one file gateway

Status: Accepted
Decided by: roji-tech · Date: 2026-10-11
Recorded: 2026-10-11
Supersedes: 0007, 0008, 0009

## Context

ADRs 0007–0009 (all still Proposed, nothing shipped) made ID documents private, bound references to their owner and added several storage providers, but kept the provider and access rules scattered: private files used provider-shaped references (`cldp:` / `stor:private:`), public ones were bare URLs, a provider switch stranded files, and the audit log recorded nothing about files. The owner then decided: Cloudinary stays the default with other providers available, maintenance photos become private, files get a `StoredFile` table, S3-family providers use presigned uploads and downloads, and file access is audited.

## Decision

1. **`StoredFile` table** (`prisma/schema/storage.prisma`): one row per file with owner, folder, access, **provider**, key, original name, content type, size, status (`PENDING` → `READY` → `DELETED`) and provider-specific `meta`.
2. **Model fields keep a plain string: the gateway URL `/api/v1/files/<id>`**, for public and private files alike. No per-field schema change; arrays and JSON keep working.
3. **One gateway, `GET /api/v1/files/[id]`**, decides access and serves the file from the provider recorded on its own row (so changing `STORAGE_PROVIDER` strands nothing):
   - public folders: anyone; private: the owner, an admin, or someone related (a manager/landlord of a property the owner applied to or leases; for maintenance files the tenant, the property's manager/landlord and the assigned vendor, via a request that actually carries the file); everyone else gets 404.
   - delivery by redirect to a short-lived signed/presigned URL where the provider supports it (Cloudinary, S3-compatible), otherwise streamed (local, ImageKit, Vercel Blob), with `nosniff` and `no-store` for private files.
4. **Two-step upload:** `POST /uploads/sign` checks role, type and size, creates the `PENDING` row and returns a plan — a Cloudinary form POST, an S3 presigned PUT, or the proxy endpoint. `POST /uploads/complete` (direct providers) or `POST /uploads/file` (proxy providers) verifies and marks `READY`. S3 completion inspects the real object (`HEAD`) and deletes it if it breaks type/size limits; Cloudinary signatures fix `public_id`, `type` and `allowed_formats`.
5. **Attaching a file to a record requires owning it:** any gateway URL in a profile ID or a maintenance request's media/proof must be a `READY` file uploaded by the caller, in the right folder.
6. **Folder access is an explicit table** (`FOLDER_ACCESS`): `profile`, `applications`, `maintenance-requests` private; `properties` public. Provider selection is explicit (`STORAGE_PROVIDER`, default `cloudinary`); `local` is refused in production.
7. **Audit** (`AuditLog`, entity `StoredFile`): `FILE_UPLOADED`, `FILE_READ` (private reads), `FILE_DELETED`, `FILE_PROVIDER_MISMATCH` (file's provider not configured), with provider/folder/owner in `metadata` and never file contents.
8. **Replacing an ID document** deletes the old object and marks its row `DELETED`; the daily `storage-janitor` job removes uploads left `PENDING` for over 24 hours.

## Alternatives Considered

- **Provider column beside every file field:** arrays need parallel arrays that drift, JSON gets nothing, easy to forget on new fields.
- **Self-describing stored values:** no table to audit or migrate from.
- **Stream every file through the server:** simplest, but costs bandwidth and serverless time for large files and caps uploads at the host's body limit.

## Consequences

- Every file read costs one DB lookup plus a redirect (public files are cacheable for 60 s).
- Moving files between providers is now a data operation (copy object, update `provider`/`key`).
- S3-compatible buckets need a CORS rule allowing `PUT` from the app origin. Presigned PUT cannot cap size, so oversize uploads are deleted after the fact.
- Only Cloudinary, S3-compatible, Vercel Blob, ImageKit and local are implemented; **only the local provider and request shapes are tested here.** ImageKit's signed-URL scheme is from documentation.
- Fields with no upload path today (`Notice.documentUrl`, `Lease.signedAgreementUrl`, `Message.attachmentUrls`, `avatarUrl`, `evidenceUrls`) are not yet routed through the gateway.
- Identity-document retention/erasure (NDPR) still needs a policy.
- **Revisit if:** files must be shown inline without a redirect, or a provider is retired.

## Enforced by

`tests/api/files.test.ts` (upload flow, access matrix, audit, provider mismatch, maintenance relation, ownership of attachments, replacement, janitor) and `tests/api/storage-drivers.test.ts` (drivers, selection, URL parsing).

## Binds

- `prisma/schema/storage.prisma`, `lib/fileRef.ts`, `lib/uploadPolicy.ts`, `lib/uploadClient.ts`
- `lib/storage/` (`index.ts`, `service.ts`, `types.ts`, `keys.ts`, `providers/*`), `lib/workers/storageJanitor.ts`
- `app/api/v1/uploads/{sign,file,complete}/route.ts`, `app/api/v1/files/[id]/route.ts`
- `app/api/v1/auth/me/route.ts`, `app/api/v1/maintenance/requests/**`
