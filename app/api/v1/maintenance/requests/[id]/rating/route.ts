import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const request = await prisma.maintenanceRequest.findUnique({ where: { id } });
      if (!request) return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
      if (request.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (request.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Request must be completed before rating' }, { status: 409 });
      }
      if (!request.vendorId) {
        return NextResponse.json({ error: 'Request has no assigned vendor' }, { status: 409 });
      }

      const validated = await validateBody(req, ratingSchema);
      if (!validated.success) return validated.response;

      // maintenanceRequestId is @unique on VendorRating -- a second POST
      // hits P2002, which handleApiError already turns into a clean 409.
      // No separate existence pre-check needed.
      const rating = await prisma.vendorRating.create({
        data: {
          maintenanceRequestId: id,
          vendorId: request.vendorId,
          ratedById: session.sub,
          rating: validated.data.rating,
          comment: validated.data.comment,
        },
      });
      return NextResponse.json({ data: rating }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
