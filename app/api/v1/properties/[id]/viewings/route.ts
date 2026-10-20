import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyByEmail, notifyUsers } from '@/lib/notifications';
import {
  VIEWING_HOLDING_STATUSES,
  formatViewingTime,
  viewingDateKey,
  viewingDayBounds,
  viewingTimeProblem,
} from '@/lib/viewingSlots';

// Lists are capped so one busy record cannot return an unbounded response (ISS-073).
const LIST_LIMIT = 500;

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const canSeeAll = canManageProperty(session, property);
    const viewings = await prisma.propertyViewing.findMany({
      take: LIST_LIMIT,
      where: { propertyId: id, ...(canSeeAll ? {} : { requestedById: session.sub }) },
      include: canSeeAll
        ? {
            requestedBy: {
              select: {
                name: true,
                email: true,
                phoneNumber: true,
                createdAt: true,
                kycStatus: true,
                idDocumentUrl: true,
              },
            },
          }
        : undefined,
      orderBy: { scheduledAt: 'asc' },
    });

    // The property team gets a short profile of who is coming (contact, ID on
    // file, account age). The ID document link itself stays out of this list.
    const data = viewings.map((v) => {
      const visitor =
        'requestedBy' in v ? (v.requestedBy as { idDocumentUrl?: string | null }) : null;
      if (!visitor) return v;
      const { idDocumentUrl, ...rest } = visitor;
      return { ...v, requestedBy: { ...rest, hasIdOnFile: !!idDocumentUrl } };
    });

    return NextResponse.json({ data });
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

    const outOfHours = viewingTimeProblem(scheduledAt);
    if (outOfHours) {
      return NextResponse.json(
        { error: outOfHours, code: 'OUTSIDE_VIEWING_HOURS' },
        { status: 400 },
      );
    }

    // One live booking per property and start time (ISS-104), and one per person per day. Bookings
    // for the same property and day queue on a lock, so two people choosing the same time at once
    // cannot both get it.
    const day = viewingDayBounds(viewingDateKey(scheduledAt));
    const outcome = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`viewing:${id}:${day.start.toISOString()}`}))`;

        const duplicate = await tx.propertyViewing.findFirst({
          where: {
            propertyId: id,
            requestedById: session.sub,
            status: { in: [...VIEWING_HOLDING_STATUSES] },
            scheduledAt: { gte: day.start, lt: day.end },
          },
          select: { id: true },
        });
        if (duplicate) return { problem: 'DUPLICATE_BOOKING' as const };

        const taken = await tx.propertyViewing.findFirst({
          where: { propertyId: id, scheduledAt, status: { in: [...VIEWING_HOLDING_STATUSES] } },
          select: { id: true },
        });
        if (taken) return { problem: 'SLOT_TAKEN' as const };

        const created = await tx.propertyViewing.create({
          data: { propertyId: id, unitId, requestedById: session.sub, scheduledAt, notes },
        });
        return { viewing: created };
      },
      { timeout: 20_000, maxWait: 20_000 },
    );

    if ('problem' in outcome) {
      return outcome.problem === 'SLOT_TAKEN'
        ? NextResponse.json(
            {
              error:
                'That time is already booked for this property. Please choose another time or day.',
              code: 'SLOT_TAKEN',
            },
            { status: 409 },
          )
        : NextResponse.json(
            {
              error: 'A viewing is already booked for this property on this day',
              code: 'DUPLICATE_BOOKING',
            },
            { status: 409 },
          );
    }
    const viewing = outcome.viewing;

    // A viewing is a request until the property team confirms it (ISS-047).
    // The requester is told it was received; the manager and landlord are
    // told something is waiting.
    const [requester, property] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.sub } }),
      prisma.property.findUnique({ where: { id } }),
    ]);
    if (requester && property) {
      const when = `${formatViewingTime(scheduledAt, 'full')} (Lagos time)`;
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
