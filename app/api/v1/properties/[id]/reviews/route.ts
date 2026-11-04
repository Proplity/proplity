import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { findReviewBasis, reviewerKind } from '@/lib/reviewEligibility';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const verifiedOnly = searchParams.get('verified') === 'true';

    const where = { propertyId: id, ...(verifiedOnly ? { rentId: { not: null } } : {}) };

    const [reviews, total] = await Promise.all([
      prisma.propertyReview.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.propertyReview.count({ where }),
    ]);

    const data = reviews.map((r) => ({
      ...r,
      verified: r.rentId !== null,
      kind: reviewerKind(r),
    }));
    return NextResponse.json({ data, meta: buildMeta(total, page, limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const validated = await validateBody(req, createReviewSchema);
    if (!validated.success) return validated.response;

    const property = await prisma.property.findUnique({
      where: { id },
      select: { managerId: true, landlordId: true },
    });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    // The people who run a property do not rate it, and one person rates it once (ISS-149).
    if (canManageProperty(session, property)) {
      return NextResponse.json({ error: 'You cannot review a property you run' }, { status: 403 });
    }

    // Only people who have been there rate it: a rent, or a confirmed viewing that has happened.
    // The verified badge is resolved once, here, at creation time -- never re-checked at read time
    // (a review shouldn't lose its badge if the underlying rent later expires).
    const basis = await findReviewBasis(session.sub, id);
    if (!basis) {
      return NextResponse.json(
        {
          error: 'Only people who have rented or viewed this property can review it',
          code: 'REVIEW_NOT_ELIGIBLE',
        },
        { status: 403 },
      );
    }

    // Reviews are counted into the rating, so two at once from one person must not both land.
    const review = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`review:${id}:${session.sub}`}))`;
      const already = await tx.propertyReview.findFirst({
        where: { propertyId: id, reviewerId: session.sub },
        select: { id: true },
      });
      if (already) return null;
      return tx.propertyReview.create({
        data: {
          propertyId: id,
          reviewerId: session.sub,
          rentId: basis.rentId,
          rating: validated.data.rating,
          comment: validated.data.comment,
        },
      });
    });
    if (!review) {
      return NextResponse.json(
        { error: 'You have already reviewed this property', code: 'ALREADY_REVIEWED' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { data: { ...review, verified: review.rentId !== null, kind: basis.kind } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
});
