import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

function loadApplication(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, phoneNumber: true } },
      reviewedBy: { select: { id: true, name: true } },
      unit: { include: { property: true } },
    },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const application = await loadApplication(id);
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const canView =
      application.applicantId === session.sub ||
      canManageProperty(session, application.unit.property);
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ data: application });
  } catch (err) {
    return handleApiError(err);
  }
});

const patchSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const application = await loadApplication(id);
      if (!application)
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      if (!canManageProperty(session, application.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (application.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'This application has already been reviewed' },
          { status: 409 },
        );
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.application.update({
        where: { id },
        data: {
          status: validated.data.status,
          reviewNotes: validated.data.reviewNotes,
          reviewedById: session.sub,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
