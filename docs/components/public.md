# Public components

Behind the routes in [`../pages/public.md`](../pages/public.md). All live in `app/components/` unless a
path says otherwise.

## Marketing site

| File                             | Description                                                                                                                                                                                                                             |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/HomeLanding.tsx`            | The home route's wrapper: renders `LandingPage` and, once the silent session refresh finishes, sends a visitor bounced by `proxy.ts` (`?from=`) back to where they were going                                                           |
| `LandingPage.tsx`                | The home page: hero, features, how it works, the demo popup, "Trusted by", featured properties (from `useProperties`), pricing and a closing call to action                                                                             |
| `MarketingNav.tsx`               | Shared header of every marketing page, with a mobile menu; pricing links appear only when subscriptions are on                                                                                                                          |
| `FeaturedPropertyModal.tsx`      | The preview popup for a featured property card (cheapest unit's price, link to the full page); also exports `FEATURED_GRADIENTS` and `featuredFields`                                                                                   |
| `WatchDemoModal.tsx`             | The "Watch demo" popup: an interactive tour of the platform with illustrative figures                                                                                                                                                   |
| `AboutPage.tsx`                  | About page                                                                                                                                                                                                                              |
| `ContactPage.tsx`                | Contact page and form. Posts to `POST /api/v1/contact` and shows "Message sent!" only when the server accepted the message; otherwise an error under the form, with what was typed kept. Has a hidden honeypot field for bots (ISS-133) |
| `PricingPage.tsx`                | Plan cards (`PLANS`, also read by checkout). The route redirects home unless subscriptions are on                                                                                                                                       |
| `Checkout.tsx`                   | Subscription checkout: account, payment and billing details, order summary, a confirmation for a downgrade, and the success screen. A paid plan cannot be bought while card payments are not available yet (ISS-010)                    |
| `TenantFeaturePage.tsx`          | `/for-tenants` landing page (illustrative content from `app/store/mockData.ts`)                                                                                                                                                         |
| `LandlordFeaturePage.tsx`        | `/for-landlords` landing page (same)                                                                                                                                                                                                    |
| `ServiceProviderFeaturePage.tsx` | `/for-vendors` landing page (same)                                                                                                                                                                                                      |

## Sign-in and registration

| File                            | Description                                                                                                                                                                                                                                                                    |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Auth/Login.tsx`                | Email and password form with Remember me; shows the "verify your email" message and a resend button for an unverified account; calls `onLogin(role)` so the page decides where to go                                                                                           |
| `Auth/Register.tsx`             | Step-by-step registration. Tenant and landlord: account type, details. Manager: account type, landlord invite code (checked live), details. Vendor: account type, details, business info. The field groups are module-level components on purpose, so typing never loses focus |
| `Auth/ForgotPassword.tsx`       | Asks for an email; the API always answers the same way, so a failure here means a rate limit or a bad request                                                                                                                                                                  |
| `Logo.tsx`                      | `Logo` (with tagline; `compactOnMobile` hides the tagline below `sm`) and `LogoIcon`. Also in `shared.md`                                                                                                                                                                      |
| `app/setup/SetupWizardForm.tsx` | The first-run wizard form that creates the first admin; asks for `SETUP_TOKEN` when the server requires one                                                                                                                                                                    |

`/reset-password` and `/verify-email` have no component of their own: the page file holds the form
and the token handling.

## Public property page and receipts

| File                       | Description                                                                                                                                                                                                                                                                                     |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublicPropertyDetail.tsx` | The listing page for visitors and tenants: gallery, units and prices, review rating, description, amenities, a neighbourhood report popup, similar properties, and **Schedule Inspection** and **Apply** buttons that ask a signed-out visitor to sign in first (the destination is remembered) |
| `ReceiptView.tsx`          | One payment's receipt, laid out to print or save as PDF; opened from `/receipts/[id]`. Anyone who is not the payer, the payee, the property team or an admin sees "not found"                                                                                                                   |

## In-app guide

| File                                         | Description                                                                                                                                                                 |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/proplity-guide/ProplityGuideClient.tsx` | Renders the guide (`guide-content.ts`, a copy of `docs/proplity-guide.html`), wires the screenshot lightbox with keyboard navigation and locks page scroll while it is open |
| `app/proplity-guide/guide-content.ts`        | The guide's styles, body HTML and screenshot list as strings. Edit it together with `docs/proplity-guide.html`; keep the two identical                                      |
