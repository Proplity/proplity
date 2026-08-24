import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { Role, UserStatus } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const clientIp = getClientIp(req);
  if (!(await checkRateLimit(`register:${clientIp}`))) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { email, password, name, role: inputRole } = parsed.data;

    // Check duplicate user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await recordAttempt(`register:${clientIp}`);
      return NextResponse.json({ error: 'Email address is already registered' }, { status: 409 });
    }

    // Map role string to Role enum -- ADMIN is deliberately excluded from
    // this allow-list. It's a real Role enum value, but self-registration
    // must never be able to mint one; admins are provisioned out-of-band.
    const SELF_REGISTERABLE_ROLES: Role[] = [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR];
    const upperRole = (inputRole || 'TENANT').toUpperCase();
    const role: Role = SELF_REGISTERABLE_ROLES.includes(upperRole as Role)
      ? (upperRole as Role)
      : Role.TENANT;

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (Active by default for seamless onboarding, with pending verification support)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
      },
    });

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
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Failed to process registration' }, { status: 500 });
  }
}
