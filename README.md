# Proplity

A property-management and tenant-experience platform for five roles — **admin, manager, landlord, tenant and vendor** — built on **Next.js 16 (App Router)**, **TypeScript**, **PostgreSQL** and **Prisma 7**.

Landlords list properties and units; managers run tenants, leases and maintenance; tenants apply, pay rent and raise requests; vendors work assigned jobs and invoice for them; admins moderate listings and run the platform. Everything is a real route backed by a real API (`/api/v1/*`, 73 routes) — there is no mock-only screen apart from the marketing feature pages and the AI assistant.

## Quick start

Requirements: Node ≥ 20.9, pnpm, PostgreSQL.

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL, DIRECT_URL, JWT_SECRET at minimum
pnpm db:migrate:deploy        # apply migrations (use `pnpm db:migrate` while developing schema changes)
pnpm db:seed2                 # optional: enriched demo data for all five roles
pnpm dev                      # http://localhost:3000
```

On a brand-new database with no seed, open `/setup` once to create the first administrator (see `docs/setup-guide.md`).

Third-party integrations are all optional locally — without keys the app logs emails instead of sending them, shows "uploads not available" instead of uploading, and offers a mock payment gateway (`NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED`) in place of Paystack. Every variable is documented in `.env.example` and `DEPLOYMENT.md`.

## Commands

| Command                                                              | What it does                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`                             | Dev server, production build, serve the build                   |
| `pnpm typecheck`                                                     | `tsc --noEmit` (CI)                                             |
| `pnpm format:check` / `pnpm format`                                  | Prettier check (CI) / fix                                       |
| `pnpm test`                                                          | Vitest API suite — needs `.env.test` (copy `.env.test.example`) |
| `pnpm test:e2e` (`:smoke`, `:flows`, `:ui`)                          | Playwright UI suite — needs a seeded DB and `E2E_BASE_URL`      |
| `pnpm db:generate` / `db:migrate` / `db:migrate:deploy` / `db:seed2` | Prisma client, migrations, seeding                              |

## Branches and deployment

`dev` (integration) → `main` (staging) → `prod` (production), each promotion by pull request; CI runs typecheck/format/build, the API suite and the Playwright suite on every PR. Vercel hosts the app and runs the daily cron (`/api/v1/cron/all`). Full details in [DEPLOYMENT.md](DEPLOYMENT.md).

## Where to read next

| If you want…                                   | Read                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| The authoritative rules, architecture, gotchas | [CLAUDE.md](CLAUDE.md)                                 |
| What is built, what isn't, what's next         | [CURRENT_STATE.md](CURRENT_STATE.md)                   |
| A tour of the directories                      | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)           |
| First-time setup of a deployment               | [docs/setup-guide.md](docs/setup-guide.md)             |
| How each role uses the app                     | [docs/flow-guide.md](docs/flow-guide.md)               |
| The manual QA checklist and the test suites    | [docs/testing-guide.md](docs/testing-guide.md)         |
| Why things were built the way they were        | [docs/development-history/](docs/development-history/) |
