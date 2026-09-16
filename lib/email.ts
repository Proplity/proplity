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
export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logToConsole(to, subject, body);
    return;
  }

  const from = process.env.EMAIL_FROM || 'Proplity <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text: body }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[EMAIL_SEND_ERROR] Resend returned ${res.status}: ${detail}`);
      logToConsole(to, subject, body);
    }
  } catch (err) {
    console.error('[EMAIL_SEND_ERROR]', err);
    logToConsole(to, subject, body);
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
