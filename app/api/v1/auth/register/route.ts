import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { sendEmail } from '@/lib/email';
import { Role, UserStatus } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.string().optional(),
  // Only meaningful when role resolves to MANAGER -- checked for real here
  // (never trust the client-side GET /manager-codes/check result alone,
  // that's a UX preview only) and, if valid, linked in the same
  // transaction as account creation.
  landlordCode: z.string().optional(),
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

    const { email, password, name, role: inputRole, landlordCode } = parsed.data;

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

    // A MANAGER account must come with a real, currently-redeemable
    // landlord code -- re-validated here regardless of what the
    // check-code preview endpoint said, since that response is
    // client-trusted UX only.
    let inviteCodeId: string | null = null;
    if (role === Role.MANAGER) {
      if (!landlordCode) {
        return NextResponse.json({ error: 'A landlord invitation code is required to register as a manager' }, { status: 400 });
      }
      const code = await prisma.managerInviteCode.findUnique({
        where: { code: landlordCode.trim().toUpperCase() },
      });
      if (!code || code.status !== 'ACTIVE' || code.linkedManagerId) {
        return NextResponse.json({ error: 'Invalid or already-used landlord code' }, { status: 400 });
      }
      inviteCodeId = code.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, passwordHash, role, status: UserStatus.PENDING_VERIFICATION },
      });

      await tx.verificationToken.create({
        data: { userId: created.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      // Re-check-and-link inside the transaction, not just at the earlier
      // read -- narrows (doesn't eliminate) the window for two concurrent
      // registrations to both pass the outer check for the same code, same
      // accepted-race shape as AccessCode's/Application's own duplicate
      // checks elsewhere in this codebase.
      if (inviteCodeId) {
        const stillFree = await tx.managerInviteCode.updateMany({
          where: { id: inviteCodeId, status: 'ACTIVE', linkedManagerId: null },
          data: { linkedManagerId: created.id, linkedAt: new Date() },
        });
        if (stillFree.count === 0) {
          throw new Error('LANDLORD_CODE_RACE');
        }
      }

      return created;
    });

    await sendEmail({
      to: user.email,
      subject: 'Verify your Proplity account',
      body: `Hi ${user.name},\n\nWelcome to Proplity! Confirm your email address to activate your account:\n\nhttp://localhost:3000/verify-email?token=${rawToken}\n\nThis link expires in 7 days.`,
    });

    // No session is established here -- the account is PENDING_VERIFICATION
    // until the link above is used, and login already 403s that status
    // with a clear "verify your email" message, so nothing else needs to
    // change to keep an unverified account locked out until then.
    return NextResponse.json({
      success: true,
      requiresVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
        status: user.status,
      },
    });
  } catch (err: any) {
    if (err?.message === 'LANDLORD_CODE_RACE') {
      return NextResponse.json({ error: 'This landlord code was just used by someone else' }, { status: 409 });
    }
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Failed to process registration' }, { status: 500 });
  }
}
