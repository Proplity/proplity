import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { subscriptionsEnabled } from '@/lib/subscriptions';

// Server-authoritative pricing -- never trust a client-sent amount for a
// real charge. Mirrors PricingPage.tsx's PLANS: 'starter' is free (handled
// below with no Paystack call at all), 'professional' -> PRO, 'enterprise'
// is custom/sales-assisted and never reaches self-serve checkout, same as
// today's onGetStarted-instead-of-onSelectPlan behavior.
const PRO_PRICING = { monthly: 29_999, annual: 23_999 * 12 };

const checkoutSchema = z.object({
  tier: z.enum(['FREE', 'PRO']),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    if (!subscriptionsEnabled()) {
      return NextResponse.json({ error: 'Subscriptions are not available yet' }, { status: 503 });
    }

    try {
      const validated = await validateBody(req, checkoutSchema);
      if (!validated.success) return validated.response;
      const { tier, billingCycle = 'monthly' } = validated.data;

      if (tier === 'FREE') {
        // No payment at all -- activate directly.
        const subscription = await prisma.subscription.upsert({
          where: { userId: session.sub },
          create: { userId: session.sub, tier: 'FREE', status: 'ACTIVE' },
          update: { tier: 'FREE', status: 'ACTIVE', currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
        });
        return NextResponse.json({ data: { activated: true, subscription } }, { status: 201 });
      }

      const amount = billingCycle === 'yearly' ? PRO_PRICING.annual : PRO_PRICING.monthly;

      // Tier/cycle have no dedicated Invoice column -- encoded into the
      // description text (matching the codebase's existing convention for
      // fields with no schema home, e.g. MaintenanceRequestForm's location
      // note) so the webhook can read them back after Paystack confirms
      // payment, without a schema change or touching /payments/initialize.
      const invoice = await prisma.invoice.create({
        data: {
          userId: session.sub,
          type: 'SUBSCRIPTION',
          amount,
          dueDate: new Date(),
          description: `Proplity subscription checkout — tier=${tier} cycle=${billingCycle}`,
        },
      });

      return NextResponse.json({ data: { invoiceId: invoice.id, amount } }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
