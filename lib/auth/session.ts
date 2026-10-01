import { cookies } from 'next/headers';
import { verifyToken, verifyTokenAllowExpired, JWTPayload } from '@/lib/auth/jwt';

export async function getServerSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Identifies the caller even if their access_token already expired -- for
// logout only, which otherwise has no way to know whose refresh tokens to
// revoke (the refresh_token cookie is deliberately scoped to
// path=/api/v1/auth/refresh and is never sent here). Never use this for an
// authorization check.
export async function getExpiredSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return verifyTokenAllowExpired(token);
}
