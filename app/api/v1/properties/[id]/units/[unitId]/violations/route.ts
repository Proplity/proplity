import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ViolationSeverity } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { tellUnitTenant } from '@/lib/notifications';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { safeUrlList } from '@/lib/api/urlField';
import { assertOwnsFileUrls } from '@/lib/storage/service';

type RouteCtx = { params: Promise<{ id: string; unitId: string }> };

async function loadUnitWithProperty(propertyId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== propertyId) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { unit, property };
}

// The unit's own tenant needs to see violations reported against them, not
// just the property's manager/landlord/admin.
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id, unitId } = await ctx.params;
    try {
      const found = await loadUnitWithProperty(id, unitId);
      if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

      const isManager = canManageProperty(session, found.property);
      if (!isManager) {
        const activeRent = await prisma.rent.findFirst({
          where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
        });
        if (!activeRent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const violations = await prisma.violation.findMany({
        where: { unitId },
        include: { reportedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ data: violations });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

const createViolationSchema = z.object({
  description: z.string().min(1),
  severity: z.nativeEnum(ViolationSeverity).optional(),
  evidenceUrls: safeUrlList.optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id, unitId } = await ctx.params;
    try {
      const found = await loadUnitWithProperty(id, unitId);
      if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (!canManageProperty(session, found.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, createViolationSchema);
      if (!validated.success) return validated.response;

      if (validated.data.evidenceUrls?.length) {
        await assertOwnsFileUrls(validated.data.evidenceUrls, session.sub, 'properties');
      }

      const violation = await prisma.violation.create({
        data: { unitId, reportedById: session.sub, ...validated.data },
      });
      await tellUnitTenant(unitId, {
        title: 'A violation was recorded for your unit',
        body: `${violation.severity.toLowerCase()} violation: ${violation.description}`,
      });
      return NextResponse.json({ data: violation }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
