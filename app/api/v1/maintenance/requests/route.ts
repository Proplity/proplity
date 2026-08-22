import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MaintenancePriority, MaintenanceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

export const GET = withAuth(async (req, { session }) => {
  try {
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status');

    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(status ? { status: status as MaintenanceStatus } : {}),
    };

    if (session.role === 'TENANT') {
      where.tenantId = session.sub;
    } else if (session.role === 'VENDOR') {
      where.vendorId = session.sub;
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      // Extending the plan's "MANAGER/ADMIN see all" to LANDLORD too --
      // canManageProperty already treats LANDLORD the same as MANAGER for
      // property access, and a landlord with zero visibility into
      // maintenance on their own property would be a gap, not a feature.
      where.unit = {
        property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] },
      };
    }
    // ADMIN: no extra scoping, sees everything.

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        skip,
        take,
        include: { unit: true, category: true, vendor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return NextResponse.json({ data: requests, meta: buildMeta(total, page, limit) });
  } catch (err) {
    return handleApiError(err);
  }
});

const createRequestSchema = z.object({
  unitId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  mediaUrls: z.array(z.string()).optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createRequestSchema);
      if (!validated.success) return validated.response;
      const { unitId, ...rest } = validated.data;

      const activeLease = await prisma.lease.findFirst({
        where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
      });
      if (!activeLease) {
        return NextResponse.json(
          { error: 'You must have an active lease on this unit to submit a request' },
          { status: 403 },
        );
      }

      const request = await prisma.maintenanceRequest.create({
        data: { unitId, tenantId: session.sub, ...rest },
      });
      return NextResponse.json({ data: request }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
