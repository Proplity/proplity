# Three-tier branch model: staging auto-migrate + gated manual production

**Status:** Complete. CI validated on `dev`; the manual production workflows are untested (can't be, without a `prod`-restricted GitHub Environment secret and real Vercel/DB credentials this environment doesn't have). **Date:** 2026-09-04.

## Why

The user shared three reference workflow files (`out/migrate-production.yml`, `out/migrate-staging.yml`, `out/migration-check.yml`) from elsewhere and asked to set up something like them. Confirmed via `AskUserQuestion`: adopt the 3-tier branch model those files assume (`dev` → `main`=staging → `prod`=production, a real new branch) rather than force-fitting the pattern onto the existing 2-tier `dev`/`main` setup, and use this repo's real database/secret naming conventions rather than the templates' placeholders (`test_db`, `twonode_db`).

Prior to this, `main` *was* production — `ci.yml`'s `migrate`/`deploy` jobs ran automatically on every push to `main` once `quality`+`test` passed. That meant production had no staging tier at all: a merge to `main` was simultaneously the first time a migration touched anything beyond the disposable CI test database, and the moment it went live.

## What was built

**Branch**: `prod` created from the current `main` (the live production line), independent of the still-open `dev`→`main` PR.

**GitHub Environments** (via the API, not just YAML — a real, server-enforced gate):
- `staging` — new, no branch restriction (only `migrate-staging.yml`'s own `main`-only trigger reaches it).
- `production` — existing, now given a `custom_branch_policies` deployment-branch policy naming `prod` as the only branch allowed to deploy against it. This means even a misconfigured or malicious workflow run from any other branch is rejected by GitHub itself before the job starts, not just by an `if:` check in YAML.

**`ci.yml`**: stripped down to `quality` + `test` only — the `migrate` and `deploy` jobs (previously gated to `main`) are gone, superseded by the workflows below. Triggers extended to include `prod`. `concurrency.cancel-in-progress` simplified to always-true, since the only jobs left here (typecheck/build/test) are safely cancellable — the old exception existed specifically to protect an in-flight `prisma migrate deploy`, which no longer lives in this file.

**`migrate-staging.yml`** (new): push-to-`main` trigger, path-filtered to `prisma/schema/**`/`prisma/migrations/**`. Automatic — staging is never the database real users hit, so this is deliberately low-ceremony.

**`migration-check.yml`** (new): PR-into-`main`-or-`prod` trigger, same path filter. Read-only (`prisma validate` + an informational `prisma migrate diff` against staging) — never writes. Fork-guarded, matching `preview.yml`'s existing pattern (forks have no access to environment secrets).

**`migrate-production.yml`** (new): `workflow_dispatch` only, requires typing `migrate production` into a confirm input. Runs `prisma migrate status` before *and* after `prisma migrate deploy`, so a bad migration is visible in the run output immediately. The real gate is the `production` Environment's branch policy (above); the workflow's own `github.ref` check exists only to fail with a clear message if that policy is ever loosened, not as the primary defense.

**`deploy-production.yml`** (new): same `workflow_dispatch` + typed-confirmation pattern (`deploy production`), holding the Vercel `pull`/`build`/`deploy --prod` steps moved out of `ci.yml`. **Deliberately a separate manual step from `migrate-production.yml`, not chained automatically** — a human confirms the migration's post-flight status is healthy before running this, rather than the pipeline assuming success and deploying code that expects a schema change which might have partially failed.

**`vercel.json`**: `git.deploymentEnabled` flipped from `{"main": false}` to `{"prod": false}` — Vercel's own git integration now auto-deploys `main` (harmless; it's staging) and PR previews as before, but still never touches `prod` — only `deploy-production.yml` does.

**`DEPLOYMENT.md`**: new §0 documenting the branch model and the full flow (dev → PR into main → auto-migrate staging → verify → PR main into prod → merge → manually run `migrate-production.yml` → confirm success → manually run `deploy-production.yml`); §2/§3 updated with the one manual Vercel-dashboard step this can't do from a config file (Settings → Git → Production Branch must be changed from `main` to `prod` by hand); §5 rewritten for the new per-Environment secrets table and six-workflow breakdown.

## What's still manual, and why

- **Setting real values for `staging`'s and `production`'s secrets** (`DATABASE_URL`/`DIRECT_URL`/`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`) — this environment has no network path to any real database or Vercel account, and fabricating placeholder values would be actively misleading. Both Environments currently have zero secrets (checked directly via the API before this phase started); that was already true before this change and is unrelated to it.
- **Vercel's Production Branch dashboard setting** — `vercel.json` cannot set this; it must be changed from `main` to `prod` by hand in Vercel's UI, or Vercel will keep treating `main` pushes as production-domain-eligible regardless of what GitHub Actions does.
- **Syncing `prod` forward** — `prod` was branched from the *old* `main` (pre this session's work), so it doesn't yet have any of the commits from the still-open `dev`→`main` PR, including these very workflow files. A `main`→`prod` PR is the natural next step once that PR merges — opening one now would be against content that doesn't exist on `main` yet.

## Verification performed

- `python3 -c "import yaml; yaml.safe_load(...)"` — all 6 workflow files (5 touched/added + `preview.yml` re-checked) parse as valid YAML.
- `python3 -c "import json; json.load(...)"` — `vercel.json` valid.
- Confirmed via the GitHub API (not assumed) that the `production` Environment's deployment-branch policy now lists exactly one branch, `prod`, and that `staging` exists.
- **Not performed, and cannot be from here**: actually running `migrate-staging.yml`, `migration-check.yml`, `migrate-production.yml`, or `deploy-production.yml` end-to-end — all four need real database/Vercel credentials this environment doesn't have. `ci.yml`'s reduced `quality`+`test` jobs were verified the normal way (they're unchanged in substance, just relocated triggers).

## What's next

Merge the open `dev`→`main` PR, then open a `main`→`prod` PR to bring `prod` current (this is what makes the two production workflows dispatchable from it at all). Separately, and not blocking: the user needs to (1) paste real connection strings into the `staging` and `production` GitHub Environments, (2) create/paste `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` into `production`, and (3) change Vercel's Production Branch setting to `prod` in the dashboard. None of these three are things this environment can do — they all need real external credentials or dashboard access only the user has.
