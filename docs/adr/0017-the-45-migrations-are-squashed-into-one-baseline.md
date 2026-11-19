# 0017 — The 45 migrations are squashed into one baseline

Status: Accepted
Decided by: the owner · Date: 2026-11-19
Recorded: 2026-11-19

## Context

Production had never been migrated. The first `migrate-production.yml` runs found an empty Neon database with 45 incremental migrations waiting, written over three months of development (several with `UPDATE` backfills for rows that production never had, one with a guard for duplicate payment references that cannot exist on an empty table). Replaying them gives the same schema as a single script, slower and with more ways to fail, and the pre-flight check also showed nobody had reason to keep that history. The owner asked to delete them and regenerate.

## Decision

`prisma/migrations/` holds one migration, `20261119120000_baseline`: `prisma migrate diff --from-empty --to-schema prisma/schema --script`, plus the partial unique index `AutoPayMandate_one_active_per_rent` that the Prisma schema language cannot express. Every later change is a normal incremental migration (`pnpm db:migrate`).

The squash is safe only because the baseline was checked against the old history: a database built from the baseline and one built from the 45 migrations have identical schemas (sorted `pg_dump --schema-only`, ignoring `_prisma_migrations`).

## Alternatives Considered

- **Keep the 45 and run them on production:** works, but production starts with data-migration code that never had data to move, and any of the 45 can fail on a database it was not written against.
- **Snapshot production-like data first:** there is no production data to keep.
- **`prisma db push` for the first deploy:** leaves no migration history, so `migrate deploy` could not be used afterwards.

## Consequences

- A database that already ran the old migrations (staging, a developer's laptop) has history the repo no longer has. `migrate deploy` would try to create tables that exist. Staging is reset or has the baseline marked applied (`prisma migrate resolve --applied 20261119120000_baseline`); local databases run `prisma migrate reset`. Steps are in `DEPLOYMENT.md`, "Migration baseline".
- Old docs, ADRs and the issue register still name the removed migrations. They stay as history; nothing reads them.
- Anything the schema cannot express (partial indexes, CHECK constraints, triggers) must be added to a migration by hand, as before. After this change the baseline is the only place the partial index lives.
- **Revisit if:** the project ever needs to replay old history against a database that holds real data (it will not, once production has data, because squashing again would not be allowed).

## Enforced by

Review only, plus `pnpm db:migrate:deploy` run against an empty database in CI (the test database is dropped, recreated and migrated by `tests/setup/globalSetup.ts` on every `pnpm test`).

## Binds

- `prisma/migrations/20261119120000_baseline/migration.sql`
- `prisma/schema/`
- `DEPLOYMENT.md` ("Migration baseline")
