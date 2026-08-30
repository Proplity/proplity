# Phase: Domain API Phase 6 — Communications API

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Sixth and final domain-API phase: unified messaging across all 5 `ConversationType` values (direct, maintenance/lease-linked threads, community discussion boards, support), backing PRD §5.1–§5.4's "unified messaging" and the WhatsApp AI assistant's human hand-off design (a future assistant just posts as `senderType: AI_ASSISTANT` into the same `Conversation` a human would use). This closes out the domain-API roadmap — Phases 7 (frontend integration) and 8 (background workers) are next.

## What was built

Two routes, plus a `lib/api/pagination.ts` addition the plan flagged in advance as needed here:

- **`lib/api/pagination.ts`** — added `parseCursorPagination()`/`buildCursorMeta()` (cursor mode, as the plan's Phase 0 section already anticipated: "Phase 6 messages are the one candidate"). Fetches `take + 1` rows and trims the lookahead row into `hasMore`/`nextCursor`, since a message thread can run to thousands of rows where page/limit's "page 40 of 10,000" isn't meaningful.
- **`app/api/v1/conversations/route.ts`** — `GET` returns the caller's threads (via `ConversationParticipant`), each with its last message and an `unreadCount` (messages after the participant row's `lastReadAt`, excluding the caller's own). `POST` branches by `ConversationType`, resolving the plan's explicit "decide the exact contract per type" open question:
  - `MAINTENANCE_THREAD` / `LEASE_THREAD` — participants **derived**, not caller-supplied: the request/lease's tenant, assigned vendor (maintenance only), and the property's manager/landlord. One thread per request (`maintenanceRequestId` is `@unique` on `Conversation`) or per lease — a second `POST` for the same link returns the existing conversation instead of erroring or duplicating.
  - `COMMUNITY_DISCUSSION` — participants derived as every property's active tenants plus its manager/landlord; access requires being one of them.
  - `DIRECT` / `SUPPORT` — unlinked, participants explicitly supplied via `participantIds`. `DIRECT` additionally dedupes: a second `POST` between the same two users returns the existing thread rather than spawning a new one (checked in application code, not a DB constraint — matches how `DIRECT` messaging apps are expected to behave).
- **`app/api/v1/conversations/[id]/messages/route.ts`** — `GET` cursor-paginated (newest-first, `?cursor=`/`?limit=`); `POST` (any `ConversationParticipant`) creates the message and touches the conversation's `updatedAt` in one transaction, so `GET /conversations`'s "most recent" sort stays correct without a second read.

## Judgment calls made resolving the plan's open question

- **`COMMUNITY_DISCUSSION` participant model**: `GET /conversations` only returns threads via `ConversationParticipant` rows — there's no separate "discover boards for a property" route in scope. A discussion board that didn't pre-populate every eligible viewer as a participant would be invisible to them. Resolved by adding every active tenant plus manager/landlord as participants at creation time, rather than inventing a second discovery mechanism beyond the plan's two-route scope.
- **`MAINTENANCE_THREAD`/`LEASE_THREAD` idempotency**: neither is `@unique` in a way that stops a second `POST` outright for leases (only `maintenanceRequestId` is `@unique` on `Conversation`) — implemented the same "return existing" behavior for both, since a second lease-thread for the same lease would be confusing to have to search for and pick a duplicate.

## Known follow-up, not built here

There is no route to update `ConversationParticipant.lastReadAt` — `unreadCount` in `GET /conversations` will only ever grow, never reset, since nothing marks messages as read. The plan's two-route scope for this phase didn't include a "mark read" endpoint; flagging rather than inventing one, since the right trigger (on `GET` messages? an explicit action?) is a product decision, not an obvious default.

## Verification performed

Full live end-to-end pass against the real dev server and seeded database, using all 5 demo roles:

- `POST /api/v1/conversations` `LEASE_THREAD` as the owning tenant → `201`; the same `leaseId` again as the property's manager → `200` with the identical conversation `id` (idempotency confirmed); as an unrelated vendor → `403`
- `POST .../messages` as an unrelated vendor (not a participant) → `403`; as the manager and the tenant (both real participants) → `201` each
- `GET .../messages?limit=1` → returned newest message with `hasMore: true` and a real `nextCursor`; following that cursor → the older message with `hasMore: false, nextCursor: null` (both pages of the real cursor-pagination flow confirmed)
- `GET /api/v1/conversations` as the tenant → `unreadCount: 1` (the manager's message; the tenant's own message correctly excluded from their own unread count)
- `POST` `DIRECT` between tenant and admin → `201`; the identical pair again → `200` with the same conversation `id` and its full participant list (dedup confirmed)
- `POST` `COMMUNITY_DISCUSSION` as an unrelated vendor (no lease on the property, not staff) → `403`; as the owning tenant → `201`
- `POST` `MAINTENANCE_THREAD` as the request's assigned vendor → `201`
- All test rows (4 conversations, their participants, and 2 messages) cleaned up afterward via a one-off script

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm build` — succeeds, all 2 new routes listed alongside the existing 59.

## Next up

All 6 domain-API phases from `docs/development-history/domain-api-implementation-plan.md` are now complete. Remaining: Phase 7 (frontend integration — wiring `lib/apiClient.ts` and the existing components to these routes, replacing `app/store/*` mock data) and Phase 8 (background workers/cron jobs).
