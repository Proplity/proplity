# In-app notifications: bell, feed, toast, and sound

**Status:** In-app + email legs complete. Push is deliberately out of scope. **Date:** 2026-09-14.

## Why

PRD §5.1 lists "Automated notifications (email, in-app, push)" as a Communication feature, and the 2026-08-30 audit flagged it directly: "No in-app or push notifications — no model, no UI" (#16). `app/components/PropertyDetail.tsx`'s `AnnouncementsCard` even carried a comment noting announcements are "visible to every tenant... no notification system exists to push these" — the codebase already knew it needed this and named the first natural consumer.

## What was built

**Schema** (`prisma/schema/notification.prisma`, new): a `Notification` model (`recipientId`, `type: ANNOUNCEMENT | MAINTENANCE_STATUS | SYSTEM`, `title`, `body`, `link`, `isRead`, `createdAt`), indexed on `(recipientId, isRead, createdAt)` since the unread badge count is queried on every poll tick. `User` gained a `notifications Notification[]` back-relation. Migration hand-written (`prisma/migrations/20260914120000_notifications/migration.sql`) mirroring Prisma's generated SQL format exactly, the same approach used for `PasswordResetToken` — this sandbox has no live database to run `prisma migrate dev` against. Verified via `prisma validate`, `prisma generate`, and a full `next build`, all clean.

**Backend** (`lib/notifications.ts`, new): `notifyUser`/`notifyUsers`/`notifyByEmail` — every export swallows its own errors so a notification failure never fails the mutation that triggered it. `notifyByEmail` reuses `lib/email.ts`'s existing console-transport sender unchanged, covering the PRD's "email" leg with zero new plumbing.

**API** (`app/api/v1/notifications/`, new): `GET` (cursor-paginated, same `parseCursorPagination`/`buildCursorMeta` pattern as `conversations/[id]/messages`, plus an `unreadCount` folded into `meta` so the bell's poll and the full list share one endpoint), `PATCH /[id]` (toggle read state, 404s if the notification isn't the caller's), `DELETE /[id]`, `POST /mark-all-read`. All behind `withAuth`; CSRF intentionally not added, matching this codebase's actual convention for `withAuth`-wrapped CRUD (announcements, maintenance requests) rather than the stricter auth-route-only pattern.

**Real triggers, not a static demo:**

- `properties/[id]/announcements` `POST` now notifies every tenant with an `ACTIVE` lease on that property (awaited, not fire-and-forget — a Vercel function can freeze right after the response is sent, so an un-awaited promise isn't reliably delivered).
- `maintenance/requests/[id]` `PATCH` notifies the request's tenant on vendor assignment, cancellation, `IN_PROGRESS`, and `COMPLETED` — except when the tenant is the one who made the change (a self-cancel doesn't notify yourself).

**Frontend:**

- `app/components/notifications/NotificationBell.tsx` — wired into the bell icon that already existed as an inert stub in `DashboardChrome.tsx` (`Bell` import + hardcoded red dot, no `onClick`). Built on the existing `app/components/ui/dropdown-menu.tsx` Radix primitive for correct focus/escape/click-outside handling, styled to match `DashboardChrome`'s plain gray/blue Tailwind idiom rather than the shadcn token system those primitives default to (the two styles coexist in this codebase; feature chrome uses the former).
- `app/components/notifications/NotificationsPage.tsx` + `app/dashboard/notifications/page.tsx` — full feed, mark-as-read/delete per row, "load more" cursor pagination, "mark all as read".
- `hooks/useNotificationBell.ts` — polls the same endpoint every 20s, diffs against a `seenIds` ref to find what's genuinely new since the last tick (never toasts for what was already there on mount), exposes `newlyArrived` for the toast/sound effect.
- `hooks/useNotifications.ts` — non-polling variant for the full page (one fetch + optimistic local updates on mutation), so the bell and the page aren't both polling simultaneously.
- Toast: `sonner`, already mounted at the root (`app/layout.tsx`) and used elsewhere (`DashboardChrome.tsx`'s own `toast.info` on logout) — no new toast infrastructure.
- Sound: `lib/notificationSound.ts` synthesizes a two-tone chime with the Web Audio API instead of shipping an audio file — this repo has no `public/` directory yet, and a synthesized tone needs no asset, no hosting, and sounds identical in every browser.

**Incidental fix**: `.github/workflows/migration-check.yml` used `prisma migrate diff --from-url ... --to-schema-datamodel ...` — both flags were removed in the Prisma 7.9.1 this repo is pinned to (`--from-url`/`--to-url` no longer exist at all; `--to-schema-datamodel` was renamed to `--to-schema`). The `|| true` on that step meant it was silently no-op-ing instead of ever producing the informational diff it exists for. Fixed to `--from-config-datasource --to-schema prisma/schema`, discovered while generating this feature's own migration diff locally.

## What's explicitly out of scope

**Push notifications** — the PRD's third leg. Needs VAPID keys, a service worker, and browser permission UX this repo has none of; a separate feature, not a gap in this one.

## Verification performed

- `prisma validate`, `prisma generate`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (with CI's own placeholder env vars) — all clean.
- `tests/api/notifications.test.ts` (new, 8 cases): ownership isolation on GET/PATCH/DELETE, cursor pagination correctness, `mark-all-read` scoping, the announcement trigger notifying exactly the property's active tenants (not a terminated lease's tenant, not an unrelated user), and the maintenance trigger notifying the tenant on vendor assignment / `IN_PROGRESS` / `COMPLETED` while correctly skipping a tenant's own self-cancel.
- **Not performed, and can't be from here**: actually running the test suite (needs a dedicated `proplity_test_db` via `.env.test`, which isn't configured in this sandbox) or a live browser check of the bell/toast/sound. CI's `postgres:18` service container will run `tests/api/notifications.test.ts` for real on this PR.
