# 0008 — Private uploads are namespaced by owner, behind a storage-driver interface

Status: Proposed
Decided by: roji-tech (pending acceptance) · Date: 2026-10-11
Recorded: 2026-10-11
<!-- Refines ADR-0007; does not supersede it. -->

## Context

ADR-0007 made ID and application documents private, but ownership of a reference was established by a database lookup of "whoever stores this string", and `PATCH /auth/me` accepts any string for `idDocumentUrl` (ISS-034). A user who learned another user's reference could store it on their own profile and read it. The route code was also tied directly to Cloudinary, although other storage may be wanted later.

## Decision

1. Private uploads are signed into `<folder>/<userId>/` (`profile/<id>/…`). The reference therefore carries its owner (`privateRefOwnerId`).
2. `PATCH /auth/me` rejects a private reference whose embedded owner is not the caller.
3. `GET /uploads/private` takes the owner from the reference and requires that user to actually hold it; authorisation then proceeds as in ADR-0007.
4. Routes talk to a `StorageDriver` (`lib/storage/types.ts`: `isConfigured`, `signUpload`, `privateDownloadUrl`) obtained from `getStorage()`, selected by `STORAGE_PROVIDER` (default `cloudinary`). An unknown value throws instead of falling back.

## Alternatives Considered

- **Verify ownership by DB lookup only (ADR-0007):** leaves the hijack in ISS-034.
- **Server-side upload that records the uploader:** rejected, the file would pass through the serverless function.
- **Write S3/R2/MinIO/Supabase/ImageKit drivers now:** rejected as unused code with no way to test it here; the interface makes each a self-contained addition.

## Consequences

- Only the Cloudinary driver exists. Other providers (and the `cldp:` reference scheme, which is Cloudinary-shaped) need work when one is added.
- References created before this change (no owner segment) are not accepted by `PATCH /auth/me` and are treated as unowned by the download route. None existed in production when this was written because ADR-0007 had not shipped.
- **Revisit if:** a second provider is needed, or documents must be shown inline (add a thin authenticated proxy).

## Enforced by

`tests/api/uploads-private.test.ts` (owner namespacing, `PATCH /auth/me` rejection, forged-reference 404, unknown-provider error).

## Binds

- `lib/privateRef.ts`, `lib/storage/`, `lib/cloudinary.ts`, `lib/uploadClient.ts`
- `app/api/v1/uploads/sign/route.ts`, `app/api/v1/uploads/private/route.ts`, `app/api/v1/auth/me/route.ts`
