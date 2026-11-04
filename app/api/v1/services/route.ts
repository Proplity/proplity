import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { ensureDefaultServices } from '@/lib/plans';

// The extras a manager or landlord can pay for in credits, with what each costs.
export const GET = withAuth(
  async () => {
    try {
      await ensureDefaultServices();
      const data = await prisma.paidService.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { key: true, name: true, description: true, creditCost: true },
      });
      return NextResponse.json({ data });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD', 'ADMIN'] },
);
