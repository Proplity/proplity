# Phase: Next.js 14.2.15 → 16.3.2 upgrade

**Status:** Complete and verified. **Date:** 2026-08-22.

## Why

Requested ahead of the pages-separation routing migration (splitting `app/App.tsx`'s client-state-driven views into real Next.js routes), so the new route code gets written directly against the target runtime instead of migrating twice. User asked for "the latest" specifically to pick up fixes for known bugs in older versions, not just the nearest safe increment.

## What changed

| File | Change |
|---|---|
| `package.json` | `next` `14.2.15` → `16.3.2`; `react`/`react-dom` `18.3.1` → `19.2.8`; `@types/react`/`@types/react-dom` bumped to match; added `overrides` pinning those types packages. |
| `pnpm-lock.yaml` | Regenerated for the above. |
| `next.config.mjs` | Removed the dead `eslint.ignoreDuringBuilds` key (Next 16 dropped built-in ESLint-during-build entirely — the key is now silently ignored, so this was a no-op warning, not a functional change). Added `serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg']` — see "Real bugs found" below. |
| `pnpm-workspace.yaml` | Fixed `esbuild: set this to true or false` — a literal placeholder string that was never filled in — to `esbuild: true`. Unrelated to the Next upgrade itself, but blocked `prisma generate` (which internally runs a dependency-status `pnpm install`) from completing. |
| `proxy.ts` | Renamed the exported `middleware` function to `proxy` (Next 16's required export name) and fixed its redirect target from `/login` (doesn't exist) to `/`. See "Real bugs found" below — this file had never actually executed before this upgrade. |
| `tsconfig.json` | Next auto-rewrote this on first build: `jsx: "preserve"` → `"react-jsx"` (mandatory — Next 16 uses React's automatic JSX runtime), added `.next/dev/types/**/*.ts` to `include`. Array formatting also got expanded to multi-line by Next's own writer; left as-is rather than fighting it, since Next will just rewrite it again. |
| `CLAUDE.md` | Next 16 auto-appends an "agent rules" block on every `next dev` run (a new built-in feature aimed at AI coding agents — warns that the installed version may differ from an agent's training data and points at `node_modules/next/dist/docs/`). Additive only, regenerates itself if removed, so it's being committed rather than fought. |

## Real bugs found along the way (not hypothetical, all reproduced)

### 1. `proxy.ts` was dead code this entire project, and Next 16 makes it live

Under Next 14, the special edge-middleware filename convention was `middleware.ts`. This project instead has a file at `proxy.ts` — `PROJECT_STRUCTURE.md` describes it as a "Dev proxy script," but it's actually a full JWT-auth edge guard (redirects unauthenticated `/dashboard`/`/admin` requests, blocks non-`ADMIN` users from `/admin`). Because the filename didn't match Next 14's convention, **this logic has never executed in production or dev, ever** — confirmed by the fact that its Next 14 build never referenced it and `CLAUDE.md`'s own "Auth architecture" section makes no mention of edge middleware, only route-level `getServerSession()` checks.

Next 16 renamed the convention to exactly `proxy.ts`. The build immediately failed (`Proxy is missing expected function export name`) because the file still exported `middleware` instead of the now-required `proxy`/default export. Asked the user how to handle a previously-dead file suddenly going live; they chose to activate it (see [AskUserQuestion] response "Fix and activate it") rather than keep it inert. Fixed the export name and its independent instance of the same `/login`-doesn't-exist bug already fixed elsewhere in `CLAUDE.md`'s known-bugs list.

**Practical effect right now: none yet.** Its matcher (`/dashboard/:path*`, `/admin/:path*`) only fires on real Next.js routes with those paths, and none exist yet — the whole app currently lives under `/`. It becomes operative once the pages-separation migration (the next phase) creates real `/dashboard` and `/admin` routes.

### 2. Turbopack (Next 16's default bundler) can't resolve `pg`/`@prisma/client` even though they're on Next's own default-external list

Both are in Next's built-in `serverExternalPackages` defaults, but that default isn't reliably honored by Turbopack when the packages live in pnpm's nested `.pnpm` virtual store (a known upstream gap — [vercel/next.js#68805](https://github.com/vercel/next.js/issues/68805), [vercel/next.js#88844](https://github.com/vercel/next.js/issues/88844)). Confirmed by testing with `next build --webpack` too — same failure, ruling out a Turbopack-only cause and pointing at the underlying pnpm resolution. Fix: declare both packages (plus `@prisma/adapter-pg`, whose internal `pg` import hit the same issue) explicitly in `serverExternalPackages`.

### 3. A separate, coincidental node_modules corruption (not a Next 16 issue)

Independent of the above: `node_modules/@prisma/client` and `node_modules/pg` were both resolving to **empty directories** — the pnpm virtual-store folders existed with correct names but zero files inside, for both packages simultaneously. Root cause traced to the churn from the earlier flaky/interrupted installs (the codemod's own `npm install` step timed out mid-run; several retried `pnpm install`s hit registry timeouts too) leaving pnpm's project-local store links in a broken state that `pnpm install --force` did not repair. Fixed with a full `rm -rf node_modules && pnpm install`, which re-materializes everything cleanly from pnpm's (intact) global content store — confirmed by checking both packages actually had real files afterward, not just correctly-named directories.

### 4. `pnpm-workspace.yaml`'s broken `esbuild` entry blocked `prisma generate`

Unrelated to Next itself, but blocking: Prisma 7's `generate` command runs an internal `pnpm install` dependency-status check, which hard-failed on `[ERR_PNPM_IGNORED_BUILDS]` because of the `esbuild: set this to true or false` placeholder. Fixed by setting it to the boolean `true` it was clearly meant to be (matches `package.json`'s `onlyBuiltDependencies` list, which already names `esbuild`).

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors (same as pre-upgrade baseline).
- `pnpm build` — succeeds. Output confirms all 7 `/api/v1/auth/*` routes built, plus `ƒ Proxy (Middleware)` showing the reactivated `proxy.ts` is correctly wired in.
- `pnpm dev` + `curl`: `GET /` → `200`; `GET /api/v1/auth/me` (unauthenticated) → `401` as expected. Note: this was an HTTP-level smoke test, not an interactive browser click-through of the demo-login flow — no browser tool was available in this session to do that step from the original plan.

## Not done in this phase

- No interactive browser verification of the actual login UI flow (see note above) — worth doing manually, or once the pages-separation work gives us real per-role dashboard routes to hit directly.
- `proxy.ts`'s route protection has no visible effect yet (see bug #1) — it'll start mattering once real `/dashboard`/`/admin` routes exist.

## Next up

Resume the pages-separation routing migration — the background `Explore` agent's full navigation-prop map (23-variant `Page` union in `App.tsx`, ~40 components' nav signatures) is already gathered from before this upgrade was requested. Per Next's own agent-rules note in `CLAUDE.md`, worth checking `node_modules/next/dist/docs/` for anything Next 16-specific about App Router route conventions before writing the new route files.
