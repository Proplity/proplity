// Whether /login should auto-redirect to /setup when the platform's
// first-run admin hasn't been created yet. Off by default -- a seeded
// dev/staging environment (setupComplete is already true from the seed
// script) never needs this, and it costs every /login load an extra
// GET /api/v1/setup round-trip while it's on.
export function setupRedirectEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SETUP_REDIRECT_ENABLED === 'true';
}
