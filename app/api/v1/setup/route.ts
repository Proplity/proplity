import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { Role, UserStatus, KycStatus } from '@prisma/client';

const setupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number'),
  setupToken: z.string().optional(),
});

/**
 * GET /api/v1/setup
 * Returns the current platform setup state and whether a SETUP_TOKEN is required.
 * Fully public, used by the client setup form.
 */
export async function GET() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'global' },
    });

    return NextResponse.json({
      setupComplete: !!settings?.setupComplete,
      requiresToken: Boolean(process.env.SETUP_TOKEN),
    });
  } catch (err) {
    console.error('[SETUP_STATUS_ERROR]', err);
    // If table doesn't exist yet or connection blip, report setup incomplete so wizard can load
    return NextResponse.json({
      setupComplete: false,
      requiresToken: Boolean(process.env.SETUP_TOKEN),
    });
  }
}

/**
 * POST /api/v1/setup
 * One-time first-run setup wizard endpoint to bootstrap the first ADMIN account.
 * Guarded by:
 * 1. CSRF validation
 * 2. IP-keyed rate limiting
 * 3. SETUP_TOKEN env var (defense-in-depth against public-facing race)
 * 4. Atomic conditional update (updateMany where setupComplete: false)
 * 5. Full audit logging of IP, user-agent, timestamp, and admin identity
 */
export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const clientIp = getClientIp(req);
  if (!(await checkRateLimit(`setup:${clientIp}`))) {
    return NextResponse.json(
      { error: 'Too many setup attempts from this IP. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { email, password, name, setupToken } = parsed.data;

    // Defense-in-depth: If SETUP_TOKEN is set in environment, verify it
    const expectedToken = process.env.SETUP_TOKEN;
    if (expectedToken) {
      const providedToken = req.headers.get('x-setup-token') || setupToken || '';
      const encoder = new TextEncoder();
      const expectedBuf = encoder.encode(expectedToken);
      const providedBuf = encoder.encode(providedToken);

      const isValidToken =
        expectedBuf.byteLength === providedBuf.byteLength &&
        crypto.timingSafeEqual(expectedBuf, providedBuf);

      if (!isValidToken) {
        await recordAttempt(`setup:${clientIp}`);
        return NextResponse.json(
          { error: 'Invalid or missing setup token. Check your server environment settings.' },
          { status: 401 },
        );
      }
    }

    // Fast preliminary check before expensive bcrypt hash
    const currentSettings = await prisma.systemSettings.findUnique({
      where: { id: 'global' },
    });
    if (currentSettings?.setupComplete) {
      return NextResponse.json(
        { error: 'Platform setup has already been completed.' },
        { status: 409 },
      );
    }

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await recordAttempt(`setup:${clientIp}`);
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 409 },
      );
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Atomic conditional transaction:
    // Guarantees only one concurrent request can ever transition setupComplete from false -> true.
    const admin = await prisma.$transaction(async (tx) => {
      // Ensure the singleton row exists
      await tx.systemSettings.upsert({
        where: { id: 'global' },
        update: {},
        create: { id: 'global', setupComplete: false },
      });

      // Conditional update: only updates if setupComplete is currently false
      const updateResult = await tx.systemSettings.updateMany({
        where: { id: 'global', setupComplete: false },
        data: { setupComplete: true },
      });

      if (updateResult.count === 0) {
        throw new Error('SETUP_ALREADY_COMPLETED');
      }

      // Create first ADMIN user - auto-verified and active immediately
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
          kycStatus: KycStatus.VERIFIED,
        },
      });

      // Audit log the creation event
      await tx.auditLog.create({
        data: {
          actorId: newUser.id,
          action: 'FIRST_RUN_SETUP',
          entityType: 'SystemSettings',
          entityId: 'global',
          metadata: {
            ip: clientIp,
            userAgent,
            email: newUser.email,
            name: newUser.name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return newUser;
    });

    console.log(
      `[FIRST_RUN_SETUP] Platform administrator created: ${admin.email} (ID: ${admin.id}) from IP ${clientIp}`,
    );

    return NextResponse.json(
      {
        message: 'Platform administrator account created successfully. Setup is now complete.',
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === 'SETUP_ALREADY_COMPLETED') {
      return NextResponse.json(
        { error: 'Platform setup has already been completed.' },
        { status: 409 },
      );
    }
    console.error('[SETUP_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during setup. Please try again.' },
      { status: 500 },
    );
  }
}
