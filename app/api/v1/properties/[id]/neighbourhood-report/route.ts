import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { listingViewer, sessionOrNull } from '@/lib/api/listingAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !(await listingViewer(await sessionOrNull(), property)).visible) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    const report = await prisma.neighbourhoodReport.findFirst({
      where: { propertyId: id },
      orderBy: { generatedAt: 'desc' },
    });
    if (!report)
      return NextResponse.json({ error: 'No neighbourhood report found' }, { status: 404 });
    return NextResponse.json({ data: report });
  } catch (err) {
    return handleApiError(err);
  }
}

// Each section mirrors what the report page shows (see the schema comment on
// NeighbourhoodReport): a free-form object, capped in size. Only the sections
// sent are stored; the rest are carried over from the previous report so a
// manager can correct one section without retyping the others (ISS-016).
const section = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= 20_000, { message: 'Section is too large' });

const putSchema = z
  .object({
    security: section.optional(),
    electricity: section.optional(),
    water: section.optional(),
    roadNetwork: section.optional(),
    flooding: section.optional(),
    amenities: section.optional(),
    demographics: section.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one section' });

const SECTIONS = [
  'security',
  'electricity',
  'water',
  'roadNetwork',
  'flooding',
  'amenities',
  'demographics',
] as const;

// Saves a new report version for the property. Earlier versions are kept
// (GET returns the latest by generatedAt), and the save is audit-logged.
export const PUT = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({
        where: { id },
        select: { id: true, managerId: true, landlordId: true },
      });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, putSchema);
      if (!validated.success) return validated.response;

      const previous = await prisma.neighbourhoodReport.findFirst({
        where: { propertyId: id },
        orderBy: { generatedAt: 'desc' },
      });
      const data: Prisma.NeighbourhoodReportUncheckedCreateInput = { propertyId: id };
      for (const key of SECTIONS) {
        const sent = validated.data[key];
        const value = sent ?? previous?.[key];
        if (value !== undefined && value !== null) {
          data[key] = value as Prisma.InputJsonValue;
        }
      }

      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.neighbourhoodReport.create({ data });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'NEIGHBOURHOOD_REPORT_SAVED',
            entityType: 'Property',
            entityId: id,
            metadata: { sections: Object.keys(validated.data) },
          },
        });
        return created;
      });
      return NextResponse.json({ data: report }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
