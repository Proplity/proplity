import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parseCursorPagination, buildCursorMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';

// unreadCount is returned on every page, not just the first -- the bell
// dropdown polls this same endpoint (small limit, no cursor) purely for the
// badge count and the newest few rows, so it needs the count without a
// second round trip.
export const GET = withAuth(async (req, { session }) => {
  try {
    const { take, cursor } = parseCursorPagination(req.nextUrl.searchParams);

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: session.sub },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { recipientId: session.sub, isRead: false } }),
    ]);

    const { page, meta } = buildCursorMeta(rows, take);
    return NextResponse.json({ data: page, meta: { ...meta, unreadCount } });
  } catch (err) {
    return handleApiError(err);
  }
});
