import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

// Auto-pay (PRD §5.1/§5.2) needs a provider-side, reusable charge token, but
// there's no card-entry UI anywhere in this codebase and building one is a
// PCI-scope decision, not a UI wiring task. Paystack already hands us one
// for free: a `charge.success` webhook's `data.authorization` includes a
// reusable `authorization_code` whenever the customer paid by card and their
// bank allows repeat charges -- see payments/webhook/route.ts, which stores
// the full webhook body verbatim in Payment.rawProviderPayload. This reads
// the tenant's own most recent such payment back out and surfaces just the
// derived token, never the raw payload (which also carries the customer's
// email/phone as Paystack sent them).
export const GET = withAuth(
  async (req, { session }) => {
    try {
      const leaseId = req.nextUrl.searchParams.get('leaseId');
      if (!leaseId) {
        return NextResponse.json({ error: 'leaseId query param is required' }, { status: 400 });
      }

      const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
      if (lease.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const payments = await prisma.payment.findMany({
        where: { invoice: { leaseId }, provider: 'PAYSTACK', rawProviderPayload: { not: null } },
        orderBy: { paidAt: 'desc' },
        take: 10,
      });

      for (const payment of payments) {
        try {
          const payload = JSON.parse(payment.rawProviderPayload!);
          const auth = payload?.data?.authorization;
          if (auth?.reusable && typeof auth.authorization_code === 'string') {
            return NextResponse.json({
              data: {
                authorizationCode: auth.authorization_code as string,
                last4: (auth.last4 as string | undefined) ?? null,
                cardType: (auth.card_type as string | undefined) ?? null,
                bank: (auth.bank as string | undefined) ?? null,
              },
            });
          }
        } catch {
          // Malformed/legacy payload for this one payment -- try the next.
        }
      }

      return NextResponse.json({ data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
