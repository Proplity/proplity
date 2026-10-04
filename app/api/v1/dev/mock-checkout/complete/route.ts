import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appUrl } from '@/lib/appUrl';
import {
  buildMockChargePayload,
  paymentsMockEnabled,
  signMockPayload,
} from '@/lib/payments/mockGateway';

const completeSchema = z.object({
  reference: z.string(),
  invoiceId: z.string(),
  amountKobo: z.number().int().positive(),
  email: z.string().email(),
  outcome: z.enum(['success', 'failed']),
});

// Stands in for Paystack's own servers: builds a charge.success/charge.failed
// payload shaped like a real one (see mockGateway.ts), signs it with the
// mock secret, and calls OUR OWN /api/v1/payments/webhook over HTTP exactly
// the way Paystack would -- so the real webhook handler (Payment row,
// invoice status, notifications, subscription activation) is what actually
// runs, not a shortcut that skips it. No session check here: neither does
// the real webhook (its HMAC signature IS the security boundary), and this
// route is reachable at all only when there's no real Paystack key and the
// mock is explicitly turned on.
export async function POST(req: NextRequest) {
  // Same belt-and-suspenders gate as initialize/webhook: never reachable
  // with a real key configured, even if the mock flag was left on.
  if (!paymentsMockEnabled() || process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const payload = buildMockChargePayload(parsed.data);
  const rawBody = JSON.stringify(payload);
  const signature = signMockPayload(rawBody);

  const webhookRes = await fetch(appUrl('/api/v1/payments/webhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: rawBody,
  });

  if (!webhookRes.ok) {
    const detail = await webhookRes.text().catch(() => '');
    return NextResponse.json(
      { error: 'Mock webhook delivery failed', details: detail },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
