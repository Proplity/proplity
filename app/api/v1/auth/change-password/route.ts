import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/auth/session';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  const user = await prisma.user.findUnique({ where: { id: session.sub } });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid current password' }, { status: 400 });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await clearAuthCookies();
  return NextResponse.json({ success: true, message: 'Password updated. Please log in again.' });
}
