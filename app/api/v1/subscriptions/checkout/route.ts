import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  checkDowngrade,
  countUnitsFor,
  getAccountPlan,
  graceEndsAtFrom,
  listPlans,
  priceFor,
} from '@/lib/plans';

// Server-authoritative pricing -- never trust a client-sent amount for a real charge. The price is
// read from the Plan row the admin edits, plus any units beyond the plan's included ones, worked
// out here at the moment of checkout. A plan that comes to 0 (the free plan) is handled below with
// no Paystack call at all.
const checkoutSchema = z.object({
  planKey: z.string().min(1),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  // Needed to switch to a free plan while a paid period is still running.
  confirmDowngrade: z.boolean().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    if (!subscriptionsEnabled()) {
      return NextResponse.json({ error: 'Subscriptions are not available yet' }, { status: 503 });
    }

    // The company's plan is the managing partner's to change; a team member's work is on it.
    if (session.org && !session.org.isOwner) {
      return NextResponse.json(
        { error: "Only your company's managing partner can change the plan", code: 'NOT_PARTNER' },
        { status: 403 },
      );
    }

    try {
      const validated = await validateBody(req, checkoutSchema);
      if (!validated.success) return validated.response;
      const { planKey, billingCycle = 'monthly', confirmDowngrade } = validated.data;
      const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

      const plan = (await listPlans({ onlyActive: true })).find((p) => p.key === planKey);
      if (!plan) return NextResponse.json({ error: 'That plan is not available' }, { status: 404 });

      const settings = await getSystemSettings();
      const units = await countUnitsFor(settings.unitBillingOwner, session.sub);
      const price = priceFor(plan, cycle, units);
      if (!price) {
        return NextResponse.json(
          { error: `The ${plan.name} plan cannot be paid for by the year` },
          { status: 400 },
        );
      }

      // Moving to a plan that includes less than the account uses follows the admin's rule.
      const current = await getAccountPlan(session.sub);
      let graceDays: number | null = null;
      if (
        plan.unitsIncluded < current.plan.unitsIncluded ||
        plan.usersIncluded < current.plan.usersIncluded
      ) {
        const check = await checkDowngrade(session.sub, plan, settings);
        if (!check.allowed) {
          return NextResponse.json(
            { error: check.message, code: 'DOWNGRADE_BLOCKED', ...check.details },
            { status: 409 },
          );
        }
        graceDays = check.graceDays;
      }

      if (price.total === 0) {
        // Someone who has already paid for the current period keeps it: choosing a free plan ends
        // the paid plan at the end of that period, never straight away, and only after they
        // confirm (ISS-056).
        const row = await prisma.subscription.findUnique({ where: { userId: session.sub } });
        const paidUntil = row?.currentPeriodEnd;
        if (
          row &&
          !current.lapsed &&
          !current.plan.isDefault &&
          row.status === 'ACTIVE' &&
          paidUntil &&
          paidUntil > new Date()
        ) {
          if (!confirmDowngrade) {
            return NextResponse.json(
              {
                error: `You have paid for ${current.plan.name} until ${paidUntil.toISOString().slice(0, 10)}. Switching to ${plan.name} keeps your plan until then and then ends it.`,
                code: 'DOWNGRADE_NEEDS_CONFIRMATION',
                paidUntil,
              },
              { status: 409 },
            );
          }
          const scheduled = await prisma.subscription.update({
            where: { userId: session.sub },
            data: { cancelAtPeriodEnd: true },
          });
          return NextResponse.json(
            {
              data: {
                activated: false,
                scheduled: true,
                endsAt: paidUntil,
                subscription: scheduled,
              },
            },
            { status: 200 },
          );
        }

        // No payment at all -- activate directly.
        const subscription = await prisma.subscription.upsert({
          where: { userId: session.sub },
          create: {
            userId: session.sub,
            planId: plan.id,
            status: 'ACTIVE',
            graceEndsAt: graceEndsAtFrom(graceDays),
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            graceEndsAt: graceEndsAtFrom(graceDays),
          },
        });
        return NextResponse.json({ data: { activated: true, subscription } }, { status: 201 });
      }

      // Plan/cycle have no dedicated Invoice column -- encoded into the description text
      // (matching the codebase's existing convention for fields with no schema home) so the
      // webhook can read them back after Paystack confirms payment, without a schema change or
      // touching /payments/initialize.
      const invoice = await prisma.invoice.create({
        data: {
          userId: session.sub,
          type: 'SUBSCRIPTION',
          amount: price.total,
          dueDate: new Date(),
          description: `Proplity subscription checkout — plan=${plan.key} cycle=${billingCycle}${
            price.extraUnits > 0 ? ` (includes ${price.extraUnits} extra unit(s))` : ''
          }`,
        },
      });

      return NextResponse.json(
        {
          data: {
            invoiceId: invoice.id,
            amount: price.total,
            breakdown: { base: price.base, overage: price.overage, extraUnits: price.extraUnits },
          },
        },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
