# Admin components

Behind the routes in [`../pages/admin.md`](../pages/admin.md). Three of the admin screens
(`/admin/users`, `/admin/security` and `/admin/settings`) keep their whole UI inside the page file,
so they have no component of their own.

| File                                            | Description                                                                                                                                                                                                                                                                                 |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/admin/AdminChrome.tsx`                     | The frame of every `/admin/*` page: sidebar (System Overview, Properties, User Management, Reports, Bank Transfers, Security, Platform Settings), a slide-over drawer on a phone, the notification bell, the dev role switcher and a sign-out confirmation. Mounts `ResponsiveTables`       |
| `AdminDashboard.tsx`                            | System Overview: platform totals from `useAdminSummary` (summed in the database, ISS-049), the attention list, and cards that open the breakdowns                                                                                                                                           |
| `AdminBreakdownPage.tsx`                        | The page a card opens: `users`, `properties`, `transactions` or `maintenance`, with status and priority buckets from the server and a paged table                                                                                                                                           |
| `AdminReports.tsx`                              | Reports and analytics in five tabs: Overview, Financial (revenue trend, revenue by invoice type, the revenue ledger), Users (new users by role, distribution, roles by status), Properties (by state and by type, a state detail) and Maintenance (the monthly summary), over a month range |
| `app/admin/properties/PropertyReviewDrawer.tsx` | The moderation drawer (a side panel on desktop, a bottom sheet on a phone): the listing's summary, owner and manager contacts, units, a moderation notes box, and the actions: approve or reject a listing or a unit, approve a staged edit, unpublish, re-approve                          |
| `app/admin/properties/MergeDuplicateModal.tsx`  | Merge a duplicate listing into another. Offers the properties that share its address fingerprint (`listingHash`) first, or a search; the merge can be undone from the property page                                                                                                         |

Shared with the dashboard (see [`dashboard.md`](./dashboard.md) and [`shared.md`](./shared.md)):
`PropertyDetail` (`/admin/properties/[id]`), `BankTransferReconciliation` (`/admin/payments`),
`NotificationsPage` (`/admin/notifications`), `ConfirmDialog` and `LogoutConfirmDialog`.
