import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

function loadAccessCode(id: string) {
  return prisma.accessCode.findUnique({
    where: { id },
    include: { unit: { include: { property: true } }, logs: { orderBy: { occurredAt: 'desc' } } },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const accessCode = await loadAccessCode(id);
    if (!accessCode) return NextResponse.json({ error: 'Access code not found' }, { status: 404 });

    const isCreator = accessCode.createdById === session.sub;
    if (!isCreator && !canManageProperty(session, accessCode.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: accessCode });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const accessCode = await loadAccessCode(id);
    if (!accessCode) return NextResponse.json({ error: 'Access code not found' }, { status: 404 });

    const isCreator = accessCode.createdById === session.sub;
    if (!isCreator && !canManageProperty(session, accessCode.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-revoke only (rule 1) -- AccessLog.accessCode is onDelete: Cascade,
    // a hard delete here would wipe the unit's entire access audit trail.
    const revoked = await prisma.accessCode.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return NextResponse.json({ data: revoked });
  } catch (err) {
    return handleApiError(err);
  }
});
