# Migrations squashed into one baseline (2026-11-19)

**Status:** PR #163 into `dev`. Decision recorded in ADR-0017.

## Why

Setting up production (the first-run wizard failed with "Unexpected end of JSON input" because the production database had no tables) led to the first real `migrate-production.yml` run. Production had never been migrated, so 45 incremental migrations, some with data backfills and duplicate-row guards for data that never existed there, were about to run against an empty database. The owner asked to delete them all and regenerate.

## What changed

- `prisma/migrations/` now holds only `20261119120000_baseline` and `migration_lock.toml`. The baseline is `prisma migrate diff --from-empty --to-schema prisma/schema --script` plus the partial unique index `AutoPayMandate_one_active_per_rent`.
- Docs: migration counts in `CLAUDE.md`, `CURRENT_STATE.md`, `HANDOVER.md`, `PROJECT_STRUCTURE.md`; a "Migration baseline" section in `DEPLOYMENT.md`; ADR-0017.

## How it was checked

Grepping the 45 migrations for objects the schema cannot express found one (the partial index; the `DO $$` block in `payment_ref_unique` was only a guard). That was not trusted: two scratch databases were built (old 45 migrations; new baseline) and their `pg_dump --schema-only` output was compared with lines sorted. The only differences were `_prisma_migrations` and that index, which is what made the index get added to the baseline. A third database built from the final baseline matched the old one exactly, `prisma migrate status` was clean, `prisma migrate diff` against the schema showed only the three documented cosmetic `SET DEFAULT` lines (`invoiceNumber`, `receiptNumber`, `payoutNumber`), and `tests/api/renewals.test.ts` and `tests/api/setup.test.ts` passed (31).

## Found on the way

The production migrate workflow's pre-flight `prisma migrate status` exits 1 whenever migrations are pending, so on a new or behind database it stopped the job before `migrate deploy`. It is now `continue-on-error`; the post-flight status is the strict one. The workflow comments and `DEPLOYMENT.md` also now show the full `gh workflow run ... -f confirm="..."` commands (the old comment omitted the confirm input). The `production` GitHub Environment had no `DATABASE_URL`/`DIRECT_URL` secrets; they were set from `.env.production` without printing them.

## Not done / owner's

- Staging has the old migration history and must be reset, or have `prisma migrate resolve --applied 20261119120000_baseline` run against it, before the merge to `main` (otherwise `migrate-staging.yml` fails and leaves a failed migration row).
- Local databases: `prisma migrate reset`.
- Production: run `migrate-production.yml` from `prod` after the fix reaches it, then `deploy-production.yml`.
