# Deployment — Vercel + GitHub Actions

Proplity is a **server-rendered** Next.js 16 app: 59 API routes, a `proxy.ts`
auth gate, and Prisma against Postgres. It cannot be statically exported.

## 0. Branch model

Three tiers, each with its own database and its own GitHub Environment:

| Branch | Role                    | Database                                 | Migrations                                    | App deploy                                   |
| ------ | ----------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `dev`  | Feature work, PR target | none of its own                          | —                                             | none                                         |
| `main` | Staging                 | staging DB (`staging` Environment)       | **automatic** on push (`migrate-staging.yml`) | Vercel's own git integration (preview-style) |
| `prod` | Production              | production DB (`production` Environment) | **manual only** (`migrate-production.yml`)    | **manual only** (`deploy-production.yml`)    |

The flow: `dev` → PR into `main` (CI + `migration-check.yml` gate it) → merges land on `main` and auto-migrate staging → once verified there, PR `main` → `prod` → after merge, a human runs `migrate-production.yml`, confirms it succeeded, then runs `deploy-production.yml`. Production is never touched by an ordinary push — that's the entire point of the split. See `docs/development-history/phases/` for the phase doc explaining why.

---

## 1. Provision Postgres

Any Postgres 18 host works. Serverless functions open a connection per
invocation, so **production must use a pooled endpoint** or you will exhaust
the connection limit under modest load.

| Provider                   | `DATABASE_URL` (pooled — app)   | `DIRECT_URL` (unpooled — migrations) |
| -------------------------- | ------------------------------- | ------------------------------------ |
| Neon                       | the `-pooler` host              | the plain host                       |
| Supabase                   | transaction pooler, port `6543` | port `5432`                          |
| PgBouncer / self-hosted    | the bouncer port                | Postgres' own `5432`                 |
| Plain Postgres (no pooler) | the only URL you have           | leave unset                          |

`DIRECT_URL` exists because `prisma migrate deploy` takes a **session-level
advisory lock** that a transaction-mode pooler silently drops. `prisma.config.ts`
prefers `DIRECT_URL` and falls back to `DATABASE_URL`, so a single-URL setup
needs no extra configuration.

Apply the schema once before the first deploy:

```bash
DIRECT_URL="<direct url>" pnpm db:migrate:deploy
```

---

## 2. Vercel environment variables

Set these in **Project → Settings → Environment Variables**, scoped to
Production (and Preview, pointing at a _different_ database — this is what
`main`-as-staging and PR previews both build against, per §0).

| Variable                            | Required             | Notes                                                                                                                                         |
| ----------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | **yes**              | Pooled endpoint.                                                                                                                              |
| `DIRECT_URL`                        | if pooled            | Only read by the Prisma CLI, not the app.                                                                                                     |
| `JWT_SECRET`                        | **yes**              | `openssl rand -hex 64`. Rotating it logs everyone out.                                                                                        |
| `CRON_SECRET`                       | **yes**              | Name must be exactly this — see §4.                                                                                                           |
| `NEXT_PUBLIC_APP_URL`               | strongly recommended | Base URL for links in outbound email. Falls back to Vercel's own domain vars, but set it — it's the only value that survives a custom domain. |
| `PAYSTACK_SECRET_KEY`               | for payments         | Unset ⇒ payment routes return a clean 503.                                                                                                    |
| `NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED` | no                   | `"true"` turns on real billing. Build-time inlined.                                                                                           |
| `NODE_ENV`                          | **no**               | Vercel sets it. Do not add it manually.                                                                                                       |

### These are needed at BUILD time, not just runtime

`lib/db.ts`, `lib/auth/jwt.ts` and `lib/workers/auth.ts` each `throw` at module
load when their secret is missing while `NODE_ENV === 'production'` — and
`next build` sets `NODE_ENV=production`. A missing `DATABASE_URL`,
`JWT_SECRET`, or `CRON_SECRET` therefore **fails the build**, with an error
like:

```
Error: Failed to collect configuration for /api/v1/admin/users
  [cause]: Error: CRITICAL: JWT_SECRET environment variable is not defined in production!
```

That is a deliberate fail-fast guard, not a bug. Set the variables before the
first deploy.

---

## 3. Vercel project settings

`vercel.json` pins framework, install/build commands, region, and the cron
schedule, so the dashboard needs almost nothing. Two manual steps:

1. **Node version** — set to 22.x (Settings → General). `package.json` declares
   `engines.node >= 20.9.0`; Next 16 will not run below that.
2. **Set the Production Branch to `prod`** (Settings → Git → Production Branch).
   This is a manual dashboard step — it cannot be set from `vercel.json`.
   Vercel defaults this to your repo's default branch (`main`), which is now
   the staging tier under this repo's branch model (§0); leaving it unchanged
   would make `main` pushes eligible for the production domain/env vars.
3. **Production Git deploys are disabled on purpose.** `vercel.json` sets
   `git.deploymentEnabled.prod = false` so that GitHub Actions owns production:
   migrations must be confirmed healthy _before_ the new code goes live
   (`migrate-production.yml`, then `deploy-production.yml` — two separate
   manual steps), and Vercel's own Git integration has no way to sequence
   that or gate it behind a human. `main` and PR branches are unaffected —
   Vercel deploys those automatically as before, just as non-production
   (Preview-scoped) builds.

`regions` is `fra1` (Frankfurt) — the lowest-latency Vercel region for Nigerian
traffic. Change it in `vercel.json` if your database lives elsewhere; keeping
functions in the same region as the database matters more than proximity to
users for a database-heavy app like this one.

---

## 4. Background workers (cron)

Five workers exist in `lib/workers/`, dispatched by
`POST|GET /api/v1/cron/[job]`:

- `rent-invoicer`
- `overdue-flagger`
- `maintenance-schedule-dispatcher`
- `access-code-expiry-janitor`
- `payment-reliability-scorer`
- `all` — runs all five in dependency order (added for this deployment)

**The Hobby plan allows 2 cron jobs at once-a-day granularity**, which is fewer
than the five workers need. So `vercel.json` schedules a single daily job
against `/api/v1/cron/all`, which fans out internally:

```json
"crons": [{ "path": "/api/v1/cron/all", "schedule": "0 2 * * *" }]
```

Ordering is deliberate — invoicing must create the cycle's invoices before the
overdue flagger judges what is late, and both must land before payment
reliability is rescored. One worker failing does **not** abort the others; the
response collects failures and returns 500 if any occurred, so a partial
failure shows red in Vercel's cron log instead of a false green.

### Authentication

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`, using the project's
env var of that exact name — the header and scheme are not configurable. The
route accepts that **and** the original `x-cron-secret` header, so manual curl,
a system crontab, and CI all keep working:

```bash
curl -X POST https://<app>/api/v1/cron/rent-invoicer -H "x-cron-secret: $CRON_SECRET"
```

Comparison is constant-time (`timingSafeEqual`).

### On upgrading to Pro

Give each worker its own schedule and drop the fan-out:

```json
"crons": [
  { "path": "/api/v1/cron/rent-invoicer",                   "schedule": "0 2 * * *" },
  { "path": "/api/v1/cron/overdue-flagger",                 "schedule": "0 3 * * *" },
  { "path": "/api/v1/cron/maintenance-schedule-dispatcher", "schedule": "0 * * * *" },
  { "path": "/api/v1/cron/access-code-expiry-janitor",      "schedule": "*/30 * * * *" },
  { "path": "/api/v1/cron/payment-reliability-scorer",      "schedule": "0 4 * * 0" }
]
```

Note that **the rent invoicer advances only one billing cycle per run** by
design, so a lease several cycles behind catches up over several days on a
daily schedule.

---

## 5. GitHub Actions

Six workflows, split by branch tier (§0) rather than one file doing
everything. Repository → Settings → Environments has two environments that
matter here — `staging` and `production` — each with its **own** secrets;
they are not shared, and `production`'s deployment-branch policy is
restricted server-side to the `prod` branch only (Settings → Environments →
production → Deployment branches), so even a leaked or misconfigured
workflow cannot touch it from anywhere else. `staging` has no such
restriction; it only ever runs from `migrate-staging.yml`'s own `main`-only
trigger.

### Required secrets, per Environment

| Secret              | `staging` | `production` | Used for                                        |
| ------------------- | --------- | ------------ | ----------------------------------------------- |
| `DATABASE_URL`      | yes       | yes          | migrations (pooled)                             |
| `DIRECT_URL`        | if pooled | if pooled    | migrations (unpooled)                           |
| `VERCEL_TOKEN`      | —         | yes          | Account Settings → Tokens                       |
| `VERCEL_ORG_ID`     | —         | yes          | from `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | —         | yes          | same file                                       |

Vercel deploys for `main`/PRs go through Vercel's own git integration (§3),
not GitHub Actions, so `staging` doesn't need the three Vercel secrets —
only `production` does, for `deploy-production.yml`.

### `ci.yml` — on push/PR to `dev`, `main`, or `prod`

```
quality (typecheck, format, build)
test    (full Vitest suite against postgres:18)
```

Just the two safety gates now — no migration or deploy step lives here
anymore (moved out, below). Both jobs run on every push and PR across all
three branches; neither touches a real database beyond the ephemeral
`postgres:18` service container `test` spins up itself.

### `migrate-staging.yml` — on push to `main`

Automatic. `prisma migrate deploy` against the `staging` Environment's
database, only when a push actually touches `prisma/schema/**` or
`prisma/migrations/**`. Low risk by design — staging is never the database
real users hit.

### `migration-check.yml` — on PR into `main` or `prod`

Read-only. Runs `prisma validate` plus an informational `prisma migrate
diff` against the `staging` database, so schema drift or conflicts surface
in review instead of at merge time. Skipped for forks (no access to
environment secrets, same reasoning `preview.yml` already documents).

### `migrate-production.yml` — manual only

`workflow_dispatch`, requires typing `migrate production` into the confirm
input. Runs `prisma migrate status` before and after `prisma migrate
deploy` against the `production` Environment, so a bad migration is visible
immediately rather than discovered later. Gated to the `prod` branch by the
Environment's own deployment-branch policy — the workflow also checks
`github.ref` itself as a fast, clear failure if that policy is ever loosened.

### `deploy-production.yml` — manual only, run after the above

`workflow_dispatch`, requires typing `deploy production`. `vercel build`
then `vercel deploy --prebuilt --prod`, so the artifact that ships is
exactly the one built against the schema `migrate-production.yml` just
applied. **Deliberately not chained automatically** to
`migrate-production.yml` — a human confirms the migration actually
succeeded before the code that depends on it goes live. Same `prod`-branch
gate as `migrate-production.yml`.

### `preview.yml` — on PR into `main`

Deploys a preview URL without waiting for tests, so reviewers get a link
fast. Skipped for forks (they have no access to repository secrets).

> **Point Preview at a non-production database.** Set a Preview-scoped
> `DATABASE_URL` in Vercel, or a pull request will read and write live data.

---

## 6. Health check

`GET /api/v1/health` — unauthenticated, uncached, no secrets in the body.

- `200 {"status":"ok","database":"up","latencyMs":N}` — ready for traffic.
- `503 {"status":"degraded","database":"down","latencyMs":N}` — do not route here.

The database probe is capped at 3s and the route at 10s, so a wedged database
produces a fast 503 rather than a hanging request. Point your uptime monitor
and any platform health check at this path.

## 7. Known gaps that matter in production

Carried over from `CLAUDE.md`; none block a deploy, but they change what you
should expect from a live system.

- **Email is console-only.** `lib/email.ts` logs instead of delivering, so
  tenant invites and verification links go to the Vercel function log and
  nowhere else. Swapping in Resend/Postmark/SES is a one-function change.
  The _links_ inside those emails are now correct in every environment
  (`lib/appUrl.ts`); only delivery is still missing.
- **Self-registration has no verification flow.** `register` sets
  `status: ACTIVE` directly. When wiring real email, flip it to
  `PENDING_VERIFICATION` **and** relax the `login` 403 in the same commit, or
  every new signup is locked out.
- **`/payments/initialize` has never run against a real Paystack account.**
  Everything around it is tested; that one outbound call is not.
- **No file storage exists.** Maintenance-request image upload is display-only.
- **Rate limiting is DB-backed** (`LoginAttempt`), so it works correctly across
  serverless instances — no action needed. But `getClientIp()` trusts
  `x-forwarded-for`; on Vercel prefer `x-vercel-forwarded-for` if you ever need
  it to be non-spoofable.
- **Formatting is a hard CI gate.** The tree was formatted in one pass, so
  `pnpm format:check` now passes and blocks a PR that regresses it. Run
  `pnpm format` before pushing. Note `prettier-plugin-tailwindcss` reorders
  Tailwind class names, so it edits JSX, not just whitespace.
- **ESLint is not configured at all** — there is no config file, and Next 16
  removed `next lint`. The broken `lint` script was replaced with `typecheck`.
