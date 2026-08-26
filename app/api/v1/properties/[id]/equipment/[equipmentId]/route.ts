import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EquipmentType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; equipmentId: string }> };

async function loadOwned(propertyId: string, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, include: { unit: true } });
  if (!equipment) return null;
  const belongsToProperty = equipment.propertyId === propertyId || equipment.unit?.propertyId === propertyId;
  if (!belongsToProperty) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { equipment, property };
}

const updateEquipmentSchema = z.object({
  type: z.nativeEnum(EquipmentType).optional(),
  serialNumber: z.string().optional(),
  installedAt: z.coerce.date().optional(),
  warrantyExpiresAt: z.coerce.date().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id, equipmentId } = await ctx.params;
    try {
      const found = await loadOwned(id, equipmentId);
      if (!found) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
      if (!canManageProperty(session, found.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, updateEquipmentSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.equipment.update({ where: { id: equipmentId }, data: validated.data });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id, equipmentId } = await ctx.params;
    try {
      const found = await loadOwned(id, equipmentId);
      if (!found) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
      if (!canManageProperty(session, found.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.equipment.delete({ where: { id: equipmentId } });
      return NextResponse.json({ data: { id: equipmentId, deleted: true } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
