import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { moveStaffInPropertyThreads } from '@/lib/conversationAccess';

type RouteCtx = { params: Promise<{ id: string }> };

// Taking someone out of the company: the properties they manage go back to the managing partner
// (so nothing is left without a manager), their message threads follow, and their account stays,
// on its own with nothing in it.
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      if (!session.org?.isOwner) {
        return NextResponse.json(
          { error: 'Only the managing partner can remove people from the company' },
          { status: 403 },
        );
      }
      if (id === session.sub) {
        return NextResponse.json(
          { error: 'The managing partner cannot be removed from their own company' },
          { status: 400 },
        );
      }
      if (!session.org.memberIds.includes(id)) {
        return NextResponse.json({ error: 'That person is not in your company' }, { status: 404 });
      }
      const orgId = session.org.id;

      const reassigned = await prisma.$transaction(async (tx) => {
        const properties = await tx.property.findMany({
          where: { managerId: id },
          select: { id: true, name: true, landlordId: true },
        });
        for (const p of properties) {
          await tx.property.update({ where: { id: p.id }, data: { managerId: session.sub } });
          await tx.auditLog.create({
            data: {
              actorId: session.sub,
              action: 'PROPERTY_TRANSFERRED',
              entityType: 'Property',
              entityId: p.id,
              metadata: {
                propertyName: p.name,
                reason: 'Team member removed from the company',
                manager: { from: id, to: session.sub },
              } as object,
            },
          });
          await moveStaffInPropertyThreads(tx, {
            propertyId: p.id,
            removed: [id],
            added: [session.sub],
            current: [session.sub, p.landlordId],
          });
        }
        await tx.user.update({ where: { id }, data: { organisationId: null } });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'TEAM_MEMBER_REMOVED',
            entityType: 'User',
            entityId: id,
            metadata: { organisationId: orgId, propertiesReassigned: properties.length } as object,
          },
        });
        return properties.length;
      });

      return NextResponse.json({ data: { id, propertiesReassigned: reassigned } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
