import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/passwordPolicy';

export async function POST(req: NextRequest) {
  let body: { token?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // falls through to the missing-token error
  }
  const { token, password } = body;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
  }
  if (
    password !== undefined &&
    (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH)
  ) {
    return NextResponse.json({ error: PASSWORD_TOO_SHORT }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  // password is only meaningful for an invited user who never set one
  // (see POST /api/v1/rents's tenantEmail path) -- optional and backward
  // compatible with plain register-style verification.
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  // Only a person still waiting to verify changes state. A leftover link (an earlier
  // email from before a resend) must never re-activate a suspended account or reset the
  // password of one that is already active. Every token for the user is spent at once.
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: record.userId, status: 'PENDING_VERIFICATION' },
      data: { status: 'ACTIVE', ...(passwordHash ? { passwordHash } : {}) },
    });
    await tx.verificationToken.deleteMany({ where: { userId: record.userId } });
  });

  return NextResponse.json({ success: true, message: 'Email verified successfully' });
}
