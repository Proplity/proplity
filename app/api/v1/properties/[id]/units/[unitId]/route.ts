import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency, UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; unitId: string }> };

async function loadUnitWithProperty(propertyId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== propertyId) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { unit, property };
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id, unitId } = await params;
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    return NextResponse.json({ data: serializeUnit(found.unit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  rentAmount: z.number().positive().optional(),
  listedPaymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  depositAmount: z.number().optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  amenities: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  sqft: z.number().int().optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id, unitId } = await ctx.params;

  try {
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!canManageProperty(session, found.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, updateUnitSchema);
    if (!validated.success) return validated.response;
    const { sqft, ...data } = validated.data;

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: { ...data, ...(sqft !== undefined ? { squareFeet: sqft } : {}) },
    });
    return NextResponse.json({ data: serializeUnit(updated) });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id, unitId } = await ctx.params;

  try {
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!canManageProperty(session, found.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Lease.unit has onDelete: Cascade -- a hard delete here would silently
    // wipe lease/tenancy history for the unit. Refuse rather than cascade;
    // there's no ARCHIVED UnitStatus to soft-delete into instead.
    const leaseCount = await prisma.lease.count({ where: { unitId } });
    if (leaseCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a unit with lease history', code: 'HAS_LEASES' },
        { status: 409 },
      );
    }

    await prisma.unit.delete({ where: { id: unitId } });
    return NextResponse.json({ data: { id: unitId, deleted: true } });
  } catch (err) {
    return handleApiError(err);
  }
});
