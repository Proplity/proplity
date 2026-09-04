import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { validateBody } from '@/lib/api/validate';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// Deliberately NOT wrapped in validateCSRF, same rule as verify-email
// (CLAUDE.md rule 3): the single-use, time-limited, high-entropy token *is*
// the security boundary here, not Origin matching -- and unlike a normal
// mutating route, the caller has no session yet for an Origin check to
// protect. Do not "fix" this by adding validateCSRF().
export async function POST(req: NextRequest) {
  const validated = await validateBody(req, resetPasswordSchema);
  if (!validated.success) return validated.response;
  const { token, password } = validated.data;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Same "kill every session" convention as change-password: a password
  // reset is exactly the moment an attacker's already-stolen session
  // (if that's why the user is resetting) needs to die too.
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  // Clears whatever stale session cookies this browser happens to be
  // carrying -- harmless no-op if there weren't any.
  await clearAuthCookies();

  return NextResponse.json({ success: true, message: 'Password reset. Please log in again.' });
}
