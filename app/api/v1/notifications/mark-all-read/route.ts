import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

export const POST = withAuth(async (_req, { session }) => {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { recipientId: session.sub, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ data: { updated: count } });
  } catch (err) {
    return handleApiError(err);
  }
});
