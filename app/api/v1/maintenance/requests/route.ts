import { NextResponse } from 'next/server';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { handleFileError } from '@/lib/api/fileErrors';
import { z } from 'zod';
import { MaintenancePriority, MaintenanceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import {
  notifyAndEmail,
  notifyByEmail,
  notifyPropertyTeam,
  notifyUsers,
  tellUnitTenant,
} from '@/lib/notifications';
import { safeUrlList } from '@/lib/api/urlField';
import { appUrl } from '@/lib/appUrl';
import { canManageProperty, PUBLIC_PROPERTY, propertyScopeWhere } from '@/lib/api/propertyAccess';
import { vendorProblem } from '@/lib/maintenanceFlow';

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
        property: { ...propertyScopeWhere(session.scope) },
      };
    }
    // ADMIN: no extra scoping, sees everything.

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        skip,
        take,
        include: {
          unit: { include: { property: PUBLIC_PROPERTY } },
          category: true,
          vendor: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          vendorRating: { select: { rating: true, comment: true } },
        },
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
  mediaUrls: safeUrlList.optional(),
});

// A work order: a repair the property team raises itself, on any unit it manages (occupied, vacant,
// not yet rented or listed). It has no tenant, so there is nobody to confirm it or rate the vendor.
// The property team still pays the vendor, exactly as for a tenant's repair.
const workOrderSchema = createRequestSchema.extend({ vendorId: z.string().optional() });

export const POST = withAuth(
  async (req, { session }) => {
    try {
      if (session.role !== 'TENANT') {
        const validated = await validateBody(req, workOrderSchema);
        if (!validated.success) return validated.response;
        const { unitId, vendorId, ...rest } = validated.data;

        const unit = await prisma.unit.findUnique({
          where: { id: unitId },
          include: { property: true },
        });
        if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        if (!canManageProperty(session, unit.property)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await assertOwnsFileUrls(rest.mediaUrls ?? [], session.sub, 'maintenance-requests');
        if (vendorId) {
          const problem = await vendorProblem(vendorId);
          if (problem) return problem;
        }

        const request = await prisma.maintenanceRequest.create({
          data: {
            unitId,
            tenantId: null,
            createdById: session.sub,
            ...(vendorId ? { vendorId, status: 'SCHEDULED' as const } : {}),
            ...rest,
          },
          include: { unit: { include: { property: PUBLIC_PROPERTY } } },
        });

        // The rest of the property team, the vendor (if one was chosen) and whoever lives in the
        // unit now (they should know someone may need to come in). The person who raised it knows.
        await notifyPropertyTeam(
          unit.property,
          {
            type: 'MAINTENANCE_STATUS',
            title: `Work order raised: ${request.title}`,
            body: `A work order was raised for unit ${unit.unitNumber} at ${unit.property.name}.`,
            link: `/dashboard/maintenance/${request.id}`,
          },
          { exceptId: session.sub, req },
        );
        if (vendorId) {
          await notifyAndEmail(
            vendorId,
            {
              type: 'MAINTENANCE_STATUS',
              title: `New Job Assigned: ${request.title}`,
              body: `You have been assigned to "${request.title}" at ${unit.property.name}, unit ${unit.unitNumber}.`,
              link: `/dashboard/vendor/jobs/${request.id}`,
            },
            { req },
          );
        }
        await tellUnitTenant(
          unitId,
          {
            type: 'MAINTENANCE_STATUS',
            title: `Maintenance planned for your unit: ${request.title}`,
            body: `Your property team has arranged work in unit ${unit.unitNumber}. They will let you know about access.`,
            link: '/dashboard',
          },
          { email: false },
        );

        return NextResponse.json({ data: request }, { status: 201 });
      }

      const validated = await validateBody(req, createRequestSchema);
      if (!validated.success) return validated.response;
      const { unitId, ...rest } = validated.data;
      await assertOwnsFileUrls(rest.mediaUrls ?? [], session.sub, 'maintenance-requests');

      const activeRent = await prisma.rent.findFirst({
        where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
      });
      if (!activeRent) {
        return NextResponse.json(
          { error: 'You must have an active rent on this unit to submit a request' },
          { status: 403 },
        );
      }

      const request = await prisma.maintenanceRequest.create({
        data: { unitId, tenantId: session.sub, ...rest },
        include: { unit: { include: { property: PUBLIC_PROPERTY } } },
      });

      const recipients = [
        request.unit?.property?.managerId,
        request.unit?.property?.landlordId,
      ].filter((id): id is string => Boolean(id) && id !== session.sub);

      if (recipients.length > 0) {
        await notifyUsers(recipients, {
          type: 'MAINTENANCE_STATUS',
          title: `New Maintenance Request: ${request.title}`,
          body: `A new maintenance request was submitted for ${request.unit?.property?.name ?? 'your property'}.`,
          link: `/dashboard/maintenance/${request.id}`,
        });

        try {
          const recipientUsers = await prisma.user.findMany({
            where: { id: { in: recipients } },
            select: { email: true, name: true },
          });
          for (const u of recipientUsers) {
            await notifyByEmail(
              u.email,
              `New Maintenance Request: ${request.title}`,
              `Hi ${u.name},\n\nA new maintenance request has been submitted by a tenant.\n\nProperty: ${request.unit?.property?.name ?? 'Your Property'}\nUnit: ${request.unit?.unitNumber ?? 'General'}\nTitle: ${request.title}\nDescription: ${request.description}\n\nReview and assign a vendor in your Proplity dashboard:\n${appUrl(`/dashboard/maintenance/${request.id}`, req)}`,
            );
          }
        } catch (mailErr) {
          console.error('Failed to email maintenance recipients', mailErr);
        }
      }

      return NextResponse.json({ data: request }, { status: 201 });
    } catch (err) {
      return handleFileError(err);
    }
  },
  { roles: ['TENANT', 'MANAGER', 'LANDLORD', 'ADMIN'] },
);
