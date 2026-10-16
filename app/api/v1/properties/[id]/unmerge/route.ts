import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/properties/[id]/unmerge
 * Undoes a previous merge on a property.
 * Restricted to ADMIN role.
 */
export const POST = withAuth(
  async (_req: NextRequest, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const source = await prisma.property.findUnique({
        where: { id },
        include: { mergedInto: { select: { id: true, name: true } } },
      });

      if (!source) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      if (!source.mergedIntoId) {
        return NextResponse.json(
          { error: 'This property is not currently merged' },
          { status: 400 },
        );
      }

      const previousTargetName = source.mergedInto?.name ?? source.mergedIntoId;

      const updated = await prisma.$transaction(async (tx) => {
        const note = `[${new Date().toISOString()}] Merge undone by admin.`;
        const restored = await tx.property.update({
          where: { id },
          data: {
            mergedIntoId: null,
            isPublished: false,
            moderationStatus: 'PENDING_REVIEW',
            moderationNotes: source.moderationNotes ? `${source.moderationNotes}\n${note}` : note,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'PROPERTY_UNMERGE',
            entityType: 'Property',
            entityId: id,
            metadata: {
              previousMergedIntoId: source.mergedIntoId,
              previousTargetName,
            },
          },
        });

        return restored;
      });

      return NextResponse.json({
        data: updated,
        message: 'Property merge has been undone; listing returned to pending review',
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
