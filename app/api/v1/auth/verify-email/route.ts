import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { status: 'ACTIVE' } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.json({ success: true, message: 'Email verified successfully' });
}
