import { NextResponse } from 'next/server';
import { clearRecentEmails, emailInboxEnabled, getRecentEmails } from '@/lib/email';

// Backs the floating "sent emails" testing widget (see
// app/components/dev/EmailInboxWidget.tsx). Both handlers 404 when the
// NEXT_PUBLIC_EMAIL_INBOX_ENABLED flag is off -- which it is by default --
// so this never exposes anything on a real deployment. Deliberately
// unauthenticated when the flag *is* on: it's meant to let a tester read a
// verification/reset link without needing to be logged in as anyone yet,
// which is exactly the situation those links exist for.
export async function GET() {
  if (!emailInboxEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: getRecentEmails() });
}

export async function DELETE() {
  if (!emailInboxEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  clearRecentEmails();
  return NextResponse.json({ success: true });
}
