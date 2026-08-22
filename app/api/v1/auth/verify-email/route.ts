import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  // password is only meaningful for an invited user who never set one
  // (see POST /api/v1/leases's tenantEmail path) -- optional and backward
  // compatible with plain register-style verification.
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { status: 'ACTIVE', ...(passwordHash ? { passwordHash } : {}) },
    }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.json({ success: true, message: 'Email verified successfully' });
}
