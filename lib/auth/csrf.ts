import { NextRequest } from 'next/server';

export function validateCSRF(req: NextRequest): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;

  const origin = req.headers.get('origin');
  if (origin) {
    return new URL(origin).host === host;
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
