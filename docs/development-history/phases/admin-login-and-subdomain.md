# Admin sign-in page and optional admin subdomain (2026-11-26)

**Status:** PR into `dev`. Decision recorded in ADR-0018.

## Why

The owner asked for the admin dashboard to have its own login (`/admin/login`) that nobody else can use, for administrators to be unable to use the general login, and, on production and staging only, for administrators to sign in on their own subdomain (`admin.proplity.com`, `admin.staging.proplity.com`). That cannot be tested on the free Vercel domain, so it had to be driven by an environment variable and do nothing when unset.

## What was built

- `lib/auth/loginFlow.ts`: the old login route's body, with an `audience` (`general` | `admin`). Wrong kind of account = the same 401 as a wrong password, after the same bcrypt compare, counted as a failure. The admin audience has its own rate-limit identifiers and a per-account budget of 10 (general: 30).
- `POST /api/v1/auth/admin/login` (new); `POST /api/v1/auth/login` now delegates to the same function.
- `lib/adminHost.ts`: `ADMIN_HOST` parsing, `hostMode()` (`shared` | `admin` | `public`), `roleAllowedOnHost()`, path classifiers, `adminUrl()` / `adminUrlFor()`.
- `proxy.ts`: now sees every path. Admin host: only the admin area (everything else goes to `/admin`), general login API 404. Public host: `/admin` pages forwarded to the admin host, admin APIs 404. Unauthenticated `/admin/*` goes to `/admin/login?from=...`.
- `withAuth`, `/auth/me`, `/auth/refresh`: an admin session is refused off the admin host, anyone else's on it.
- `app/admin/login/` page and `AdminLogin` component (dark, separate look; same labels and button name as the public form so one e2e helper drives both). The console moved to the route group `app/admin/(console)/` so the login page sits outside the layout that needs a session; relative imports became `@/app/...`.
- First-run wizard sends the new administrator to the admin sign-in (`adminLoginUrl` in the setup response); admin logout and the 401 handler go to `/admin/login`; `appUrl()` points admin links in emails at the admin host.
- Docs: `DEPLOYMENT.md` §9, `.env.example`, `CLAUDE.md` rule 24, ADR-0018, setup guide.

## Not done / owner's

- **Do not set `ADMIN_HOST` yet.** The hosts `admin.proplity.com` and `admin.staging.proplity.com` must first exist in DNS and be added to the Vercel project; then set `ADMIN_HOST` per environment (staging scoped to the `main` branch's Preview environment) and redeploy. Setting it earlier locks every administrator out.
- The existing production administrator signs in at `/admin/login` from now on.
- Registration, reset and public APIs remain reachable on the admin host; tighten if wanted.
