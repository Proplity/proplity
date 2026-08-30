import { timingSafeEqual } from 'crypto';

// Mirrors lib/auth/jwt.ts's guard pattern: a dev fallback, but a hard
// failure if CRON_SECRET is ever unset in production.
const secret = process.env.CRON_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: CRON_SECRET environment variable is not defined in production!');
}
const cronSecret = secret || 'dev-cron-secret';

// Constant-time so a caller can't recover the secret byte-by-byte by timing
// repeated guesses. Length is compared first because timingSafeEqual throws
// on differing buffer lengths -- that leak is only the length, not content.
const encoder = new TextEncoder();

function secretMatches(candidate: string | null): boolean {
  if (!candidate) return false;
  // TextEncoder (not Buffer.from) because timingSafeEqual's typings want an
  // ArrayBufferView, and Buffer no longer structurally satisfies Uint8Array
  // under this repo's @types/node.
  const a = encoder.encode(candidate);
  const b = encoder.encode(cronSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Accepts either credential shape, because two different schedulers call this:
 *
 *  - `Authorization: Bearer <CRON_SECRET>` — what Vercel Cron sends. It signs
 *    the request with the project's own CRON_SECRET env var automatically;
 *    the header name and scheme are not configurable.
 *  - `x-cron-secret: <CRON_SECRET>` — the original scheme, kept so a system
 *    crontab, a CI job, or a manual curl keeps working unchanged.
 */
export function verifyCronSecret(req: { headers: { get(name: string): string | null } }): boolean {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ') && secretMatches(bearer.slice(7))) return true;
  return secretMatches(req.headers.get('x-cron-secret'));
}
