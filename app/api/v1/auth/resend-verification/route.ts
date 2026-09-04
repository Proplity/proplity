import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { appUrl } from '@/lib/appUrl';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { validateBody } from '@/lib/api/validate';
import { sendEmail } from '@/lib/email';

const resendSchema = z.object({
  email: z.string().email(),
});

// Same generic-response shape as forgot-password, for the same reason: not
// distinguishing "no such account" / "already verified" / "verification
// sent" from the outside prevents using this route to enumerate accounts
// or check verification status.
const GENERIC_RESPONSE = {
  success: true,
  message: "If that email needs verifying, we've sent a new link to it.",
};

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const validated = await validateBody(req, resendSchema);
  if (!validated.success) return validated.response;
  const { email } = validated.data;

  const identifier = `${getClientIp(req)}:${email}`;
  if (!(await checkRateLimit(identifier))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  await recordAttempt(identifier);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === 'PENDING_VERIFICATION') {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // upsert: VerificationToken.userId is @unique, same reasoning as
    // forgot-password's upsert -- a resend replaces the original
    // registration-time token, since only the latest link should work.
    await prisma.verificationToken.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: { tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    await sendEmail({
      to: user.email,
      subject: 'Verify your Proplity account',
      body: `Hi ${user.name},\n\nHere's a fresh link to verify your email address and activate your account:\n\n${appUrl(`/verify-email?token=${rawToken}`)}\n\nThis link expires in 7 days.`,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
