# 0004 — Native Next.js Link Components Over Imperative Navigation for User Navigation

Status: Accepted
Decided by: roji-tech · Date: 2026-10-10
Recorded: 2026-10-10

## Context

Several authentication and portal components (such as `Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, and `AdminDashboard.tsx`) previously relied on legacy callback props (`onSwitchToRegister`, `onForgotPassword`, `onBack`) or imperative `router.push('/path')` click handlers on standard `<button>` tags.
This pattern caused several usability and architectural issues:

1. Standard browser behaviors (Ctrl/Cmd+click to open in new tab, right-click "Copy link address", hover URL preview) were broken.
2. Search engine crawlers and screen readers could not discover links without executing JavaScript.
3. Next.js router prefetching could not optimize page transitions.

## Decision

1. **Use Next.js `<Link>` for all standard user navigation.**
2. Convert buttons that only navigate between static routes (`/login`, `/register`, `/forgot-password`, `/admin/settings`, etc.) into Next.js `<Link>` elements styled with appropriate Tailwind classes.
3. Retain callback props (`onSwitchToRegister`, etc.) as optional props only where modal or inline embedding requires backward compatibility.

## Alternatives Considered

- **Retain `router.push` everywhere:** Rejected. Degrades user experience, accessibility, and SEO.
- **Custom anchor tags `<a href="...">`:** Rejected. Causes full page reloads, losing single-page application client state and prefetching benefits.

## Consequences

- Better browser ergonomics (middle-click, new tab, URL preview).
- Automatic Next.js route prefetching.
- Accessibility compliance for navigational anchors vs actions.
- **Revisit if:** An embedded iframe or widget context prohibits browser URL manipulation.

## Enforced by

- Code review & TypeScript prop typing.
- Playwright E2E navigation specs.

## Binds

- `app/components/Auth/Login.tsx`
- `app/components/Auth/Register.tsx`
- `app/components/Auth/ForgotPassword.tsx`
- `app/components/AdminDashboard.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/verify-email/page.tsx`
- `app/reset-password/page.tsx`
