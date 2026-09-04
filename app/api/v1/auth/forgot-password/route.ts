import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { appUrl } from '@/lib/appUrl';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/auth/rateLimit';
import { validateBody } from '@/lib/api/validate';
import { sendEmail } from '@/lib/email';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// Always responds 200 with the same generic message regardless of whether
// the email is registered -- telling an anonymous caller "no account with
// that email" is a user-enumeration leak. The only observable difference
// for an unregistered email is that no email goes out.
const GENERIC_RESPONSE = {
  success: true,
  message: "If that email is registered, we've sent password reset instructions to it.",
};

export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const validated = await validateBody(req, forgotPasswordSchema);
  if (!validated.success) return validated.response;
  const { email } = validated.data;

  // Same identifier shape as login's rate limiter (ip:email) -- bounds
  // both a single IP hammering many emails and one email being targeted
  // from many IPs isn't the threat model here (the response is identical
  // either way, so there's nothing to brute-force), this just stops
  // mailbox-bombing a real user.
  const identifier = `${getClientIp(req)}:${email}`;
  if (!(await checkRateLimit(identifier))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  await recordAttempt(identifier);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // upsert: userId is @unique on PasswordResetToken, so a second request
    // replaces the first rather than erroring -- only the latest emailed
    // link should ever work.
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    await sendEmail({
      to: user.email,
      subject: 'Reset your Proplity password',
      body: `Hi ${user.name},\n\nWe received a request to reset your Proplity password. Click the link below to choose a new one:\n\n${appUrl(`/reset-password?token=${rawToken}`)}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
