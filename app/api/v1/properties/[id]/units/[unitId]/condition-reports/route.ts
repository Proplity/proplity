import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; unitId: string }> };

async function loadUnitWithProperty(propertyId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== propertyId) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { unit, property };
}

export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id, unitId } = await ctx.params;
    try {
      const found = await loadUnitWithProperty(id, unitId);
      if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

      const isManager = canManageProperty(session, found.property);
      if (!isManager) {
        const activeLease = await prisma.lease.findFirst({
          where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
        });
        if (!activeLease) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const reports = await prisma.conditionReport.findMany({
        where: { unitId },
        orderBy: { reportedAt: 'desc' },
      });
      return NextResponse.json({ data: reports });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

// rooms is a free-form room-by-room JSON blob (dimensions, condition,
// photo references) -- same precedent as NeighbourhoodReport for this
// shape of read-mostly data, no individual field is queried/filtered on.
// aiFlags is never set here: no AI/image-analysis integration exists
// anywhere in this codebase (see CLAUDE.md) -- it stays null rather than
// faking a detection result, same principle as ad campaigns' honest-zero
// stats.
const createConditionReportSchema = z.object({
  rooms: z.record(z.string(), z.unknown()),
  inconsistencyNotes: z.string().optional(),
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

      const validated = await validateBody(req, createConditionReportSchema);
      if (!validated.success) return validated.response;

      const report = await prisma.conditionReport.create({
        data: { unitId, ...validated.data, rooms: validated.data.rooms as Prisma.InputJsonValue },
      });
      return NextResponse.json({ data: report }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
