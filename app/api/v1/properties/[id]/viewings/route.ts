import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyByEmail, notifyUsers } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const canSeeAll = canManageProperty(session, property);
    const viewings = await prisma.propertyViewing.findMany({
      where: { propertyId: id, ...(canSeeAll ? {} : { requestedById: session.sub }) },
      include: canSeeAll ? { requestedBy: { select: { name: true, email: true } } } : undefined,
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ data: viewings });
  } catch (err) {
    return handleApiError(err);
  }
});

const createViewingSchema = z.object({
  scheduledAt: z.coerce.date(),
  unitId: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const validated = await validateBody(req, createViewingSchema);
    if (!validated.success) return validated.response;
    const { scheduledAt, unitId, notes } = validated.data;

    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Choose a viewing time in the future', code: 'PAST_DATE' },
        { status: 400 },
      );
    }

    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const duplicate = await prisma.propertyViewing.findFirst({
      where: {
        propertyId: id,
        requestedById: session.sub,
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'A viewing is already booked for this property on this day',
          code: 'DUPLICATE_BOOKING',
        },
        { status: 409 },
      );
    }

    const viewing = await prisma.propertyViewing.create({
      data: { propertyId: id, unitId, requestedById: session.sub, scheduledAt, notes },
    });

    // A viewing is a request until the property team confirms it (ISS-047).
    // The requester is told it was received; the manager and landlord are
    // told something is waiting.
    const [requester, property] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.sub } }),
      prisma.property.findUnique({ where: { id } }),
    ]);
    if (requester && property) {
      const when = scheduledAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
      await notifyByEmail(
        requester.email,
        `Viewing requested: ${property.name}`,
        `Hi ${requester.name},\n\nWe received your request to view "${property.name}" (${property.address}) on ${when}. The property team will confirm it shortly and you will get another email.${
          notes ? `\n\nYour notes: ${notes}` : ''
        }`,
      );
      const reviewers = [property.managerId, property.landlordId].filter(
        (rid): rid is string => !!rid && rid !== session.sub,
      );
      await notifyUsers([...new Set(reviewers)], {
        type: 'SYSTEM',
        title: 'New viewing request',
        body: `${requester.name} asked to view ${property.name} on ${when}.`,
        link: `/dashboard/properties/${property.id}`,
      });
    }

    return NextResponse.json({ data: viewing }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
