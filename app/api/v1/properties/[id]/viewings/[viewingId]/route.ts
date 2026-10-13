import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyByEmail, notifyUser } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string; viewingId: string }> };

const patchSchema = z.object({ status: z.enum(['CONFIRMED', 'CANCELLED']) });

// The property team confirms or declines a viewing request; the person who
// asked can cancel their own. Either side is told (ISS-047).
export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id, viewingId } = await ctx.params;

  try {
    const validated = await validateBody(req, patchSchema);
    if (!validated.success) return validated.response;
    const { status } = validated.data;

    const viewing = await prisma.propertyViewing.findFirst({
      where: { id: viewingId, propertyId: id },
      include: { property: true, requestedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!viewing) return NextResponse.json({ error: 'Viewing not found' }, { status: 404 });

    const isTeam = canManageProperty(session, viewing.property);
    const isRequester = viewing.requestedById === session.sub;
    if (!isTeam && !(isRequester && status === 'CANCELLED')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (
      viewing.status !== 'REQUESTED' &&
      !(viewing.status === 'CONFIRMED' && status === 'CANCELLED')
    ) {
      return NextResponse.json(
        { error: `This viewing is already ${viewing.status.toLowerCase()}` },
        { status: 409 },
      );
    }

    const updated = await prisma.propertyViewing.update({
      where: { id: viewing.id },
      data: { status },
    });

    const when = viewing.scheduledAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const name = viewing.property.name;

    if (isTeam) {
      const confirmed = status === 'CONFIRMED';
      await notifyUser(viewing.requestedById, {
        type: 'SYSTEM',
        title: confirmed ? 'Viewing confirmed' : 'Viewing declined',
        body: confirmed
          ? `Your viewing of ${name} on ${when} is confirmed.`
          : `Your viewing request for ${name} on ${when} could not be accommodated. Please pick another time.`,
        link: `/dashboard/properties/${viewing.propertyId}`,
      });
      await notifyByEmail(
        viewing.requestedBy.email,
        confirmed ? `Viewing confirmed: ${name}` : `Viewing request update: ${name}`,
        confirmed
          ? `Hi ${viewing.requestedBy.name},\n\nYour viewing of "${name}" (${viewing.property.address}) is confirmed for ${when}.\n\nPlease arrive a few minutes early and bring a valid ID.`
          : `Hi ${viewing.requestedBy.name},\n\nSorry, the property team could not accommodate your viewing of "${name}" on ${when}. Please book another time.`,
      );
    } else {
      const team = [viewing.property.managerId, viewing.property.landlordId].filter(
        (uid): uid is string => !!uid,
      );
      for (const uid of new Set(team)) {
        await notifyUser(uid, {
          type: 'SYSTEM',
          title: 'Viewing cancelled',
          body: `${viewing.requestedBy.name} cancelled their viewing of ${name} on ${when}.`,
          link: `/dashboard/properties/${viewing.propertyId}`,
        });
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});
