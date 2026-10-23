import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

const mergeSchema = z.object({
  targetPropertyId: z.string().min(1, 'Target property ID is required'),
});

/**
 * POST /api/v1/properties/[id]/merge
 * Merges a duplicate property into a canonical target property.
 * Restricted to ADMIN role (PRD §6.2.4).
 */
export const POST = withAuth(
  async (req: NextRequest, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const validated = await validateBody(req, mergeSchema);
      if (!validated.success) return validated.response;

      const { targetPropertyId } = validated.data;
      if (id === targetPropertyId) {
        return NextResponse.json({ error: 'Cannot merge a property into itself' }, { status: 400 });
      }

      const [source, target] = await Promise.all([
        prisma.property.findUnique({
          where: { id },
          include: {
            _count: { select: { mergedFrom: true } },
            units: {
              select: { id: true, rents: { where: { status: 'ACTIVE' }, select: { id: true } } },
            },
          },
        }),
        prisma.property.findUnique({ where: { id: targetPropertyId } }),
      ]);

      if (!source) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      if (!target) {
        return NextResponse.json({ error: 'Target property not found' }, { status: 404 });
      }

      if (source.mergedIntoId) {
        return NextResponse.json(
          { error: 'This property has already been merged into another listing' },
          { status: 400 },
        );
      }

      // A listing that other listings were merged into cannot itself be merged away:
      // that would leave those pointing at a merged listing (a chain).
      if (source._count.mergedFrom > 0) {
        return NextResponse.json(
          {
            error:
              'Other listings were merged into this one. Undo those merges first, or merge into this listing instead.',
          },
          { status: 400 },
        );
      }

      // Merging rejects and unpublishes the source; units and rents are not moved, so a
      // listing with live tenancies must not be merged away.
      if (source.units.some((u) => u.rents.length > 0)) {
        return NextResponse.json(
          { error: 'This listing has active rents and cannot be merged' },
          { status: 400 },
        );
      }

      if (target.mergedIntoId) {
        return NextResponse.json(
          { error: 'Cannot merge into a property that is itself already merged' },
          { status: 400 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const note = `[${new Date().toISOString()}] Merged into "${target.name}" (${target.id}) by admin.`;
        const updatedSource = await tx.property.update({
          where: { id },
          data: {
            mergedIntoId: target.id,
            isPublished: false,
            moderationStatus: 'REJECTED',
            moderationNotes: source.moderationNotes ? `${source.moderationNotes}\n${note}` : note,
          },
          include: {
            mergedInto: { select: { id: true, name: true, address: true, city: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'PROPERTY_MERGE',
            entityType: 'Property',
            entityId: id,
            metadata: {
              targetPropertyId: target.id,
              targetPropertyName: target.name,
              sourcePropertyName: source.name,
            },
          },
        });

        return updatedSource;
      });

      return NextResponse.json({
        data: updated,
        message: `Property successfully merged into "${target.name}"`,
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

/**
 * DELETE /api/v1/properties/[id]/merge
 * Undoes a previous merge on a property.
 * Restricted to ADMIN role.
 */
export const DELETE = withAuth(
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
