import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { cardPaymentsAvailable } from '@/lib/payments/availability';

// Whether card payments can be started, so a screen can say "not available yet" instead of
// offering a button that can only fail (ISS-010). Any signed-in person; the answer is not secret.
export const GET = withAuth(async () => {
  return NextResponse.json({ data: { card: cardPaymentsAvailable() } });
});
