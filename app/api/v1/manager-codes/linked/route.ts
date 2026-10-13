import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

// The landlords this manager has linked to (one row per redeemed code).
// Deactivated codes are listed too, flagged, so a revoked link is visible.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const codes = await prisma.managerInviteCode.findMany({
        where: { linkedManagerId: session.sub },
        include: { landlord: { select: { id: true, name: true } } },
        orderBy: { linkedAt: 'desc' },
      });
      return NextResponse.json({
        data: codes.map((c) => ({
          codeId: c.id,
          landlord: c.landlord,
          linkedAt: c.linkedAt,
          active: c.status === 'ACTIVE',
        })),
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
