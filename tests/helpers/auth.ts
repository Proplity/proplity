import { Role } from '@prisma/client';
import { signAccessToken } from '@/lib/auth/jwt';

/**
 * Mints a real access-token cookie directly, bypassing the login route.
 * Keeps non-auth test files fast and independent of the DB-backed login
 * rate limiter (5 attempts/5min) -- login itself is only exercised for real
 * in tests/api/auth.test.ts, where it's the thing under test.
 */
export async function authCookie(userId: string, role: Role): Promise<string> {
  const token = await signAccessToken({ sub: userId, role });
  return `access_token=${token}`;
}
