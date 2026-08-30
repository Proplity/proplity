# Phase: Domain API Phase 4 — Financial, Invoicing & Payments API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Fourth domain API: invoices (the billing record every other domain already links to — leases' initial rent, maintenance completions), and the Paystack-backed payment lifecycle (checkout initialization, webhook confirmation, and tenant auto-pay mandates).

## Scope decision made before building

CLAUDE.md's status table lists Paystack as "Not started," and there was no `PAYSTACK_SECRET_KEY` in `.env`. Asked the user how to handle the two Paystack-dependent routes rather than assuming; chose to build all 5 routes per spec, live-test everything that doesn't need a real Paystack account, and flag what remains genuinely unverified against a live account.

## What was built

Five routes, exactly as scoped in `docs/development-history/domain-api-implementation-plan.md`'s Phase 4 section:

- **`app/api/v1/invoices/route.ts`** — `GET` filters (`type`/`status`/`dueDate`) plus role-scoping following the same OR-across-relations pattern needed here for the first time (an invoice's owner could be via `lease`, `maintenanceRequest`, or a direct `userId`): `TENANT` sees invoices tied to their own lease, request, or direct charge; `VENDOR` sees invoices on requests assigned to them; `MANAGER`/`LANDLORD` see invoices on properties they manage/own via either the lease or maintenance-request path; `ADMIN` sees all. `POST` restricted to `ADMIN`/`MANAGER`/`VENDOR` exactly as spec'd (no `LANDLORD` — followed literally, matching Phase 3's notes-route precedent for an explicit two/three-role list rather than extending it). `VENDOR` further restricted to `type: MAINTENANCE` invoices where they're the assigned `vendorId` on the referenced request. App-level "at least one of `leaseId`/`maintenanceRequestId`/`userId`" check (Prisma can't express it). `invoiceNumber` never set by app code (`dbgenerated`); a `P2002` retries the insert once.
- **`app/api/v1/invoices/[id]/route.ts`** — `GET` (owner tenant/vendor, or `canManageProperty()` on the linked lease's or request's property, or `ADMIN`) returns the invoice with its `payments`. `PATCH` (`ADMIN`/`MANAGER` only) updates `status`/`amount`.
- **`app/api/v1/payments/initialize/route.ts`** — `POST` (the invoice's payer — lease tenant or direct `userId` — or `ADMIN`) calls Paystack's real `transaction/initialize` REST endpoint and returns the checkout URL. **Deliberate deviation from the plan text**, explained below.
- **`app/api/v1/payments/webhook/route.ts`** — `POST`, HMAC-SHA512 signature verification (`x-paystack-signature` against `PAYSTACK_SECRET_KEY`) over the *raw* request body before any parsing, using `crypto.timingSafeEqual` for the comparison. On `charge.success`: creates the `Payment` row (amount converted from kobo, `rawProviderPayload` stores the raw JSON, `paidAt` from the provider's timestamp) and flips `Invoice.status` to `PAID`, both in one transaction. Guards against Paystack's documented webhook-redelivery behavior by checking for an existing `Payment` with the same `transactionRef` before writing.
- **`app/api/v1/payments/autopay/route.ts`** — `GET` (`TENANT`, own active mandates, optional `?leaseId=` filter); `POST` (`TENANT`, must own the referenced lease) stores only `paymentMethodToken` — never raw card/account data, per the schema's own comment; `DELETE` (`?id=`, must own the mandate) is a soft-cancel (`status: CANCELLED`), never a hard delete.

## Deliberate deviation: no Payment row at `initialize` time

The plan's spec text says `initialize` should create "a pending Payment row." The `Payment` model has **no status field** and a **required, `@default(now())` `paidAt`** — it's shaped to represent a completed payment, not a pending one. Writing a `Payment` row at initialize time would mean a `paidAt` timestamp for money that hasn't actually moved yet, which is worse than not writing anything. Instead: `initialize` makes no DB write at all — it passes `metadata: { invoiceId }` to Paystack, which echoes it back on the webhook callback, and the real `Payment` row (with a genuine `paidAt`) is only created in `payments/webhook` once `charge.success` actually fires. The invoice stays `UNPAID` in between; the returned `authorizationUrl`/`reference` pair is the only "pending" state that exists, held client-side, not in the database.

## What's verified vs. what isn't

Live-tested end-to-end against the real dev server and seeded database, all 5 demo roles:

- **Invoices** (`GET`/`POST`/`PATCH`) — fully verified, including the OR-across-relations scoping, the vendor type/assignment restriction, the "at least one of" 400, and access control on `/[id]`.
- **`/payments/autopay`** — fully verified (`POST`/`GET`/`DELETE`, ownership checks, soft-cancel).
- **`/payments/webhook`** — fully verified, **including the success path**: added a throwaway `PAYSTACK_SECRET_KEY` to `.env`, computed a real HMAC-SHA512 signature locally the same way Paystack would, and POSTed a `charge.success` payload. Confirmed the invoice flipped to `PAID`, the `Payment` row had the correct kobo→amount conversion, mapped `paymentMethod`, and stored `rawProviderPayload`; confirmed a bad signature is rejected (`401`); confirmed redelivering the identical event does **not** create a second `Payment` row (idempotency guard works). The test key was removed from `.env` afterward (it's gitignored either way) to leave the "not configured" state honest for the next session — `PAYSTACK_SECRET_KEY` is unset again.
- **`/payments/initialize`** — verified the parts that don't need a real Paystack account: payer-authorization boundary (`403` for a non-payer, non-admin caller), unauthenticated `401`, and the "not configured" `503` when `PAYSTACK_SECRET_KEY` is unset. **Not verified**: an actual successful call to Paystack's `transaction/initialize` endpoint (would need a real Paystack test-mode account, which wasn't provided this phase) — the request/response handling code is written against Paystack's documented contract but hasn't executed against their live API.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors (one real type error caught and fixed: `crypto.timingSafeEqual` rejects `Buffer` under this TS/`@types/node` combination — fixed by wrapping both sides in `new Uint8Array(...)`).
- `pnpm build` — succeeds, all 5 new routes listed alongside the existing 51.
- All test rows (4 invoices across the create-permission tests, 1 payment, 1 autopay mandate) cleaned up afterward via a one-off script.

## Next up

Phase 5 — Access Control & Visitor Management API (`app/api/v1/access-codes/*`), already spec'd in `docs/development-history/domain-api-implementation-plan.md`.
