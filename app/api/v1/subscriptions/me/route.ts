import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

export const GET = withAuth(async (_req, { session }) => {
  try {
    let subscription = await prisma.subscription.findUnique({ where: { userId: session.sub } });
    // A plan set to end with its paid period reverts to FREE once that period is over.
    if (
      subscription &&
      subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= new Date()
    ) {
      subscription = await prisma.subscription.update({
        where: { userId: session.sub },
        data: {
          tier: 'FREE',
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      });
    }
    // No row yet = never subscribed -- represented as a real FREE tier
    // rather than null, so the frontend has one shape to render either way.
    return NextResponse.json({
      data: subscription ?? {
        userId: session.sub,
        tier: 'FREE',
        status: 'ACTIVE',
        currentPeriodEnd: null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
