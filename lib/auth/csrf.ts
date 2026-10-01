import { NextRequest } from 'next/server';

export function validateCSRF(req: NextRequest): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      // A malformed Origin should fail closed (403), not throw an
      // unhandled 500 inside the route handler -- same as the Referer
      // fallback below, which already guards this identical call.
      return false;
    }
  }

  // Fallback to Referer if Origin header is missing
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Reject mutating requests missing both headers
  return false;
}
