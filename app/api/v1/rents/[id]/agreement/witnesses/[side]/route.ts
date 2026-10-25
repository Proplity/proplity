import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { currentAgreement, loadRentForAgreement } from '@/lib/rentAgreement';

type RouteCtx = { params: Promise<{ id: string; side: string }> };

/** Takes back a witness who has not signed yet; the emailed link stops working. */
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id, side: rawSide } = await ctx.params;
    const side = rawSide.toUpperCase();
    if (side !== 'LANDLORD' && side !== 'TENANT') {
      return NextResponse.json({ error: 'Side must be landlord or tenant' }, { status: 400 });
    }
    try {
      const rent = await loadRentForAgreement(id);
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      const isTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
      const isTeam = session.role !== 'TENANT' && canManageProperty(session, rent.unit.property);
      if (!isTenant && !isTeam) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (isTenant && side !== 'TENANT') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const agreement = await currentAgreement(id, tx);
        const witness = agreement
          ? await tx.agreementWitness.findUnique({
              where: { agreementId_side: { agreementId: agreement.id, side } },
            })
          : null;
        if (!witness) return 'NOT_FOUND' as const;
        if (witness.status === 'SIGNED') return 'SIGNED' as const;
        await tx.agreementWitness.delete({ where: { id: witness.id } });
        return 'REMOVED' as const;
      });

      if (outcome === 'NOT_FOUND') {
        return NextResponse.json({ error: 'No witness was asked for that side' }, { status: 404 });
      }
      if (outcome === 'SIGNED') {
        return NextResponse.json(
          { error: 'This witness has already signed', code: 'WITNESS_ALREADY_SIGNED' },
          { status: 409 },
        );
      }
      return NextResponse.json({ data: { side } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
