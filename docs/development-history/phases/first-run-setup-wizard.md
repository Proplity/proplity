# First-run superadmin setup wizard

**Status:** Complete. **Date:** 2026-09-16.

## Why

A fresh production database has no `ADMIN` user, and the seed scripts (which
do create one) are a dev/staging-only path — nobody runs `pnpm prisma db
seed` against a real customer deployment. Without this, the only way to get
the first admin into a fresh production database was a manual `psql` insert
or a one-off script, which is exactly the kind of undocumented, easy-to-get-
wrong bootstrap step that should instead be a real, guarded route.

## What was built

**Schema** (`prisma/schema/system.prisma`, new): a `SystemSettings` singleton
model (`id = 'global'`, `setupComplete: Boolean`). Migration hand-written
(`prisma/migrations/20260915040000_system_settings/migration.sql`) mirroring
Prisma's generated SQL format, the same approach used for the notifications
and password-reset migrations before it — this sandbox has no live database
to run `prisma migrate dev` against. Verified via `prisma validate`, `prisma
generate`, and a full `next build`.

**API** (`app/api/v1/setup/route.ts`, new):

- `GET` — public, returns `{ setupComplete, requiresToken }`.
- `POST` — public (no JWT exists yet to require one), guarded by:
  1. `validateCSRF` (Origin/Referer match, same as every other mutating auth route).
  2. IP-keyed rate limiting (`checkRateLimit('setup:<ip>')`, the same helper login/register use).
  3. Zod validation — email, name, and a password policy (≥8 chars, at least one letter, at least one number — enforced here, not just implied by the UI checklist).
  4. Optional `SETUP_TOKEN` env var, compared with `crypto.timingSafeEqual` (checked via `x-setup-token` header or a form field).
  5. An atomic conditional update inside a `$transaction` —
     `systemSettings.updateMany({ where: { id: 'global', setupComplete: false }, data: { setupComplete: true } })`.
     If `count === 0`, someone else's request already completed setup between
     this request's read and write; that request's `admin.user.create` and
     `auditLog.create` never run, and the caller gets `409`. This is the same
     "only one concurrent writer wins" pattern as the refresh-token rotation
     check in `lib/auth/session` — a read-then-write here would have raced.

The created user is `role: ADMIN`, `status: ACTIVE`, `kycStatus: VERIFIED`
(auto-verified — the deployer running this wizard controls the email, so
there's no one else to verify against). An `AuditLog` row
(`action: 'FIRST_RUN_SETUP'`) records the IP, user-agent, and admin identity
in the same transaction as the user create, so the event can never exist
without an audit trail of who triggered it.

**Frontend** (`app/setup/`, new):

- `page.tsx` — a Server Component. Checks `SystemSettings.setupComplete`
  server-side and `redirect('/login')`s immediately if it's already `true`,
  so there's no client-side flash of the wizard before bouncing away. Fails
  open (renders the wizard) on a DB connection error rather than fails
  closed, so a transient DB blip during first deploy doesn't lock a deployer
  out of their own bootstrap step.
- `SetupWizardForm.tsx` — the actual form (name, email, password ×2, optional
  setup-token field shown only when the server says `requiresToken: true`). A
  live checklist (min length / letters+numbers / passwords match) gates the
  submit button — mirrored server-side by the same three conditions in the
  Zod schema, not just a client-side suggestion.

**Opt-in discoverability** (`app/login/page.tsx`, `lib/setup.ts`, both new/
modified): off by default. When `NEXT_PUBLIC_SETUP_REDIRECT_ENABLED=true`,
`/login` calls `GET /api/v1/setup` on mount and redirects to `/setup` if no
admin exists yet, so a deployer who doesn't already know the `/setup` URL
still finds it. Left off by default because it costs every `/login` load an
extra round-trip in the common case (a seeded dev/staging environment, where
`setupComplete` is already `true` from the seed script) for a check that only
ever matters once, on a genuinely fresh production database.

**Incidental change** (`app/page.tsx`, `app/components/LandingPage.tsx`): the
landing page (`/`) used to server-side redirect any logged-in visitor
straight to `/admin` or `/dashboard`, so a logged-in user could never actually
see the marketing site at `/`. Replaced with a client-side `useAuth()` check
inside `LandingPage` that swaps CTA copy/links ("Get Started" → "Go to
Dashboard", `/login` → `/dashboard` or `/admin`) instead of redirecting away —
a logged-in user can still browse `/` deliberately, but every call-to-action
takes them to their own dashboard rather than back through login.

## What's explicitly out of scope

- **No email to the new admin.** The account is auto-verified; nothing is
  sent because there's no delivery provider wired up yet (see CLAUDE.md
  "Deliberately deferred" — real email is a documented, separate gap).
- **`/` does not check `setupComplete`.** Only `/setup` (always) and `/login`
  (opt-in via env var) do. A deployer landing on `/` first with the redirect
  disabled sees the ordinary marketing site, not a prompt toward `/setup`.

## Verification performed

- `prisma validate`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`
  (with CI's placeholder env vars) — all clean.
- `tests/api/setup.test.ts` (new, 5 cases): fresh-DB `GET` status, CSRF
  rejection on a mismatched Origin, 400 on a malformed payload, a full
  successful bootstrap (user + `SystemSettings` + `AuditLog` all verified),
  and 409 on a second attempt after setup is already complete.
- **Not performed, and can't be from here**: actually running the test suite
  (needs a dedicated `proplity_test_db` via `.env.test`, not configured in
  this sandbox) or a live browser check of the wizard/redirect flow. CI's
  `postgres:18` service container runs `tests/api/setup.test.ts` for real on
  this PR.
