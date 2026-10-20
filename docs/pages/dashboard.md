# Dashboard pages (`/dashboard/*`)

One set of routes for four roles. `app/dashboard/layout.tsx` requires a session and renders
`DashboardChrome`, whose sidebar (and phone tab bar) shows each role its own tabs; `proxy.ts` sends
an admin to `/admin` instead. The **Roles** column says who a page is for; a page opened by the
wrong role is not blocked in the page itself but the API behind it refuses the data. Components are
in [`../components/dashboard.md`](../components/dashboard.md).

Tabs by role (from `getTabsForRole` in `DashboardChrome.tsx`):

| Role     | Tabs                                                                                                     |
| :------- | :------------------------------------------------------------------------------------------------------- |
| Tenant   | Dashboard, Browse Properties, Payment History, My Rentals, Messages                                      |
| Manager  | Dashboard, My Properties, Discover Properties, Tenants, Maintenance, Messages, Bank Transfers, Schedules |
| Landlord | Portfolio, Tenants, Maintenance, Messages, Bank Transfers, Schedules                                     |
| Vendor   | My Jobs, Invoices, Messages                                                                              |

## Home and shared pages

| Route                         | File                                  | Roles                             | Description                                                                                                                                                                                                  |
| :---------------------------- | :------------------------------------ | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                  | `dashboard/page.tsx`                  | tenant, manager, landlord, vendor | The role's home: `TenantDashboard`, `Dashboard` (manager), `LandlordDashboard` or `VendorDashboard`. Waits for the role to load before choosing, so no role flashes another's dashboard                      |
| `/dashboard/breakdown/[type]` | `dashboard/breakdown/[type]/page.tsx` | manager, landlord                 | The page a dashboard card opens: `properties`, `tenants`, `rent`, `maintenance` or `renewals`, with totals from the server and a paged table                                                                 |
| `/dashboard/messages`         | `dashboard/messages/page.tsx`         | all four                          | Conversations and messages (`MessagingPortal`); `?c=<id>` opens one (the "Message …" buttons use it)                                                                                                         |
| `/dashboard/notifications`    | `dashboard/notifications/page.tsx`    | all four                          | The full notification list (the bell in the header shows the newest few)                                                                                                                                     |
| `/dashboard/settings`         | `dashboard/settings/page.tsx`         | all four                          | Account Settings in up to three tabs: General & Security (profile, change password), Setup & Verification (Profile Completion for a tenant) and, for managers, landlords and vendors, Payout & Bank Accounts |

## Properties

| Route                                         | File                                                  | Roles                     | Description                                                                                                                                                                                          |
| :-------------------------------------------- | :---------------------------------------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/properties`                       | `dashboard/properties/page.tsx`                       | manager, landlord         | "My Properties": the properties the person manages or owns, as a searchable list or grid with status badges                                                                                          |
| `/dashboard/properties/new`                   | `dashboard/properties/new/page.tsx`                   | manager, landlord         | List a new property: details, units, photos and video, then submit for admin review (`ListProperty`)                                                                                                 |
| `/dashboard/properties/[id]`                  | `dashboard/properties/[id]/page.tsx`                  | tenant, manager, landlord | A tenant sees the listing (`PublicPropertyDetail`); the property team sees the management page (`PropertyDetail`: edits, units, tenants, equipment, announcements, viewings, applications, finances) |
| `/dashboard/properties/[id]/apply`            | `dashboard/properties/[id]/apply/page.tsx`            | tenant                    | Rental application. Sends a tenant with an incomplete profile to `/dashboard/profile/complete` first                                                                                                 |
| `/dashboard/properties/[id]/schedule-viewing` | `dashboard/properties/[id]/schedule-viewing/page.tsx` | tenant                    | Book a viewing: a date (Mon to Sat) and a half-hour start time, 9:00 to 17:00 Lagos                                                                                                                  |
| `/dashboard/properties/[id]/neighbourhood`    | `dashboard/properties/[id]/neighbourhood/page.tsx`    | manager, landlord         | Edit the neighbourhood report that the property page shows (`NeighbourhoodReportEditor`)                                                                                                             |
| `/dashboard/discover`                         | `dashboard/discover/page.tsx`                         | tenant, manager           | Browse or discover published properties with filters and trust scores; the property's own team also sees the ad-campaign buttons                                                                     |
| `/dashboard/neighbourhood-report`             | `dashboard/neighbourhood-report/page.tsx`             | tenant                    | The neighbourhood report for the tenant's current home (from their active lease)                                                                                                                     |
| `/dashboard/rentals`                          | `dashboard/rentals/page.tsx`                          | tenant                    | "My Rentals": the tenant's leases, each opening its property page                                                                                                                                    |
| `/dashboard/profile/complete`                 | `dashboard/profile/complete/page.tsx`                 | tenant                    | Fill in the tenant profile once (identity, emergency contact, previous landlord, ID); an application needs it                                                                                        |

## Tenants and leases (property team)

| Route                     | File                              | Roles             | Description                                                                                                                                                                            |
| :------------------------ | :-------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/tenants`      | `dashboard/tenants/page.tsx`      | manager, landlord | Every tenant with a lease on the person's properties; rent status (paid, due, overdue) is derived from the lease's rent invoices                                                       |
| `/dashboard/tenants/add`  | `dashboard/tenants/add/page.tsx`  | manager, landlord | Add a tenant and a lease on one of the person's units (multi-step form)                                                                                                                |
| `/dashboard/tenants/[id]` | `dashboard/tenants/[id]/page.tsx` | manager, landlord | The tenancy record. `[id]` is the **lease** id: signature, terms, renew, send notice, invoices, **Record cash or transfer payment**, violations, condition reports, notes, maintenance |

## Repairs and schedules

| Route                                | File                                         | Roles             | Description                                                                                                                                                               |
| :----------------------------------- | :------------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard/maintenance`             | `dashboard/maintenance/page.tsx`             | manager, landlord | The repair board in columns by status, with **Raise a repair** (a work order with no tenant)                                                                              |
| `/dashboard/maintenance/[id]`        | `dashboard/maintenance/[id]/page.tsx`        | manager, landlord | One repair: triage, vendor, photos and evidence, timeline, cost, approve or send back. Tenants are redirected to `tenant-maintenance?request=`, vendors to their job page |
| `/dashboard/schedules`               | `dashboard/schedules/page.tsx`               | manager, landlord | Recurring maintenance: add, pause, resume or remove a schedule; the daily job raises the repairs                                                                          |
| `/dashboard/maintenance-request/new` | `dashboard/maintenance-request/new/page.tsx` | tenant            | Report a repair with category, priority and photos                                                                                                                        |
| `/dashboard/tenant-maintenance`      | `dashboard/tenant-maintenance/page.tsx`      | tenant            | The tenant's repair requests; `?request=` opens one, with **Confirm fixed** or **Still a problem**                                                                        |

## Money

| Route                        | File                                 | Roles             | Description                                                                                                                        |
| :--------------------------- | :----------------------------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/payment-history` | `dashboard/payment-history/page.tsx` | tenant            | Invoices and payments, pay by card, **Paid another way** (bank transfer or cash), receipts, auto-pay                               |
| `/dashboard/reconciliation`  | `dashboard/reconciliation/page.tsx`  | manager, landlord | Bank transfers recorded by tenants or the team; someone other than the recorder confirms or rejects (admins use `/admin/payments`) |

## Vendor

| Route                                 | File                                          | Roles  | Description                                                                                 |
| :------------------------------------ | :-------------------------------------------- | :----- | :------------------------------------------------------------------------------------------ |
| `/dashboard/vendor/invoices`          | `dashboard/vendor/invoices/page.tsx`          | vendor | The vendor's own invoices (new ones start from a job)                                       |
| `/dashboard/vendor/jobs/[id]`         | `dashboard/vendor/jobs/[id]/page.tsx`         | vendor | One job: details, before and after photos, status, message the tenant or team               |
| `/dashboard/vendor/jobs/[id]/invoice` | `dashboard/vendor/jobs/[id]/invoice/page.tsx` | vendor | Create the invoice for a job. Sending it completes the job, once the finished work is shown |
