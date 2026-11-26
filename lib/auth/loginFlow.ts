// The one sign-in implementation behind both endpoints:
//   POST /api/v1/auth/login        -- everyone except admins
//   POST /api/v1/auth/admin/login  -- admins only
// An account of the wrong kind gets the same "Invalid email or password" as a wrong password,
// after the same bcrypt work, and counts as a failed attempt, so neither endpoint tells a caller
// whether an address belongs to an admin. Which host each endpoint answers on is lib/adminHost.ts.
import { NextRequest, NextResponse } from 'next/server';
import { emailSchema, findUserByEmail } from '@/lib/auth/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { reserveAttempt, releaseAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { validateCSRF } from '@/lib/auth/csrf';
import { validateBody } from '@/lib/api/validate';
import { hostMode } from '@/lib/adminHost';

export type LoginAudience = 'general' | 'admin';

// A fixed, precomputed bcrypt hash (cost 12, matching real password hashes)
// with no corresponding real password. Compared against on every login
// attempt for an email that doesn't exist, so `bcrypt.compare`'s runtime
// -- dominated by its cost factor, not the input -- stays the same whether
// or not the account is real. Without this, the short-circuited compare
// for a nonexistent user returns measurably faster, letting an attacker
// enumerate registered emails by timing alone.
const DUMMY_PASSWORD_HASH = '$2b$12$Ap7iynbmTBWuWC3S1WvT..O4K2cs/uJW2VBW265CJTYPUsltUghEq';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function handleLogin(req: NextRequest, audience: LoginAudience) {
  // With a separate admin host configured each endpoint exists on one side only; elsewhere it
  // answers as if the route were not there.
  const mode = hostMode(req);
  if ((audience === 'admin' && mode === 'public') || (audience === 'general' && mode === 'admin')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const validated = await validateBody(req, loginSchema);
  if (!validated.success) return validated.response;
  const { email, password, rememberMe = true } = validated.data;

  const scope = audience === 'admin' ? 'admin-login' : 'login';
  const identifier =
    audience === 'admin' ? `admin:${getClientIp(req)}:${email}` : `${getClientIp(req)}:${email}`;

  // Reserved BEFORE the slow work (bcrypt compare) below, atomically --
  // checking then recording separately left a window where concurrent
  // requests for the same identifier could all pass the count check before
  // any of them had recorded an attempt. Released below if login succeeds,
  // so only failed attempts ultimately count toward the window, same as
  // before.
  const { allowed, attemptId } = await reserveAttempt(identifier);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  // A second, per-account budget across all IPs, so a distributed guesser cannot get
  // a fresh allowance from every address. Higher than the per-IP one so a victim is not
  // easily locked out by someone else's bad guesses; released on success like the first.
  const account = await reserveAttempt(
    `${scope}-account/${email}`,
    undefined,
    audience === 'admin' ? 10 : 30,
  );
  if (!account.allowed) {
    await releaseAttempt(attemptId);
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  // An account of the wrong kind for this endpoint is indistinguishable from a wrong password.
  const rightKind = user ? (user.role === 'ADMIN') === (audience === 'admin') : false;

  if (!user || !valid || !rightKind) {
    // userId wasn't known yet at reservation time (it happens before this
    // lookup) -- backfill it on the row the reservation already created, so
    // the audit trail still shows which real account was targeted, same as
    // the pre-existing recordAttempt(identifier, user?.id) call did.
    if (user && attemptId) {
      await prisma.loginAttempt
        .update({ where: { id: attemptId }, data: { userId: user.id } })
        .catch(() => {});
    }
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  await releaseAttempt(account.attemptId);

  if (user.status === 'SUSPENDED') {
    await releaseAttempt(attemptId);
    return NextResponse.json({ error: 'Account is suspended' }, { status: 403 });
  }
  if (user.status === 'PENDING_VERIFICATION') {
    await releaseAttempt(attemptId);
    return NextResponse.json({ error: 'Please verify your email address first' }, { status: 403 });
  }

  await releaseAttempt(attemptId);

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
