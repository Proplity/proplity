import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyType, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';
import { getServerSession } from '@/lib/auth/session';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Visibility, in three tiers. This route stays *optionally* authenticated --
 * PublicPropertyDetail browses it logged-out and must keep working -- but an
 * unpublished listing is no longer readable by anyone who merely knows the id.
 *
 * A property is readable when ANY of these hold:
 *   1. it is published (the public tier -- mirrors the list endpoint's
 *      `isPublished: true` filter, which is the same gate. `isPublished` can
 *      only ever be flipped true after ADMIN approval, see PATCH below, so
 *      published implies moderation-approved);
 *   2. the caller manages it (its own manager/landlord, or an ADMIN) -- their
 *      dashboard has to show a pending-review listing;
 *   3. the caller is a tenant living in it. A landlord can unpublish a
 *      property that still has sitting tenants, and the tenant-facing property
 *      page (announcements, unit detail) reads this same endpoint -- so
 *      occupancy, not publication, is what governs their access.
 *
 * Anything else 404s rather than 403s: a 403 would confirm the id exists,
 * which is exactly the fact being protected.
 */
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

    if (!property.isPublished) {
      const jwtSession = await getServerSession();
      if (!jwtSession) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      const session = { sub: jwtSession.sub, role: jwtSession.role as Role };

      let visible = canManageProperty(session, property);
      if (!visible) {
        // Any lease at all, not just ACTIVE: a tenant mid-renewal or just
        // past their end date still needs the property's announcements and
        // their own unit's history.
        const occupancy = await prisma.lease.findFirst({
          where: { tenantId: session.sub, unit: { propertyId: id } },
          select: { id: true },
        });
        visible = occupancy !== null;
      }

      if (!visible) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

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
  // The property's own manager/landlord visibility toggle -- independent of
  // moderationStatus (the ADMIN review outcome, set via the separate
  // /moderation route). Gated below: can only ever flip true once ADMIN has
  // approved the listing; false (unpublish) is always allowed.
  isPublished: z.boolean().optional(),
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

    // Reassigning who manages/owns a property is a takeover vector, not an
    // ordinary listing edit -- restrict it to ADMIN, and require the target
    // id to actually be a user with the matching role.
    if (validated.data.managerId !== undefined || validated.data.landlordId !== undefined) {
      if (session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: "Only an admin may reassign a property's manager or landlord" },
          { status: 403 },
        );
      }
      if (validated.data.managerId) {
        const manager = await prisma.user.findUnique({ where: { id: validated.data.managerId } });
        if (!manager || manager.role !== 'MANAGER') {
          return NextResponse.json(
            { error: 'managerId must reference a MANAGER user' },
            { status: 400 },
          );
        }
      }
      if (validated.data.landlordId) {
        const landlord = await prisma.user.findUnique({ where: { id: validated.data.landlordId } });
        if (!landlord || landlord.role !== 'LANDLORD') {
          return NextResponse.json(
            { error: 'landlordId must reference a LANDLORD user' },
            { status: 400 },
          );
        }
      }
    }

    if (validated.data.isPublished === true && property.moderationStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'This listing must be approved by an admin before it can be published',
          code: 'NOT_APPROVED',
        },
        { status: 409 },
      );
    }

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
