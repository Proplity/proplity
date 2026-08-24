import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { validateCSRF } from '@/lib/auth/csrf';
import { validateBody } from '@/lib/api/validate';

// A fixed, precomputed bcrypt hash (cost 12, matching real password hashes)
// with no corresponding real password. Compared against on every login
// attempt for an email that doesn't exist, so `bcrypt.compare`'s runtime
// -- dominated by its cost factor, not the input -- stays the same whether
// or not the account is real. Without this, the short-circuited compare
// for a nonexistent user returns measurably faster, letting an attacker
// enumerate registered emails by timing alone.
const DUMMY_PASSWORD_HASH = '$2b$12$Ap7iynbmTBWuWC3S1WvT..O4K2cs/uJW2VBW265CJTYPUsltUghEq';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const validated = await validateBody(req, loginSchema);
  if (!validated.success) return validated.response;
  const { email, password, rememberMe = true } = validated.data;

  const identifier = `${getClientIp(req)}:${email}`;

  if (!(await checkRateLimit(identifier))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !valid) {
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

  const refreshDays = rememberMe ? 30 : 1;
  const refreshMaxAgeSeconds = refreshDays * 24 * 60 * 60;

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + refreshMaxAgeSeconds * 1000),
    },
  });

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  await setAuthCookies(accessToken, rawRefreshToken, refreshMaxAgeSeconds);

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
