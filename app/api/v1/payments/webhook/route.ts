import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api/errors';

// Reached by Paystack's own servers, not a browser -- no session, no CSRF.
// The HMAC signature over the raw body IS the security boundary here, so it
// must be verified before the body is parsed or trusted in any way.
function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const sigBuf = new Uint8Array(Buffer.from(signature, 'hex'));
  const expBuf = new Uint8Array(Buffer.from(expected, 'hex'));
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

// Rough channel -> PaymentMethod mapping; Paystack's `channel` values don't
// line up 1:1 with the schema's enum (no way to distinguish credit vs.
// debit card from the webhook payload), so this is a best-effort default.
function mapPaymentMethod(channel: string | undefined): PaymentMethod {
  if (channel === 'card') return 'CREDIT_CARD';
  if (channel === 'bank' || channel === 'bank_transfer' || channel === 'ussd') return 'BANK_TRANSFER';
  return 'BANK_TRANSFER';
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    if (!verifySignature(rawBody, signature, secretKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === 'charge.success') {
      const data = payload.data;
      const invoiceId: string | undefined = data?.metadata?.invoiceId;
      if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId in metadata' }, { status: 400 });

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      // Paystack can redeliver the same event -- guard against double-
      // crediting by treating an existing Payment for this reference as
      // already handled rather than creating a second one.
      const existing = data.reference
        ? await prisma.payment.findFirst({ where: { transactionRef: data.reference } })
        : null;

      if (!existing) {
        await prisma.$transaction([
          prisma.payment.create({
            data: {
              invoiceId,
              amount: data.amount / 100,
              paymentMethod: mapPaymentMethod(data.channel),
              provider: 'PAYSTACK',
              transactionRef: data.reference,
              rawProviderPayload: rawBody,
              paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
            },
          }),
          prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID' } }),
        ]);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return handleApiError(err);
  }
}
