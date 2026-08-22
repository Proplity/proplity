import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
        neighbourhoodReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const { reviews, units, ...rest } = property;
    const ratings = reviews.map((r) => r.rating);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    return NextResponse.json({
      data: {
        ...rest,
        units: units.map(serializeUnit),
        reviews: reviews.map((r) => ({ ...r, verified: r.leaseId !== null })),
        reviewStats: { count: reviews.length, averageRating },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  type: z.nativeEnum(PropertyType).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  video360Url: z.string().optional(),
  exteriorPhotoUrl: z.string().optional(),
  managerId: z.string().optional(),
  landlordId: z.string().optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, updatePropertySchema);
    if (!validated.success) return validated.response;

    const updated = await prisma.property.update({ where: { id }, data: validated.data });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-archive only -- never prisma.property.delete().
    const updated = await prisma.property.update({ where: { id }, data: { isPublished: false } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});
