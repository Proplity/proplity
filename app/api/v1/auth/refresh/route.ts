import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { RefreshToken } from '@prisma/client';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';
import {
  reserveAttempt,
  releaseAttempt,
  getClientIp,
  REFRESH_MAX_ATTEMPTS,
} from '@/lib/auth/rateLimit';
import { REFRESH_GRACE_MS } from '@/lib/auth/refreshGrace';

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  // No refresh cookie means a signed-out visitor: every page load calls this
  // after /auth/me returns 401, so counting these against the per-IP budget
  // let anonymous traffic (or many people behind one NAT) lock real users out
  // of silent session restore. Answer it before reserving an attempt.
  const rawRefreshToken = req.cookies.get('refresh_token')?.value;
  if (!rawRefreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
  }

  // Reserved before any work, atomically (see reserveAttempt's own
  // comment). Previously this called the old checkRateLimit() but never
  // recordAttempt() anywhere in this route -- no LoginAttempt row was ever
  // created with a "refresh:" identifier, so the check always passed and
  // rate limiting on this endpoint was silently dead in production.
  // Released below on a successful refresh; kept on every failure path
  // (missing/invalid/expired/reused token, inactive account), matching
  // login's "only failures count" semantics.
  const identifier = `refresh:${getClientIp(req)}`;
  const { allowed, attemptId } = await reserveAttempt(identifier, undefined, REFRESH_MAX_ATTEMPTS);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // The replacement is chosen up front so the rotation stays one atomic statement that also
  // records which token replaced this one. A retry that lands while the new row is still being
  // written then sees the link (and gets the harmless in-window answer below) instead of a bare
  // revocation that looks like theft (ADR-0016).
  const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

  // Atomic update: only succeeds if token is active and unrevoked
  const rotated = await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date(), replacedBy: newTokenHash },
  });

  // Set when the old value of a token rotated moments ago is accepted once more (ADR-0016).
  let graceToken: RefreshToken | null = null;

  if (rotated.count === 0) {
    // Reuse detected or invalid/expired session — revoke family if reuse of rotated token
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing?.revokedAt) {
      const withinGrace =
        existing.replacedBy !== null &&
        existing.expiresAt > new Date() &&
        Date.now() - existing.revokedAt.getTime() < REFRESH_GRACE_MS;
      if (withinGrace) {
        // The response that carried the replacement may have been lost. Take the replacement
        // out of service with one atomic claim: only the first retry wins, so the old value
        // can be used once more, never twice. A losing retry gets a 401 and leaves the family
        // and the cookies alone (the winner has just set new ones).
        const claimed = await prisma.refreshToken.updateMany({
          where: { tokenHash: existing.replacedBy!, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (claimed.count === 0) {
          return NextResponse.json({ error: 'Invalid or revoked session' }, { status: 401 });
        }
        graceToken = existing;
      } else {
        await prisma.refreshToken.updateMany({
          where: { familyId: existing.familyId },
          data: { revokedAt: new Date() },
        });
      }
    }
    if (!graceToken) {
      await clearAuthCookies();
      return NextResponse.json({ error: 'Invalid or revoked session' }, { status: 401 });
    }
  }

  const currentToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!currentToken || currentToken.user.status !== 'ACTIVE') {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
  }

  await releaseAttempt(attemptId);

  await prisma.$transaction([
    // In the grace case the old row keeps pointing at the replacement it handed out, so a
    // second retry finds that replacement already claimed; the chain continues from it.
    ...(graceToken?.replacedBy
      ? [
          prisma.refreshToken.updateMany({
            where: { tokenHash: graceToken.replacedBy },
            data: { replacedBy: newTokenHash },
          }),
        ]
      : []),
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
