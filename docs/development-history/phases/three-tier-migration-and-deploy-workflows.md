# Three-tier branch model: staging auto-migrate + gated manual production

**Status:** Live on `dev` and `main`; PR into `prod` open. `main`→`prod` PR #2 syncs `prod` with everything below (not yet merged). `staging` has real Neon credentials and will auto-migrate on the next push to `main` that touches `prisma/`. `production` still has zero secrets and the manual production workflows remain untested — both need real credentials this environment doesn't have. **Date:** 2026-09-04.

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

- **`production`'s secrets** (`DATABASE_URL`/`DIRECT_URL`/`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`) — still zero, and this environment still has no network path to a real production database or Vercel account. `staging`'s two DB secrets, by contrast, are now set with real Neon credentials the user pasted directly into `gh secret set` via stdin.
- **A production database distinct from staging** — the user pasted staging's Neon connection strings; both point at compute endpoint `ep-long-poetry-b10ur5jg` (host, not database name, is what isolates a Neon branch). Confirmed with the user that reusing that same endpoint for `production` — even under a differently-named database — would make staging and production the literal same physical database. Production secrets are intentionally not being set until a separate Neon branch/project exists for it.
- **Vercel's Production Branch dashboard setting** — `vercel.json` cannot set this; it must be changed from `main` to `prod` by hand in Vercel's UI, or Vercel will keep treating `main` pushes as production-domain-eligible regardless of what GitHub Actions does.
- **`prod` branch sync** — PR #2 (`main`→`prod`) is open but not yet merged, so `prod` still doesn't have this phase's own workflow files yet, or anything from PR #1 (password reset, CI fixes, dependency patches). Once #2 merges, `migrate-production.yml`/`deploy-production.yml` become dispatchable, though still blocked on the `production` secrets above.

## Verification performed

- `python3 -c "import yaml; yaml.safe_load(...)"` — all 6 workflow files (5 touched/added + `preview.yml` re-checked) parse as valid YAML.
- `python3 -c "import json; json.load(...)"` — `vercel.json` valid.
- Confirmed via the GitHub API (not assumed) that the `production` Environment's deployment-branch policy now lists exactly one branch, `prod`, and that `staging` exists.
- PR #1 (`dev`→`main`): `CI` and `Check migrations against staging` both completed `success` — the new `ci.yml` and `migration-check.yml` validated against a real PR, not just YAML syntax. Merged 2026-09-04.
- **Not performed, and cannot be from here**: actually running `migrate-production.yml` or `deploy-production.yml` end-to-end — both need real production database/Vercel credentials this environment doesn't have. `migrate-staging.yml` is wired with real credentials now but hasn't fired yet (waiting on the next `prisma/`-touching push to `main`).

## What's next

1. Merge PR #2 (`main`→`prod`, open) to bring `prod` current.
2. User sets up a Neon branch/project for production distinct from staging's `ep-long-poetry-b10ur5jg`, then pastes its `DATABASE_URL`/`DIRECT_URL` into the `production` GitHub Environment.
3. User creates/pastes `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` into `production`.
4. User changes Vercel's Production Branch setting to `prod` in the dashboard (Settings → Git → Production Branch).
5. Separately, and lower priority: the `Preview` GitHub Environment also has zero secrets, so PR preview deploys currently fail (`Deploy preview to Vercel` red on PR #1) — pre-existing gap, unrelated to this phase's code.

None of items 2-4 are things this environment can do — they need real external credentials or dashboard access only the user has.
