import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, PropertyType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notifyAdmins } from '@/lib/notifications';
import { withAuth } from '@/lib/api/withAuth';
import { getServerSession } from '@/lib/auth/session';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { managedIdsOf } from '@/lib/team';
import {
  PENDING_UNIT_FLAG,
  PRIVATE_UNIT_FLAG,
  isPublicUnit,
  propertyScopeWhere,
  serializeUnit,
} from '@/lib/api/propertyAccess';
import { safeUrl, safeUrlList } from '@/lib/api/urlField';
import { listingHash, findPossibleDuplicates } from '@/lib/propertyFingerprint';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';

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
        jwtSession.role === 'ADMIN' ? {} : propertyScopeWhere(await managedIdsOf(jwtSession.sub));

      const [properties, total] = await Promise.all([
        prisma.property.findMany({
          where,
          skip,
          take,
          // manager and landlord included so admin moderation queue and tables show complete ownership info
          include: {
            units: true,
            manager: { select: { id: true, name: true, phoneNumber: true, email: true } },
            landlord: { select: { id: true, name: true, phoneNumber: true, email: true } },
            mergedInto: { select: { id: true, name: true, address: true, city: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
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

    // Only approved listings are public; isPublished alone is the owner's own toggle.
    const where: Record<string, unknown> = {
      isPublished: true,
      moderationStatus: 'APPROVED',
      mergedIntoId: null,
    };
    // A building whose units are all private, or all awaiting approval, has nothing to show the public. (amenities
    // can be NULL on a unit, so this is done in SQL where COALESCE handles that.)
    const allPrivate = await prisma.$queryRaw<{ propertyId: string }[]>(Prisma.sql`
      SELECT "propertyId" FROM "Unit" GROUP BY "propertyId"
      HAVING bool_and(COALESCE(amenities, '{}'::text[]) && ARRAY[${PRIVATE_UNIT_FLAG}, ${PENDING_UNIT_FLAG}]::text[])`);
    if (allPrivate.length > 0) where.id = { notIn: allPrivate.map((r) => r.propertyId) };
    if (city) where.city = city;
    if (state) where.state = state;
    if (type) where.type = type as PropertyType;
    if (trustScoreMin) where.trustScore = { gte: Number(trustScoreMin) };
    if (powerReliabilityMin) where.powerReliabilityScore = { gte: Number(powerReliabilityMin) };
    if (floodRiskMax) where.floodRiskScore = { lte: Number(floodRiskMax) };
    if (minPrice || maxPrice || minBedrooms) {
      // Only units the public can see count towards a price or bedroom search. Done in SQL because
      // a unit's amenities can be NULL, which the Prisma array filters leave out.
      const conditions = [
        Prisma.sql`NOT (COALESCE(amenities, '{}'::text[]) && ARRAY[${PRIVATE_UNIT_FLAG}, ${PENDING_UNIT_FLAG}]::text[])`,
      ];
      if (minPrice) conditions.push(Prisma.sql`"rentAmount" >= ${Number(minPrice)}`);
      if (maxPrice) conditions.push(Prisma.sql`"rentAmount" <= ${Number(maxPrice)}`);
      if (minBedrooms) conditions.push(Prisma.sql`"bedrooms" >= ${Number(minBedrooms)}`);
      const matching = await prisma.$queryRaw<{ propertyId: string }[]>(
        Prisma.sql`SELECT DISTINCT "propertyId" FROM "Unit" WHERE ${Prisma.join(conditions, ' AND ')}`,
      );
      where.id = { ...(where.id as object | undefined), in: matching.map((r) => r.propertyId) };
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

    // Private units are never part of the public list.
    const data = properties.map((p) => ({
      ...p,
      units: p.units.filter(isPublicUnit).map(serializeUnit),
    }));

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
  imageUrl: safeUrl.optional(),
  video360Url: safeUrl.optional(),
  exteriorPhotoUrl: safeUrl.optional(),
  photoUrls: safeUrlList.optional(),
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

    // Who runs the property is the creator, unless an admin names the people (ISS-147). A manager
    // or landlord cannot put someone else's account on a listing; that is the same rule as moving
    // a property afterwards, which only an admin may do.
    if (session.role !== 'ADMIN') {
      // A company's managing partner may also put one of their own team in the manager's seat.
      const ownManagerSeat =
        data.managerId === undefined ||
        data.managerId === session.sub ||
        (!!session.org?.isOwner && session.org.memberIds.includes(data.managerId));
      const ownLandlordSeat = data.landlordId === undefined || data.landlordId === session.sub;
      const roleMatches =
        (data.managerId === undefined || session.role === 'MANAGER') &&
        (data.landlordId === undefined || session.role === 'LANDLORD');
      if (!ownManagerSeat || !ownLandlordSeat || !roleMatches) {
        return NextResponse.json(
          { error: 'Only an admin can name a different manager or landlord' },
          { status: 403 },
        );
      }
    } else {
      if (data.managerId) {
        const manager = await prisma.user.findUnique({ where: { id: data.managerId } });
        if (!manager || manager.role !== 'MANAGER') {
          return NextResponse.json(
            { error: 'managerId must reference a MANAGER user' },
            { status: 400 },
          );
        }
      }
      if (data.landlordId) {
        const landlord = await prisma.user.findUnique({ where: { id: data.landlordId } });
        if (!landlord || landlord.role !== 'LANDLORD') {
          return NextResponse.json(
            { error: 'landlordId must reference a LANDLORD user' },
            { status: 400 },
          );
        }
      }
    }

    try {
      // ISS-025: a listing whose address and city match an existing one is
      // still accepted, but its review notes point the moderator at the match.
      // Nothing is merged or rejected automatically.
      const hash = listingHash(data.address, data.city);
      const duplicates = await findPossibleDuplicates(hash);
      const property = await prisma.property.create({
        data: {
          ...data,
          listingHash: hash,
          ...(duplicates.length > 0
            ? {
                moderationNotes: `Possible duplicate of: ${duplicates
                  .map((d) => `${d.name} (${d.id})`)
                  .join(', ')}`,
              }
            : {}),
          isPublished: false,
          createdById: session.sub,
          ...(session.role === 'MANAGER' && !data.managerId ? { managerId: session.sub } : {}),
          ...(session.role === 'LANDLORD' && !data.landlordId ? { landlordId: session.sub } : {}),
        },
      });

      await notifyAdmins({
        title: 'Listing awaiting review',
        body: `"${property.name}" (${property.address}, ${property.city}) was submitted for review.`,
        link: '/admin/properties',
      });

      // Notify all Admins by email of the new listing awaiting review
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
        });
        const submitter = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { name: true, email: true, role: true },
        });
        const adminEmails = [...new Set([...admins.map((a) => a.email), 'admin@proplity.com'])];
        for (const adminEmail of adminEmails) {
          await sendEmail({
            to: adminEmail,
            subject: `New Property Submitted for Moderation: ${property.name}`,
            body: `Hi Admin,\n\nA new property listing "${property.name}" (${property.address}, ${property.city}) has been submitted by ${submitter?.name ?? 'User'} (${submitter?.email ?? ''}, ${submitter?.role ?? ''}).\n\nIt is now pending review in the Moderation Queue.\n\nReview it here: ${appUrl(`/admin/properties`, req)}`,
          });
        }
      } catch (emailErr) {
        console.error('Failed to dispatch admin notification email for new property', emailErr);
      }

      return NextResponse.json(
        { data: property, possibleDuplicates: duplicates.length },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
