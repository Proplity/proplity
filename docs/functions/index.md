# Functions

Every non-component logic file in the app: hooks, contexts, the API client, server helpers, payment
and storage services, and the background workers. One file per area:

| File                                                   | Covers                                                                                                                                                                                |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`client.md`](./client.md)                             | `hooks/` (27), `context/`, and the browser-side `lib/` files: `apiClient.ts`, `uploadClient.ts`, `safeRedirect.ts`, `notificationSound.ts`, plus `app/store/` (illustrative data)     |
| [`server.md`](./server.md)                             | `proxy.ts`, `lib/api/` (route plumbing), `lib/auth/`, the domain rules (repairs, schedules, viewings, listings, tenant profile), dashboards, notifications, email, settings and flags |
| [`payments-and-storage.md`](./payments-and-storage.md) | `lib/payments/` (bank transfers, vendor payouts, mock gateway, auto-pay token), receipts, and `lib/storage/` with the upload policy and the file gateway                              |
| [`workers.md`](./workers.md)                           | The ten background jobs in `lib/workers/` and how `/api/v1/cron/[job]` runs them                                                                                                      |

There are no `services/`, `utils/` or `types/` folders. Route handlers hold their own business
logic and call the helpers below; shared API types are in `lib/api/types.ts`.

Rules that cut across these files (they are also in `CLAUDE.md`):

- A route wrapped in `withAuth` gets, in order: the CSRF check on writes, the session, a fresh read
  of the account (a suspended person is locked out at once and a role change applies at once) and
  the role check. It then runs `validateBody` and the business logic, and returns errors through
  `handleApiError`. The auth routes call `validateCSRF` and the rate limiter themselves.
- Payments in a response are always selected with `PUBLIC_PAYMENT_SELECT`; users are never
  included whole (select the fields a screen shows).
- Roles are uppercase on the server and lowercase in the browser.

See also [`../components/index.md`](../components/index.md) for the components these files back and
[`../pages/index.md`](../pages/index.md) for the routes.
