import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, getClientIp } from '@/lib/auth/rateLimit';

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  if (!(await checkRateLimit(`refresh:${getClientIp(req)}`))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const rawRefreshToken = req.cookies.get('refresh_token')?.value;
  if (!rawRefreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // Atomic update: only succeeds if token is active and unrevoked
  const rotated = await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });

  if (rotated.count === 0) {
    // Reuse detected or invalid/expired session — revoke family if reuse of rotated token
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing?.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId },
        data: { revokedAt: new Date() },
      });
    }
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or revoked session' }, { status: 401 });
  }

  const currentToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!currentToken || currentToken.user.status !== 'ACTIVE') {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
  }

  const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: currentToken.id },
      data: { replacedBy: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: currentToken.userId,
        tokenHash: newTokenHash,
        familyId: currentToken.familyId,
        // Inherit the rotated token's own expiry rather than resetting to a
        // fresh +7 days -- rotation refreshes the token value, it shouldn't
        // extend (or shorten) the session length the original login/rememberMe
        // choice set (1 day / 30 days per login/route.ts).
        expiresAt: currentToken.expiresAt,
      },
    }),
  ]);

  const newAccessToken = await signAccessToken({
    sub: currentToken.user.id,
    role: currentToken.user.role,
  });
  // Cookie maxAge must match the token's actual remaining lifetime (set
  // above), not cookies.ts's 7-day default -- otherwise the browser drops
  // the cookie on a different schedule than the DB row actually expires on.
  const remainingSeconds = Math.max(
    0,
    Math.floor((currentToken.expiresAt.getTime() - Date.now()) / 1000),
  );
  await setAuthCookies(newAccessToken, newRawRefreshToken, remainingSeconds);

  return NextResponse.json({ success: true });
}
