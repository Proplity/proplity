# Components

Every component in the app. Proplity keeps nearly all of them in one folder, `app/components/`, plus
a few that sit next to the layout or page that owns them. One file per area:

| File                             | Covers                                                                                                                                                                                 |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public.md`](./public.md)       | The marketing site, sign-in and registration, the public property page, receipts, the setup wizard and the in-app guide                                                                |
| [`dashboard.md`](./dashboard.md) | The dashboard shell and everything behind `/dashboard/*`: the four role dashboards and the tenant, property-team and vendor screens                                                    |
| [`admin.md`](./admin.md)         | The admin shell and the components behind `/admin/*`                                                                                                                                   |
| [`shared.md`](./shared.md)       | Used by more than one area: the `ui/` primitives, dialogs, the file viewer, notifications, photo grids, the attention list, phone table cards, the PWA helper and the dev-only widgets |

Conventions that apply to all of them:

- Components do not fetch with raw `fetch`. They read through the hooks in `hooks/` and write through
  `hooks/useApiSubmit.ts` or the typed `api.*` client (see [`../functions/client.md`](../functions/client.md)).
- Every dashboard component takes an optional `onNavigate(page)` prop; the page passes
  `navigateToPage(router, page)` ([`../pages/index.md`](../pages/index.md)).
- Files go through `uploadFile()` and are shown through the file gateway (`/api/v1/files/<id>`); a
  link to a file opens in the shared viewer, not a new tab.
- Every new screen must pass `tests/e2e/responsive/layout.spec.ts` (no sideways scroll or cut-off
  content at 320, 390 and 768 px).

See also [`../pages/index.md`](../pages/index.md) for the routes and
[`../functions/index.md`](../functions/index.md) for the hooks and logic behind them.
