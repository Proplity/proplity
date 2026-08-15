import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { validateCSRF } from '@/lib/auth/csrf';

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const { email, password } = await req.json();
  const identifier = `${getClientIp(req)}:${email}`;

  if (!(await checkRateLimit(identifier))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));

  if (!valid) {
    await recordAttempt(identifier, user?.id);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (user.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Account is suspended' }, { status: 403 });
  }
  if (user.status === 'PENDING_VERIFICATION') {
    return NextResponse.json({ error: 'Please verify your email address first' }, { status: 403 });
  }

  // Non-blocking lastLoginAt update
  prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const familyId = crypto.randomUUID();
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  await setAuthCookies(accessToken, rawRefreshToken);

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      status: user.status,
    },
  });
}
