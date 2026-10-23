# Public pages

Everything outside `/dashboard` and `/admin`. Most of these are open to visitors; `/receipts/[id]`
needs a session (`proxy.ts`). The components behind them are in
[`../components/public.md`](../components/public.md).

## Marketing site

| Route             | File                      | Description                                                                                                                                                                |
| :---------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`               | `page.tsx`                | Home page (`HomeLanding` → `LandingPage`). If proxy sent a signed-in visitor here with `?from=`, sends them back to where they were going once the silent refresh finishes |
| `/about`          | `about/page.tsx`          | About Proplity                                                                                                                                                             |
| `/contact`        | `contact/page.tsx`        | Contact form; its message is emailed to the team (`POST /api/v1/contact`, ISS-133)                                                                                         |
| `/pricing`        | `pricing/page.tsx`        | Plans, read from the admin-edited plan table (price, units, users, extra-unit price, credits). Redirects to `/` unless `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=true`            |
| `/checkout`       | `checkout/page.tsx`       | Subscription checkout for a chosen plan (`?plan=<key>&cycle=yearly`); shows the same price the server charges, extra units included. Same flag as pricing                  |
| `/for-tenants`    | `for-tenants/page.tsx`    | Landing page for tenants                                                                                                                                                   |
| `/for-landlords`  | `for-landlords/page.tsx`  | Landing page for landlords                                                                                                                                                 |
| `/for-vendors`    | `for-vendors/page.tsx`    | Landing page for service providers                                                                                                                                         |
| `/proplity-guide` | `proplity-guide/page.tsx` | The in-app platform guide: every role and screen with screenshots (content in `guide-content.ts`, copied from `docs/proplity-guide.html`)                                  |

## Sign-in and accounts

| Route              | File                       | Description                                                                                                                                                                                                                                                                                                                                                 |
| :----------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`           | `login/page.tsx`           | Sign in. Where to go next: a manager or landlord who arrived with `?plan=` goes to `/checkout` (when subscriptions are on); otherwise a safe `?from=` (or the destination remembered in `sessionStorage`); admins always go to `/admin`; everyone else to `/dashboard`. Redirects to `/setup` on a fresh database when `NEXT_PUBLIC_SETUP_REDIRECT_ENABLED` |
| `/register`        | `register/page.tsx`        | Self-registration for tenant, landlord, manager (needs a landlord's invite code) and vendor; `?role=` pre-selects the role. Admins can never register here                                                                                                                                                                                                  |
| `/verify-email`    | `verify-email/page.tsx`    | Landing page for the emailed verification link (the API route is deliberately CSRF-exempt)                                                                                                                                                                                                                                                                  |
| `/forgot-password` | `forgot-password/page.tsx` | Ask for a password-reset email                                                                                                                                                                                                                                                                                                                              |
| `/reset-password`  | `reset-password/page.tsx`  | Set a new password from the emailed single-use link (also CSRF-exempt on the API side)                                                                                                                                                                                                                                                                      |
| `/setup`           | `setup/page.tsx`           | First-run wizard that creates the first `ADMIN`. A server component: redirects to `/login` once `SystemSettings.setupComplete`; asks for `SETUP_TOKEN` when one is configured; stays reachable if the database check fails                                                                                                                                  |

## Properties and receipts

| Route              | File                       | Description                                                                                                                                                                                                                   |
| :----------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/properties/[id]` | `properties/[id]/page.tsx` | The public listing page: photos, units, amenities, the neighbourhood, reviews, and the sign-in-aware buttons for applying or scheduling a viewing (`PublicPropertyDetail`)                                                    |
| `/receipts/[id]`   | `receipts/[id]/page.tsx`   | A payment receipt that prints cleanly or saves as a PDF. `[id]` is the **payment** id. Open to every signed-in role at the edge; the API answers 404 unless the person is the payer, the payee, the property team or an admin |

## Utility pages

| Route                | File                         | Description                                                                                                                                                        |
| :------------------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/offline`           | `offline/page.tsx`           | What the service worker shows when the device has no connection                                                                                                    |
| `/dev/mock-checkout` | `dev/mock-checkout/page.tsx` | A local stand-in for Paystack's hosted checkout, used when `NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED` is on and no Paystack key is set. Never enable on a real deployment |
