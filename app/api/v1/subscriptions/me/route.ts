import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  getAccountPlan,
  getDefaultPlan,
  getUsage,
  countUnitsFor,
  graceEndsAtFrom,
} from '@/lib/plans';
import { creditBalance } from '@/lib/credits';

// The signed-in account's plan, what it is using against that plan, and its credits.
export const GET = withAuth(async (_req, { session }) => {
  try {
    const settings = await getSystemSettings();

    // A plan set to end with its paid period goes back to the default plan once that period is over.
    const existing = await prisma.subscription.findUnique({ where: { userId: session.sub } });
    if (
      existing &&
      existing.cancelAtPeriodEnd &&
      existing.currentPeriodEnd &&
      existing.currentPeriodEnd <= new Date()
    ) {
      const fallback = await getDefaultPlan();
      const units = await countUnitsFor(settings.unitBillingOwner, session.sub);
      const grace =
        settings.enforcePlanLimits &&
        settings.downgradeRule === 'GRACE_PERIOD' &&
        units > fallback.unitsIncluded
          ? graceEndsAtFrom(settings.downgradeGraceDays)
          : null;
      await prisma.subscription.update({
        where: { userId: session.sub },
        data: {
          planId: fallback.id,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          graceEndsAt: grace,
        },
      });
    }

    const { plan, subscription, lapsed } = await getAccountPlan(session.sub);
    const [usage, credits] = await Promise.all([
      getUsage(session.sub, settings),
      creditBalance(session.sub),
    ]);

    return NextResponse.json({
      data: {
        userId: session.sub,
        status: subscription?.status ?? 'ACTIVE',
        billingCycle: subscription?.billingCycle ?? 'MONTHLY',
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        graceEndsAt: subscription?.graceEndsAt ?? null,
        lapsed,
        plan,
        usage,
        credits: { balance: credits },
        limitsEnforced: settings.enforcePlanLimits,
        // A team member works on the managing partner's plan and cannot change it.
        canChangePlan: !session.org || session.org.isOwner,
        company: session.org ? { isPartner: session.org.isOwner } : null,
        subscriptionsEnabled: subscriptionsEnabled(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
