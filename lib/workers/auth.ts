// Mirrors lib/auth/jwt.ts's guard pattern: a dev fallback, but a hard
// failure if CRON_SECRET is ever unset in production.
const secret = process.env.CRON_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: CRON_SECRET environment variable is not defined in production!');
}
const cronSecret = secret || 'dev-cron-secret';

export function verifyCronSecret(req: { headers: { get(name: string): string | null } }): boolean {
  return req.headers.get('x-cron-secret') === cronSecret;
}
