import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/auth/session';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { validateCSRF } from '@/lib/auth/csrf';
import { validateBody } from '@/lib/api/validate';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  // Matches register's own policy (z.string().min(6)) -- this route had no
  // minimum at all before, letting a logged-in user set a 1-character password.
  newPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const validated = await validateBody(req, changePasswordSchema);
  if (!validated.success) return validated.response;
  const { currentPassword, newPassword } = validated.data;

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
