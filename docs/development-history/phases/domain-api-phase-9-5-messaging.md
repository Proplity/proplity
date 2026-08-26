# Phase: Domain API Phase 9, sub-phase 5 — Messaging

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Fifth sub-phase of Phase 9. Covers `MessagingPortal.tsx` — the one component in the whole catalog needing a genuinely new hook (`useConversations`/`useMessages`), since Communications (Phase 6 of the domain-API roadmap: `Conversation`, `Message`, `ConversationParticipant`) had zero hooks built for it before now, unlike every other domain which already had at least a read hook from Phase 7 or an earlier Phase 9 sub-phase.

## A real, pre-existing gap this sub-phase resolves

CLAUDE.md's "Known gaps" section flagged: *"`GET /conversations`'s `unreadCount` only grows — no route updates `ConversationParticipant.lastReadAt`; nothing marks messages read."* That gap existed because nothing consumed the conversations API yet — there was no reader to mark anything read. Since this sub-phase builds that reader, fixing it now is a direct, in-scope part of hydrating the component correctly (an inbox where the unread badge never clears would be a broken experience, not just an unfinished one) rather than a tangential improvement.

**Fix**: `GET /conversations/[id]/messages` now updates the caller's `ConversationParticipant.lastReadAt` to now, after fetching the page. This is the natural point to mark a conversation read in a v1 polling-based design (CLAUDE.md: "Real-time messaging — v1 uses polling. WebSocket/SSE deferred") — opening a conversation's messages *is* reading it. Verified end-to-end: created a real conversation, sent a message as one user, confirmed the recipient's `unreadCount` was `1`, had them fetch the messages, confirmed `unreadCount` dropped to `0` — all against the live API, not just visually.

## Backend changes

- **`GET /api/v1/conversations/[id]/messages`** — the mark-as-read fix above.
- **`GET /api/v1/conversations`** — extended the conversation include with minimal `property`/`lease.unit.property`/`maintenanceRequest` selects (id/name/title only), so the conversation list can show real context (which property, lease, or maintenance request a thread is about) instead of the mock's flat, fabricated `propertyTitle` string.

## What was built

- **`lib/api/types.ts`** — added `Message`, `ConversationParticipant`, `Conversation`, `CreateConversationInput`, `CreateMessageInput`.
- **`lib/apiClient.ts`** — added `api.conversations.list/create` and `api.conversations.messages.list/create`.
- **`hooks/useConversations.ts`** (new file) — `useConversations()` (list, refetch-on-demand), `useMessages(conversationId)` (oldest-first for chat display, **polls every 5s while a conversation is open** — the first hook in this codebase to poll, matching the documented v1 design), `useSendMessage(conversationId)`, `useCreateConversation()` (built for parity with every other domain's hook set, but not wired to a UI this phase — see below).
- **`MessagingPortal.tsx`** — replaced `conversations`/`messages` mock imports with the new hooks. Dropped the dead `currentUserRole` prop (present in the original component's interface but never read anywhere in its body).
- **`app/dashboard/messages/page.tsx`** — dropped the now-unused `currentUserRole` prop pass-through.

## Real-vs-mock shape mismatches resolved (judgment calls)

- **A conversation has no single "the other participant."** The mock's flat `participantName` assumed exactly one other person (fine for `DIRECT`), but a real `MAINTENANCE_THREAD` conversation can have the tenant, vendor, manager, *and* landlord all as participants at once (see the `POST /conversations` route's own participant-derivation logic). Display name is now `conv.title` if set, else every other participant's name joined — and the subtitle uses the conversation's real linked context (maintenance request title → lease's property → property name → conversation type label as a last-resort fallback) instead of the mock's fabricated `propertyTitle`.
- **No "compose new conversation" UI was built.** The original mock never had one either (it only ever displayed pre-seeded threads), and every real `Conversation` type has its own natural creation context per the existing `POST /conversations` route — a `MAINTENANCE_THREAD` starts from a maintenance request, a `LEASE_THREAD` from a lease, `COMMUNITY_DISCUSSION` from a property. There's no single obvious "message someone" entry point to wire a bare compose button to without picking one of those contexts arbitrarily, so `useCreateConversation()` was built (matching every other domain's create-hook, e.g. `useAccessCodes`'s `create` from Phase 7 which also went unwired for a phase) but left unwired. Several earlier sub-phases' `onClick={() => onNavigate({type:'messages'})}` placeholders (`TenantDashboard`'s "Message Manager", `VendorJobDetail`'s "Message Manager") still just navigate to the generic inbox rather than opening a specific thread — unchanged from how they already worked, not a regression introduced here.
- **Seed data has zero `Conversation`/`Message` rows** (confirmed via `CURRENT_STATE.md`'s row-count table and re-confirmed live via `GET /conversations` returning `[]` for both a tenant and a manager account). This means every demo account's inbox is honestly empty by default — there was no shortcut around this without fabricating conversation history the schema doesn't have any seeded record of. Full read/write verification instead used a real conversation created live via the actual `POST /conversations`/`POST .../messages` routes (a `MAINTENANCE_THREAD` off the one seeded `IN_PROGRESS` request, tenant ↔ manager), then deleted afterward (`Conversation` cascades to its `ConversationParticipant`/`Message` rows) to keep the seed dataset's documented row counts accurate, per this engagement's standing cleanup discipline.
- **`MoreVertical` "more options" button dropped** (was already a bare, unwired decoration in the mock) — `Phone`/`Video` call buttons kept as-is since they're plausible real future actions on a chat surface, not tied to any fabricated backing data, matching how `TenantDetail`'s decorative "Call Tenant"/"WhatsApp" quick actions were treated in sub-phase 3a.
- **`currentUserRole` prop dropped** — present on the original component's TypeScript interface and passed by its page wrapper, but never once read inside the component body. Confirmed via full read of the original file before removing it.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors. `pnpm build` — succeeds.
- Live-tested against the real dev server and seeded database:
  - Confirmed the honest empty state: `GET /conversations` returns `[]` for `tenant@proplity.com`, and `/dashboard/messages` renders `200` with no error.
  - **Created a real `MAINTENANCE_THREAD` conversation** via `POST /conversations` off the one seeded `IN_PROGRESS` maintenance request (tenant `Jordan Hayes` ↔ manager `Alex Vance`), confirming the real participant-derivation logic (tenant + assigned vendor + property manager) already built in Phase 6.
  - Sent a real message as the tenant, confirmed the manager's `GET /conversations` showed `unreadCount: 1` and the real `lastMessage`/`maintenanceRequest.title` context.
  - **Verified the mark-as-read fix end-to-end**: manager fetched `GET .../messages`, confirmed `unreadCount` dropped to `0` on the next `GET /conversations` call; manager replied; confirmed the tenant's `unreadCount` rose back to `1` (correctly excluding the tenant's own prior message from the count).
  - Both `/dashboard/messages` page renders (tenant and manager) returned `200` with no server-side exception.
  - **Cleaned up**: deleted the test conversation via a direct Prisma script (no `DELETE /conversations` route exists), re-confirmed `GET /conversations` returns `[]` again for both accounts afterward — the seed dataset's documented `Conversation: 0, Message: 0` row counts still hold.
- **Not verified**: interactive browser click-through (the 5-second polling loop's actual UI refresh behavior, the search box, Enter-to-send) — no browser-automation tool available in this environment, same caveat as every prior frontend phase.

## Next up

Sub-phase 6 — Admin views: `AdminDashboard.tsx`, `AdminBreakdownPage.tsx`, `AdminReports.tsx` — flagged from the start of Phase 9 planning as the highest-risk remaining sub-phase, since these show platform-wide aggregates and no existing route computes anything cross-tenant; likely needs 1–2 new `ADMIN`-only aggregate endpoints, the same category of work as this sub-phase's new `GET /vendors` (built in 9.3a) rather than a pure frontend swap.
