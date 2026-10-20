# Responsive polish: phone and tablet layout audit

**Status:** Built on `fix/responsive-polish` (from `dev` after PRs #113 to #119). **Date:** 2026-10-20. **Issues:** ISS-125 to ISS-130. **Migration:** none.

## Why

The owner asked for responsiveness to be "top-notch". An earlier pass (2026-10-19, "Phone layout") had made tables into cards and added the bottom tab bar, but nobody had measured every screen at several widths, and the screens added since (Schedules, Raise a repair, the second-person switches, the rewritten tenant-record payment form) had only been looked at on a desktop.

## How it was checked

1. A throwaway script (`out/responsive-audit.mjs`, not committed) logged in as each of the five roles and visited their key pages (and the public pages) at 320, 390, 768 and 1280 px, about 200 page views per run. It reports sideways overflow, elements sticking out of the viewport, and small tap targets.
2. The first run only checked the page. That missed the worst bug: the dashboards scroll inside their `main` element, so content pushed past the right edge made `main` scroll sideways while the page reported no overflow. The second version measures every large scroll container, and a third measures content cut off by boxes that hide their overflow.
3. Screenshots of the new and changed screens at 320, 390 and 768 px were read by eye (Playwright, device scale 2).

## What was fixed

- **Tenant record header** (`TenantDetail.tsx`): stacks on a phone, the contact line wraps, long emails break, the avatar shrinks. Before, 240 px of sideways scroll at 390 px and the Rent Paid and risk badges were off screen.
- **In-app guide** (the HTML and its TS copy, identical): `.main` can shrink (`min-width: 0`), long words and URLs wrap, tables and code scroll inside themselves, and the grids' 340 and 380 px minimums became `min(340px, 100%)`. Zero overflow from 320 to 1280 px.
- **Maintenance Board**: the header wraps instead of squeezing "Raise a repair"; the columns are a grid (1, 2, then 3 from 1280 px) instead of a sideways scroller that cut the third column off on a tablet.
- **320 px screens** (the smallest phones): admin Reports tabs (also 248 px at 390 px), Schedules action buttons, Account Settings tabs, the landlord's manager-code rows, a vendor job card's badges, the Add Tenant stepper, the tenant rentals row, the Discover card's trust score and price, and the vendor, tenant and landlord landing headings. Tab rows scroll inside themselves; button and badge rows wrap.
- **Tap targets**: property and admin filter pills, View Details, Confirm payment and Reject, the tenant list icons and the admin log-out are at least 36 px high on a phone (unchanged from 640 px up); the shared `Switch` keeps its look but has a larger touch area.
- **Dev-only**: the role switcher shows only its icon on a phone, so it no longer squeezes the logo (it is not in production builds).

## Kept that way

`tests/e2e/responsive/layout.spec.ts` (7 tests): public pages at 320 and 390 px (no sideways scroll), the manager screens, tenant record and payment dialog, admin settings and bank transfers, a tenant's payment history and property search at 390 px, the property search at 320 px, and the maintenance board at 768 px. It checks sideways scroll of the page, sideways scroll inside the main area, and content cut off by boxes that hide their overflow. Marketing pages are checked for page overflow only, because their browser-frame mock-ups crop a miniature dashboard on purpose. It was proven to fail on the old tenant header (240 px) and pass with the fix. Run it against a production build in CI; locally against `next dev` it also passes now that the dev role switcher is compact.

## Not changed

- The marketing mock-ups' cropped tables.
- Dynamic Tailwind classes such as `bg-${color}-50` on the vendor job cards (found in passing: the build cannot see them, so those colours may not apply). Not part of layout; worth its own look.
