# 0007 — Identity and application documents are private assets behind an authorised, expiring link

Status: Proposed
Decided by: roji-tech (pending acceptance) · Date: 2026-10-11
Recorded: 2026-10-11

## Context

Tenant ID documents were uploaded with a public Cloudinary signature and stored as the permanent `secure_url` in `User.idDocumentUrl`, which `GET /auth/me` also returns. Anyone holding that URL could open a government ID forever (ISS-031). Separately, any logged-in role could sign an upload into any folder (ISS-032).

## Decision

1. Uploads to the `profile` and `applications` folders are signed with `type=authenticated`. The plain delivery URL stops working.
2. The database stores an opaque reference `cldp:<resource_type>/<public_id>[.<format>]` (`lib/privateRef.ts`), never a URL.
3. `GET /api/v1/uploads/private?ref=…` is the only way to read such a file. It allows the owner, an ADMIN, and a MANAGER/LANDLORD of a property the owner applied to or leased; everyone else gets 404. It 302-redirects to a Cloudinary API download URL signed with `expires_at` (5 minutes) and `Cache-Control: private, no-store`.
4. `POST /uploads/sign` allows each folder only to the roles that need it (`FOLDER_ROLES`).

## Alternatives Considered

- **Proxy the bytes through our server:** simplest to authorise, rejected for serverless body/time limits and cost.
- **Cloudinary token-based authentication (signed delivery URLs):** needs a plan feature we can't assume; the API download URL works on every plan.
- **Leave public, rely on unguessable names:** rejected, URLs leak through logs, email, browser history and `/auth/me` responses.

## Consequences

- Rows already holding a public URL keep working but remain public; they should be re-uploaded (a backfill to `authenticated` is a separate, optional job).
- `PATCH /auth/me` still accepts any non-empty string for `idDocumentUrl`; a user could point it at another user's reference only if they already knew its random public id.
- File size/type limits are not enforced at signing (Cloudinary upload presets would do that).
- **Revisit if:** Cloudinary is replaced, or documents must be viewable inline in the app (then add a thin authenticated proxy).

## Enforced by

`tests/api/uploads-private.test.ts` (reference parsing, signed-URL shape, endpoint authorisation, role-gated signing).

## Binds

- `lib/privateRef.ts`, `lib/cloudinary.ts`, `lib/uploadClient.ts`
- `app/api/v1/uploads/sign/route.ts`, `app/api/v1/uploads/private/route.ts`
- `User.idDocumentUrl` consumers: `CompleteProfileForm.tsx`, `auth/me`
