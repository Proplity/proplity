import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency, UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const status = req.nextUrl.searchParams.get('status');

    const units = await prisma.unit.findMany({
      where: { propertyId: id, ...(status ? { status: status as UnitStatus } : {}) },
      orderBy: { unitNumber: 'asc' },
    });

    return NextResponse.json({ data: units.map(serializeUnit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().min(0),
  rentAmount: z.number().positive(),
  listedPaymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  depositAmount: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  sqft: z.number().int().optional(),
});

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, createUnitSchema);
    if (!validated.success) return validated.response;
    const { sqft, ...data } = validated.data;

    const unit = await prisma.unit.create({
      data: { ...data, propertyId: id, squareFeet: sqft },
    });
    return NextResponse.json({ data: serializeUnit(unit) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
