import crypto from 'crypto';

// Off by default, same pattern as subscriptionsEnabled()/setupRedirectEnabled()
// -- a real deployment never sets this. It gates both whether sendEmail()
// below keeps anything in memory and whether GET/DELETE
// /api/v1/dev/emails will serve it, so a stray env var typo can't leak
// email bodies (which include live verification/reset tokens) on a real
// deployment.
export function emailInboxEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_EMAIL_INBOX_ENABLED !== 'true') return false;
  // The inbox shows live reset and verification links to anyone who can reach it, so in a
  // production build it needs a second, deliberate switch (ISS-071).
  if (process.env.NODE_ENV === 'production') {
    return process.env.EMAIL_INBOX_ALLOW_IN_PRODUCTION === 'true';
  }
  return true;
}

export type SentEmailRecord = {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
};

// In-memory only -- this is a manual-testing convenience, not a mailbox.
// Resets on every server restart, and (like console-transport itself) isn't
// safe for multi-instance deployments; local/staging single-process use only.
const MAX_RECORDS = 50;
const sentEmails: SentEmailRecord[] = [];

export function getRecentEmails(): SentEmailRecord[] {
  return sentEmails;
}

export function clearRecentEmails() {
  sentEmails.length = 0;
}

function recordEmail(to: string, subject: string, body: string) {
  if (!emailInboxEnabled()) return;
  sentEmails.unshift({
    id: crypto.randomUUID(),
    to,
    subject,
    body,
    sentAt: new Date().toISOString(),
  });
  sentEmails.length = Math.min(sentEmails.length, MAX_RECORDS);
}

// Sends real email via Resend when RESEND_API_KEY is configured; falls back
// to console-transport (logs instead of delivering) otherwise. Gated on the
// key's presence, not NODE_ENV -- a production deploy without the key set
// yet should keep working (logging instead of silently doing nothing), the
// same reasoning as this codebase's other key-gated features
// (subscriptionsEnabled(), SETUP_TOKEN).
//
// Never throws: every caller here awaits this without a try/catch, so a
// transient email-provider failure must not fail the request that
// triggered it (registration, password reset, etc). Errors are logged and
// swallowed, matching lib/notifications.ts's same convention.
//
// It does say what happened: `delivered` is true only when Resend accepted the message. Most
// callers ignore it; the contact form uses it so that a visitor is never told "sent" when the
// message only went to the console (no RESEND_API_KEY) or the provider refused it.
// `replyTo` lets the team answer a visitor's message by replying to the email.
export async function sendEmail({
  to,
  subject,
  body,
  replyTo,
}: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<{ delivered: boolean }> {
  recordEmail(to, subject, body);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logToConsole(to, subject, body);
    return { delivered: false };
  }

  const from = process.env.EMAIL_FROM || 'Proplity <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: body,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[EMAIL_SEND_ERROR] Resend returned ${res.status}: ${detail}`);
      logToConsole(to, subject, body);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[EMAIL_SEND_ERROR]', err);
    logToConsole(to, subject, body);
    return { delivered: false };
  }
}

function logToConsole(to: string, subject: string, body: string) {
  console.log('\n===== EMAIL (console transport) =====');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('---');
  console.log(body);
  console.log('=======================================\n');
}
