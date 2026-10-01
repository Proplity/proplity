import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';

// Read side of the AuditLog model (prisma/schema/audit.prisma) -- the model
// existed with a single writer (setup/route.ts's FIRST_RUN_SETUP entry) but
// no way for an admin to ever see it. This is that: the "Security" tile on
// AdminDashboard was a dead alert() with nothing behind it at all.
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);
      const entityType = searchParams.get('entityType');

      const where = entityType ? { entityType } : {};

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return NextResponse.json({ data: logs, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
