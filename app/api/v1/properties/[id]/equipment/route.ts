import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EquipmentType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Covers both property-wide equipment (propertyId set) and
      // unit-specific equipment (unitId set, on one of this property's
      // units) -- Equipment is one of "at least one of unitId/propertyId"
      // per CLAUDE.md's multi-FK rule, so both need querying.
      const equipment = await prisma.equipment.findMany({
        where: { OR: [{ propertyId: id }, { unit: { propertyId: id } }] },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ data: equipment });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

// unitId omitted means property-wide equipment (e.g. a shared generator) --
// both are valid per Equipment's "at least one of unitId/propertyId" rule,
// enforced below by always setting exactly one at create time.
const createEquipmentSchema = z.object({
  unitId: z.string().optional(),
  type: z.nativeEnum(EquipmentType),
  serialNumber: z.string().optional(),
  installedAt: z.coerce.date().optional(),
  warrantyExpiresAt: z.coerce.date().optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, createEquipmentSchema);
      if (!validated.success) return validated.response;
      const { unitId, ...rest } = validated.data;

      if (unitId) {
        const unit = await prisma.unit.findUnique({ where: { id: unitId } });
        if (!unit || unit.propertyId !== id) {
          return NextResponse.json(
            { error: 'unitId must belong to this property' },
            { status: 400 },
          );
        }
      }

      const equipment = await prisma.equipment.create({
        data: unitId ? { unitId, ...rest } : { propertyId: id, ...rest },
      });
      return NextResponse.json({ data: equipment }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
