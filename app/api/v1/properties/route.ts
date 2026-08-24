import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { getServerSession } from '@/lib/auth/session';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { serializeUnit } from '@/lib/api/propertyAccess';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);

    // scope=mine: an authenticated MANAGER/LANDLORD/ADMIN's own properties
    // (published or not -- their own dashboard needs to see a pending-review
    // listing too). Default (no scope param) stays exactly as before: public,
    // unauthenticated, published-only browsing -- PropertyDiscovery and
    // PublicPropertyDetail depend on that remaining unauthenticated.
    if (searchParams.get('scope') === 'mine') {
      const jwtSession = await getServerSession();
      if (!jwtSession) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
      if (!['ADMIN', 'MANAGER', 'LANDLORD'].includes(jwtSession.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const where: Record<string, unknown> =
        jwtSession.role === 'ADMIN'
          ? {}
          : { OR: [{ managerId: jwtSession.sub }, { landlordId: jwtSession.sub }] };

      const [properties, total] = await Promise.all([
        prisma.property.findMany({ where, skip, take, include: { units: true }, orderBy: { createdAt: 'desc' } }),
        prisma.property.count({ where }),
      ]);
      const data = properties.map((p) => ({ ...p, units: p.units.map(serializeUnit) }));
      return NextResponse.json({ data, meta: buildMeta(total, page, limit) });
    }

    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const type = searchParams.get('type');
    const trustScoreMin = searchParams.get('trustScoreMin');
    const powerReliabilityMin = searchParams.get('powerReliabilityMin');
    const floodRiskMax = searchParams.get('floodRiskMax');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minBedrooms = searchParams.get('minBedrooms');

    const where: Record<string, unknown> = { isPublished: true };
    if (city) where.city = city;
    if (state) where.state = state;
    if (type) where.type = type as PropertyType;
    if (trustScoreMin) where.trustScore = { gte: Number(trustScoreMin) };
    if (powerReliabilityMin) where.powerReliabilityScore = { gte: Number(powerReliabilityMin) };
    if (floodRiskMax) where.floodRiskScore = { lte: Number(floodRiskMax) };
    if (minPrice || maxPrice || minBedrooms) {
      where.units = {
        some: {
          ...(minPrice || maxPrice
            ? {
                rentAmount: {
                  ...(minPrice ? { gte: Number(minPrice) } : {}),
                  ...(maxPrice ? { lte: Number(maxPrice) } : {}),
                },
              }
            : {}),
          ...(minBedrooms ? { bedrooms: { gte: Number(minBedrooms) } } : {}),
        },
      };
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        include: { units: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.property.count({ where }),
    ]);

    const data = properties.map((p) => ({ ...p, units: p.units.map(serializeUnit) }));

    return NextResponse.json({ data, meta: buildMeta(total, page, limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const createPropertySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  type: z.nativeEnum(PropertyType).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  video360Url: z.string().optional(),
  exteriorPhotoUrl: z.string().optional(),
  isPublished: z.boolean().optional(),
  managerId: z.string().optional(),
  landlordId: z.string().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    const validated = await validateBody(req, createPropertySchema);
    if (!validated.success) return validated.response;
    // isPublished intentionally dropped here: moderationStatus defaults to
    // PENDING_REVIEW (PRD §6.2.1's AI moderation pipeline still isn't built
    // -- real ADMIN review stands in for it, see /moderation), so a new
    // listing always starts unpublished regardless of what the caller
    // sends. Publishing is a separate, later PATCH /properties/[id] call,
    // itself gated on moderationStatus === 'APPROVED'.
    const { isPublished: _isPublished, ...data } = validated.data;

    try {
      const property = await prisma.property.create({
        data: {
          ...data,
          isPublished: false,
          ...(session.role === 'MANAGER' && !data.managerId ? { managerId: session.sub } : {}),
          ...(session.role === 'LANDLORD' && !data.landlordId ? { landlordId: session.sub } : {}),
        },
      });
      return NextResponse.json({ data: property }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
