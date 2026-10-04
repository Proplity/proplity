import { Role } from '@prisma/client';
import { SignJWT } from 'jose';
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

/**
 * A validly-signed access-token cookie that already expired an hour ago --
 * for exercising logout's tolerance of an expired-but-genuine token
 * (getExpiredSession / verifyTokenAllowExpired in lib/auth/jwt.ts). Signed
 * directly with jose rather than signAccessToken, which hardcodes a 15m
 * future expiry with no way to override it.
 */
export async function expiredAccessCookie(userId: string, role: Role): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'dev_proplity_jwt_secret_key_2026_only_for_local_testing_environment',
  );
  const token = await new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secret);
  return `access_token=${token}`;
}
