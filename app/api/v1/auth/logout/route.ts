import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';
import { getServerSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  // The refresh_token cookie is scoped to path=/api/v1/auth/refresh, so it is NOT
  // sent to this endpoint. Instead, read the access_token to identify the user
  // and revoke all their active refresh tokens by userId.
  const session = await getServerSession();

  if (session) {
    await prisma.refreshToken
      .updateMany({
        where: { userId: session.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
  }

  await clearAuthCookies();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
