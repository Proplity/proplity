import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

function loadRequest(id: string) {
  return prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      unit: {
        include: {
          property: {
            include: { manager: { select: { id: true, name: true, phoneNumber: true, email: true } } },
          },
        },
      },
      category: true,
      vendor: true,
      tenant: true,
      conversation: true,
      vendorRating: true,
    },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const request = await loadRequest(id);
    if (!request) return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && request.tenantId === session.sub;
    const isAssignedVendor = session.role === 'VENDOR' && request.vendorId === session.sub;
    const canManage = canManageProperty(session, request.unit.property);

    if (!isOwnerTenant && !isAssignedVendor && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: request });
  } catch (err) {
    return handleApiError(err);
  }
});

const patchSchema = z.object({
  categoryId: z.string().nullable().optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  vendorId: z.string().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  completionProofUrl: z.string().optional(),
  finalCost: z.number().optional(),
  vendorNotes: z.string().optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const request = await loadRequest(id);
    if (!request) return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });

    const validated = await validateBody(req, patchSchema);
    if (!validated.success) return validated.response;
    const { categoryId, priority, vendorId, scheduledFor, status, completionProofUrl, finalCost, vendorNotes } =
      validated.data;

    const canManage = canManageProperty(session, request.unit.property);
    const isTriage = categoryId !== undefined || priority !== undefined || vendorId !== undefined || scheduledFor !== undefined;

    // Triage: MANAGER/LANDLORD/ADMIN assign category, priority, vendor, schedule.
    if (isTriage) {
      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        data: { categoryId, priority, vendorId, scheduledFor },
      });
      return NextResponse.json({ data: updated });
    }

    // Cancel: MANAGER/LANDLORD/ADMIN, or the TENANT who owns the request.
    if (status === 'CANCELLED') {
      const isOwnerTenant = session.role === 'TENANT' && request.tenantId === session.sub;
      if (!canManage && !isOwnerTenant) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updated = await prisma.maintenanceRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
      return NextResponse.json({ data: updated });
    }

    // Progress/completion: only the assigned VENDOR.
    if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
      const isAssignedVendor = session.role === 'VENDOR' && request.vendorId === session.sub;
      if (!isAssignedVendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      if (status === 'COMPLETED') {
        if (!completionProofUrl || finalCost === undefined) {
          return NextResponse.json(
            { error: 'completionProofUrl and finalCost are required to complete a request' },
            { status: 400 },
          );
        }

        // Auto-create the MAINTENANCE invoice in the same transaction as the
        // completion write -- maintenanceRequestId satisfies Invoice's
        // "at least one of leaseId/maintenanceRequestId/userId" rule.
        const [updated] = await prisma.$transaction([
          prisma.maintenanceRequest.update({
            where: { id },
            data: { status: 'COMPLETED', completionProofUrl, finalCost, completedAt: new Date() },
          }),
          prisma.invoice.create({
            data: {
              maintenanceRequestId: id,
              type: 'MAINTENANCE',
              amount: finalCost,
              dueDate: new Date(),
              description: `Maintenance: ${request.title}`,
            },
          }),
        ]);
        return NextResponse.json({ data: updated });
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        data: { status: 'IN_PROGRESS', ...(vendorNotes !== undefined ? { vendorNotes } : {}) },
      });
      return NextResponse.json({ data: updated });
    }

    // Notes-only update: the assigned vendor leaving a progress note without
    // changing status (e.g. a request already IN_PROGRESS).
    if (vendorNotes !== undefined) {
      const isAssignedVendor = session.role === 'VENDOR' && request.vendorId === session.sub;
      if (!isAssignedVendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await prisma.maintenanceRequest.update({ where: { id }, data: { vendorNotes } });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
});
