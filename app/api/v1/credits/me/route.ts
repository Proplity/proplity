import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { creditBalance } from '@/lib/credits';
import { billingAccountOf } from '@/lib/team';

// The account's credit balance and its latest movements.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const balance = await creditBalance(session.sub);
      const entries = await prisma.creditEntry.findMany({
        where: { userId: await billingAccountOf(session.sub) },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          delta: true,
          reason: true,
          serviceKey: true,
          note: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ data: { balance, entries } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
