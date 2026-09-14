import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  isRead: z.boolean(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.recipientId !== session.sub) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const validated = await validateBody(req, patchSchema);
    if (!validated.success) return validated.response;

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: validated.data.isRead },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.recipientId !== session.sub) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ data: { id } });
  } catch (err) {
    return handleApiError(err);
  }
});
