import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/auth/csrf';
import { getClientIp, reserveAttempt } from '@/lib/auth/rateLimit';
import { validateBody } from '@/lib/api/validate';
import { buildContactEmail, contactRecipient, contactSchema, messageWentOut } from '@/lib/contact';
import { sendEmail } from '@/lib/email';

// Five messages an hour from one address is far more than a person sends, and little enough that
// the form cannot be used to flood the team's inbox.
const MAX_MESSAGES = 5;
const WINDOW_MS = 60 * 60 * 1000;

// The contact page's form. Public, so: same-origin only, rate limited per client IP, a honeypot
// field for bots, and it only says "sent" when the email really went out (ISS-133: the form used
// to show "Message sent!" without sending anything).
export async function POST(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const { allowed } = await reserveAttempt(
    `contact:${getClientIp(req)}`,
    undefined,
    MAX_MESSAGES,
    WINDOW_MS,
  );
  if (!allowed) {
    return NextResponse.json({ error: 'Too many messages. Try again later.' }, { status: 429 });
  }

  const validated = await validateBody(req, contactSchema);
  if (!validated.success) return validated.response;
  const input = validated.data;

  // A bot filled in the field a person cannot see: answer as if it worked, send nothing.
  if (input.website) return NextResponse.json({ success: true });

  const to = contactRecipient();
  if (!to) {
    return NextResponse.json(
      { error: 'Messages cannot be sent from this page right now.' },
      { status: 503 },
    );
  }

  const { subject, body } = buildContactEmail(input);
  const { delivered } = await sendEmail({ to, subject, body, replyTo: input.email });

  // Refuse rather than claim success when the message did not really go out.
  const wentOut = messageWentOut({
    delivered,
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    production: process.env.NODE_ENV === 'production',
  });
  if (!wentOut) {
    return NextResponse.json(
      { error: "We couldn't send your message. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
