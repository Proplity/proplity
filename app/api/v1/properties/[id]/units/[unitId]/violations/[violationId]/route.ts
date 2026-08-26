import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ViolationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; unitId: string; violationId: string }> };

const patchSchema = z.object({
  status: z.nativeEnum(ViolationStatus),
  resolutionNote: z.string().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id, unitId, violationId } = await ctx.params;
    try {
      const violation = await prisma.violation.findUnique({ where: { id: violationId } });
      if (!violation || violation.unitId !== unitId) {
        return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
      }
      const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { property: true } });
      if (!unit || unit.propertyId !== id) return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
      if (!canManageProperty(session, unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const { status, resolutionNote } = validated.data;

      const updated = await prisma.violation.update({
        where: { id: violationId },
        data: {
          status,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
          ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
