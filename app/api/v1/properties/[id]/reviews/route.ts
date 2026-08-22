import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const verifiedOnly = searchParams.get('verified') === 'true';

    const where = { propertyId: id, ...(verifiedOnly ? { leaseId: { not: null } } : {}) };

    const [reviews, total] = await Promise.all([
      prisma.propertyReview.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.propertyReview.count({ where }),
    ]);

    const data = reviews.map((r) => ({ ...r, verified: r.leaseId !== null }));
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

    // Verified badge is resolved once, here, at creation time -- never
    // re-checked at read time (a review shouldn't lose its badge if the
    // underlying lease later expires).
    const qualifyingLease = await prisma.lease.findFirst({
      where: { tenantId: session.sub, unit: { propertyId: id } },
      orderBy: { createdAt: 'desc' },
    });

    const review = await prisma.propertyReview.create({
      data: {
        propertyId: id,
        reviewerId: session.sub,
        leaseId: qualifyingLease?.id ?? null,
        rating: validated.data.rating,
        comment: validated.data.comment,
      },
    });

    return NextResponse.json({ data: { ...review, verified: review.leaseId !== null } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
