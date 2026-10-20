import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { VIEWING_HOLDING_STATUSES, viewingDayBounds, viewingTimeKey } from '@/lib/viewingSlots';

type RouteCtx = { params: Promise<{ id: string }> };

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// The start times already booked on a day, so the booking form can grey them out (ISS-104).
// Only the times are returned, never who booked them. `date` is a Lagos calendar day.
export const GET = withAuth(async (req, _auth, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const parsed = querySchema.safeParse({ date: new URL(req.url).searchParams.get('date') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const { date } = parsed.data;
  if (Number.isNaN(viewingDayBounds(date).start.getTime())) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const property = await prisma.property.findUnique({ where: { id }, select: { id: true } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const { start, end } = viewingDayBounds(date);
    const booked = await prisma.propertyViewing.findMany({
      where: {
        propertyId: id,
        scheduledAt: { gte: start, lt: end },
        status: { in: [...VIEWING_HOLDING_STATUSES] },
      },
      select: { scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    });
    const taken = [...new Set(booked.map((v) => viewingTimeKey(v.scheduledAt)))];

    return NextResponse.json({ data: { date, taken } });
  } catch (err) {
    return handleApiError(err);
  }
});
