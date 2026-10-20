# Pages

Every page route in the app (`page.tsx` under `app/`), one file per area. Proplity is a single
product with five roles (`ADMIN`, `MANAGER`, `LANDLORD`, `TENANT`, `VENDOR`), so the split is by
who the page is for rather than by product.

| File                             | Covers                                                                                                                                                                                   |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public.md`](./public.md)       | Marketing pages, sign-in and registration, the public property page, receipts, the first-run setup wizard, the offline page, the dev-only mock checkout and the in-app guide (19 routes) |
| [`dashboard.md`](./dashboard.md) | `/dashboard/*`: one set of routes for tenants, managers, landlords and vendors. Each role sees its own tabs and its own version of `/dashboard` (28 routes)                              |
| [`admin.md`](./admin.md)         | `/admin/*`: the admin area (10 routes)                                                                                                                                                   |

That is 57 `page.tsx` files in all. API routes (100 `route.ts` files under `app/api/v1/`) are listed
by group in [`../../PROJECT_STRUCTURE.md`](../../PROJECT_STRUCTURE.md).

## Layouts, guards and special files

| File                              | What it does                                                                                                                                                                                                                                            |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/layout.tsx`                  | Root layout. Reads the session on the server to seed `AuthProvider`, wraps everything in `FileViewerProvider` (the global file viewer), mounts the toast container, `PwaRegister` and, only when `NEXT_PUBLIC_EMAIL_INBOX_ENABLED`, the dev email inbox |
| `app/dashboard/layout.tsx`        | Server check: no session sends the visitor to `/`; otherwise renders `DashboardChrome` (header, sidebar or phone tab bar, notification bell)                                                                                                            |
| `app/admin/layout.tsx`            | Server check: only `ADMIN` gets in (anyone else goes to `/dashboard`); renders `AdminChrome`                                                                                                                                                            |
| `proxy.ts`                        | Next 16's middleware. Edge guard for `/dashboard`, `/admin` and `/receipts`: an expired or missing `access_token` goes to `/?from=…`, a non-admin on `/admin` goes to `/dashboard`, an admin on `/dashboard` goes to `/admin`                           |
| `app/error.tsx`                   | Global error boundary                                                                                                                                                                                                                                   |
| `app/not-found.tsx`               | 404 page                                                                                                                                                                                                                                                |
| `app/dashboard/navigateToPage.ts` | Maps the old in-memory `Page` union to real routes. Every dashboard component takes an `onNavigate` prop and the page passes `navigateToPage(router, page)`; new code can use `<Link>` or `router.push` directly                                        |

New role-scoped tab? `MobileTabBar` shows only the first three tabs directly (the rest fold into
"More"), and `tests/e2e/responsive/mobile-nav.spec.ts` asserts that.
