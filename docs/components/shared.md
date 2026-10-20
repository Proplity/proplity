# Shared components

Used by more than one area. Everything is under `app/components/` unless a path says otherwise.

## `app/components/ui/` — primitives

Standard [shadcn/ui](https://ui.shadcn.com/) primitives (Radix plus Tailwind), one file per
component. **Only four are imported by screens today**: `sonner` (the toast container in the root
layout), `switch` (Platform Settings), `dropdown-menu` (the notification bell) and `utils.ts` (`cn`,
in `MobileTabBar`). The rest are scaffolding that only other primitives use; screens are mostly
plain Tailwind markup. Add a primitive here only when a screen needs it.

| File                                                                                                         | Description                                                                                                             |
| :----------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `accordion`, `collapsible`                                                                                   | Expandable sections                                                                                                     |
| `alert`, `alert-dialog`                                                                                      | Inline alert banner; confirmation dialog                                                                                |
| `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `card`, `separator`, `skeleton`                             | Layout and display helpers                                                                                              |
| `button`, `toggle`, `toggle-group`                                                                           | Buttons and toggle buttons                                                                                              |
| `calendar`, `carousel`, `chart`                                                                              | Date picker, slider, and a Recharts wrapper                                                                             |
| `checkbox`, `form`, `input`, `input-otp`, `label`, `radio-group`, `select`, `slider`, `textarea`             | Form controls (`form` wraps react-hook-form)                                                                            |
| `command`, `context-menu`, `dropdown-menu`, `hover-card`, `menubar`, `navigation-menu`, `popover`, `tooltip` | Menus and floating panels                                                                                               |
| `dialog`, `drawer`, `sheet`                                                                                  | Modal, bottom drawer and slide-in panel                                                                                 |
| `pagination`, `table`, `tabs`, `scroll-area`, `resizable`, `progress`, `sidebar`                             | Navigation, data and layout                                                                                             |
| `sonner`                                                                                                     | `Toaster`, themed through `next-themes`; mounted once in `app/layout.tsx` (toasts are fired with `toast` from `sonner`) |
| `switch`                                                                                                     | On/off switch with a larger touch area than its look (`before:-inset-y-2.5`), so it is easy to hit on a phone           |
| `use-mobile.ts`                                                                                              | `useIsMobile()`: true under 768 px                                                                                      |
| `utils.ts`                                                                                                   | `cn()`: `clsx` plus `tailwind-merge`                                                                                    |

## Dialogs and the file viewer

| File                      | Description                                                                                                                                                                                                                                                                                                                                               |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfirmDialog.tsx`       | The app's confirmation dialog: `open`, `title`, `description`, `confirmLabel`, `variant` (`danger`, `warning`, `primary`), `isLoading`, `onConfirm`, `onCancel`. Used for terminating a lease, removing a bank account or a schedule, undoing a merge, cancelling a repair                                                                                |
| `LogoutConfirmDialog.tsx` | The "Sign out?" confirmation, shown by both the dashboard and admin shells                                                                                                                                                                                                                                                                                |
| `FileViewerModal.tsx`     | The one viewer for files, mounted once in the root layout next to `FileViewerProvider` (`context/FileViewerContext.tsx`). Images (zoom, rotate, reset), PDFs, video and audio, text and documents; fullscreen, copy link, download, open in a new window, arrows and keys to step through a set. Open it with `useFileViewer().openFile` or `openGallery` |

## Notifications and the attention list

| File                                  | Description                                                                                                                                                                                                                               |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notifications/NotificationBell.tsx`  | The bell in both headers: unread count, a dropdown of the newest few, mark read or all read; a toast and a short chime (`lib/notificationSound.ts`) for each one that arrives while the page is open. Polls through `useNotificationBell` |
| `notifications/NotificationsPage.tsx` | The full list behind `/dashboard/notifications` and `/admin/notifications`: load more, mark read, delete                                                                                                                                  |
| `AttentionCard.tsx`                   | "Needs your attention": everything waiting on the signed-in person, one row per kind of task with a count and a link to where it is handled. The server decides what each role sees (`lib/dashboardAttention.ts`). On all five dashboards |

## Photos and images

| File                          | Description                                                                                                                                                                                                                                       |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RepairPhotos.tsx`            | `PhotoGrid` (a repair's photos, opened in the viewer as a gallery) and `PhotoPicker` (choose and upload; every URL is a file-gateway link). Used by the tenant's report and dispute, the vendor's before and after, and the manager's repair page |
| `figma/ImageWithFallback.tsx` | An `<img>` that shows a placeholder when the image fails to load; used by the photo manager                                                                                                                                                       |

## Layout and platform helpers

| File                   | Description                                                                                                                                                                                                             |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Logo.tsx`             | `Logo` (mark and wordmark; `compactOnMobile` hides the tagline below `sm`) and `LogoIcon`; used by every public page and both shells                                                                                    |
| `ResponsiveTables.tsx` | Mounted in both shells. Under 640 px every table becomes one card per row; the labels come from the table's own header cells, so no table needs special markup (the CSS is `table.stack-on-phone` in `app/globals.css`) |
| `PwaRegister.tsx`      | Registers the service worker (not in development or unsupported contexts) and shows the home-screen install banner when the browser offers one. Mounted in the root layout                                              |

## Development and demo only

| File                       | Description                                                                                                                                                                                                                                                               |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RoleSwitcher.tsx`         | Jumps between roles' dashboards. Rendered by both shells only when `NODE_ENV !== 'production'`; icon-only on a phone. Also exports `UserRole`                                                                                                                             |
| `dev/EmailInboxWidget.tsx` | A floating "Sent Emails" panel that lists the emails the server kept in memory and opens their links, so verification, reset and invite flows can be tried without a mail service. Mounted only when `NEXT_PUBLIC_EMAIL_INBOX_ENABLED`; never enable on a real deployment |
| `AIAssistant.tsx`          | A chat bubble in the dashboard shell. **There is no backend**: every answer is canned text with made-up figures (ISS-045), so it is hidden unless `aiAssistantDemoEnabled` (a build-time flag) and says so on screen                                                      |
