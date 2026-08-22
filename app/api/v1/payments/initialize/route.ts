import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

const initializeSchema = z.object({ invoiceId: z.string() });

// NOTE: the plan calls for "a pending Payment row" here, but Payment has no
// status field and a required, defaulted `paidAt` -- the schema models a
// completed payment, not a pending one. Writing a Payment row now would mean
// a paidAt timestamp for money that hasn't moved yet. Instead: no DB write
// here at all. Paystack echoes back `metadata.invoiceId` on the webhook
// callback, which is enough to create the real Payment row (with a true
// paidAt) only once charge.success actually fires -- see payments/webhook.
export const POST = withAuth(async (req, { session }) => {
  try {
    const validated = await validateBody(req, initializeSchema);
    if (!validated.success) return validated.response;

    const invoice = await prisma.invoice.findUnique({
      where: { id: validated.data.invoiceId },
      include: { lease: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const isPayer = invoice.userId === session.sub || invoice.lease?.tenantId === session.sub;
    if (!isPayer && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    const reference = `PROP-${invoice.id.slice(0, 8)}-${Date.now()}`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Paystack amounts are in kobo (smallest currency unit).
        email: user!.email,
        amount: Math.round(invoice.amount * 100),
        reference,
        metadata: { invoiceId: invoice.id },
      }),
    });
    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      return NextResponse.json(
        { error: 'Failed to initialize payment with provider', details: paystackData },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { data: { authorizationUrl: paystackData.data.authorization_url, reference } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
});
