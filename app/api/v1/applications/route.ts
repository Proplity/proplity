import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

export const GET = withAuth(async (req, { session }) => {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const unitId = req.nextUrl.searchParams.get('unitId');

    const filters: Prisma.ApplicationWhereInput[] = [
      ...(status ? [{ status: status as ApplicationStatus }] : []),
      ...(unitId ? [{ unitId }] : []),
    ];

    if (session.role === 'TENANT') {
      filters.push({ applicantId: session.sub });
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      filters.push({
        unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } },
      });
    }
    // ADMIN and VENDOR: no extra scoping needed for ADMIN (sees all);
    // VENDOR has no legitimate reason to see applications at all, but this
    // route doesn't role-gate VENDOR out entirely -- withAuth has no roles
    // restriction here, so an unscoped VENDOR query would see everything.
    // Explicitly exclude it rather than leaving that open.
    else if (session.role === 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Prisma.ApplicationWhereInput = filters.length ? { AND: filters } : {};

    const applications = await prisma.application.findMany({
      where,
      include: {
        applicant: { select: { id: true, name: true, email: true, phoneNumber: true } },
        unit: {
          select: { id: true, unitNumber: true, property: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: applications });
  } catch (err) {
    return handleApiError(err);
  }
});

const createApplicationSchema = z.object({
  unitId: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createApplicationSchema);
      if (!validated.success) return validated.response;
      const { unitId, details } = validated.data;

      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

      // One pending application per applicant per unit at a time -- same
      // app-level duplicate-prevention shape as access-codes/route.ts's
      // per-unit code conflict check (no DB-level unique constraint for this).
      const existing = await prisma.application.findFirst({
        where: { unitId, applicantId: session.sub, status: 'PENDING' },
      });
      if (existing) {
        return NextResponse.json(
          {
            error: 'You already have a pending application for this unit',
            code: 'APPLICATION_CONFLICT',
          },
          { status: 409 },
        );
      }

      const application = await prisma.application.create({
        data: { unitId, applicantId: session.sub, details: details as Prisma.InputJsonValue },
      });
      return NextResponse.json({ data: application }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
