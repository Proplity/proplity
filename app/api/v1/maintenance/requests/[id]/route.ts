import { NextResponse } from 'next/server';
import { PUBLIC_PAYMENT_SELECT } from '@/lib/api/paymentSelect';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { handleFileError } from '@/lib/api/fileErrors';
import { z } from 'zod';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, PROPERTY_OMIT_INTERNAL } from '@/lib/api/propertyAccess';
import { notifyUser, notifyUsers } from '@/lib/notifications';
import { safeUrl } from '@/lib/api/urlField';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  EVIDENCE_REQUIRED,
  MAX_EVIDENCE_PHOTOS,
  OPEN_STATUSES,
  completionData,
  evidenceRequired,
  lacksEvidence,
  isOpenStatus,
  syncThreadVendor,
  tellTenantRepairDone,
  vendorProblem,
} from '@/lib/maintenanceFlow';

type RouteCtx = { params: Promise<{ id: string }> };

// Only what a screen shows about the people on a job. These used to be `true`, which returned
// whole user rows (password hash, ID document link, emergency contact) to everyone who could open
// the request.
const PERSON = { id: true, name: true, email: true, phoneNumber: true } as const;

function loadRequest(id: string) {
  return prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      unit: {
        include: {
          property: {
            omit: PROPERTY_OMIT_INTERNAL,
            include: {
              manager: { select: { id: true, name: true, phoneNumber: true, email: true } },
            },
          },
        },
      },
      category: true,
      vendor: { select: PERSON },
      tenant: { select: PERSON },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      conversation: true,
      vendorRating: true,
      invoices: {
        where: { type: 'MAINTENANCE' },
        orderBy: { createdAt: 'desc' },
        include: { payments: { select: PUBLIC_PAYMENT_SELECT, orderBy: { paidAt: 'desc' } } },
      },
    },
  });
}

// Skips notifying when the tenant is the one who made the change (e.g. a
// self-cancel) -- nobody needs to be told about an action they just took.
function notifyTenantOfStatus(
  request: { id: string; tenantId: string | null; title: string },
  actorId: string,
  body: string,
) {
  // A work order has no tenant to tell.
  if (!request.tenantId || actorId === request.tenantId) return Promise.resolve();
  return notifyUser(request.tenantId, {
    type: 'MAINTENANCE_STATUS',
    title: `Maintenance update: ${request.title}`,
    body,
    link: `/dashboard/maintenance/${request.id}`,
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const request = await loadRequest(id);
    if (!request)
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && request.tenantId === session.sub;
    const isAssignedVendor = session.role === 'VENDOR' && request.vendorId === session.sub;
    const canManage = canManageProperty(session, request.unit.property);

    if (!isOwnerTenant && !isAssignedVendor && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // A vendor needs the tenant's name and phone to arrange access, not their email address.
    const tenant =
      request.tenant && isAssignedVendor ? { ...request.tenant, email: '' } : request.tenant;

    // Tells the vendor's screen whether sending an invoice will also close the job, so it can ask
    // for the finished-work photos first.
    const { autoCompleteMaintenanceOnInvoice } = await getSystemSettings();

    return NextResponse.json({
      data: {
        ...request,
        tenant,
        workflow: {
          autoCompleteOnInvoice: autoCompleteMaintenanceOnInvoice,
          evidenceRequired: evidenceRequired(),
        },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});

const evidenceList = z.array(safeUrl).max(MAX_EVIDENCE_PHOTOS);

const patchSchema = z.object({
  categoryId: z.string().nullable().optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  vendorId: z.string().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  completionProofUrl: safeUrl.optional(),
  finalCost: z.number().min(0).max(1_000_000_000).optional(),
  vendorNotes: z.string().optional(),
  // The vendor's photos of the work. Each list replaces the stored one.
  beforePhotoUrls: evidenceList.optional(),
  afterPhotoUrls: evidenceList.optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const request = await loadRequest(id);
    if (!request)
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });

    const validated = await validateBody(req, patchSchema);
    if (!validated.success) return validated.response;
    const {
      categoryId,
      priority,
      vendorId,
      scheduledFor,
      status,
      completionProofUrl,
      finalCost,
      vendorNotes,
      beforePhotoUrls,
      afterPhotoUrls,
    } = validated.data;

    const canManage = canManageProperty(session, request.unit.property);
    const isAssignedVendor = session.role === 'VENDOR' && request.vendorId === session.sub;

    // Photos of the work belong to the assigned vendor, and stop changing once the repair is signed
    // off (the tenant confirmed it or the property team approved it).
    const touchesEvidence = beforePhotoUrls !== undefined || afterPhotoUrls !== undefined;
    if (touchesEvidence) {
      if (!isAssignedVendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (request.status === 'CANCELLED') {
        return NextResponse.json({ error: 'This request was cancelled' }, { status: 409 });
      }
      if (request.approvedAt || request.confirmationStatus === 'CONFIRMED') {
        return NextResponse.json(
          { error: 'This repair has been signed off, so its photos can no longer change.' },
          { status: 409 },
        );
      }
    }
    // Who may attach a file is decided first; only then is the file itself checked to be theirs.
    await assertOwnsFileUrls(
      [completionProofUrl, ...(beforePhotoUrls ?? []), ...(afterPhotoUrls ?? [])],
      session.sub,
      'maintenance-requests',
    );
    const evidenceData = {
      ...(beforePhotoUrls !== undefined ? { beforePhotoUrls } : {}),
      ...(afterPhotoUrls !== undefined ? { afterPhotoUrls } : {}),
    };

    const isTriage =
      categoryId !== undefined ||
      priority !== undefined ||
      vendorId !== undefined ||
      scheduledFor !== undefined;

    // Triage: MANAGER/LANDLORD/ADMIN assign category, priority, vendor, schedule.
    if (isTriage) {
      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      // A finished or cancelled job changes hands through the review step (a disputed repair can
      // be reassigned there), not by quietly swapping the vendor.
      if (
        vendorId !== undefined &&
        vendorId !== request.vendorId &&
        !isOpenStatus(request.status)
      ) {
        return NextResponse.json(
          { error: 'This request is closed, so its vendor cannot be changed here.' },
          { status: 409 },
        );
      }

      if (vendorId) {
        const problem = await vendorProblem(vendorId);
        if (problem) return problem;
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        // Handing a new request to a vendor makes it a scheduled job: that is the
        // state the vendor's job page can start from, and the manager board shows.
        data: {
          categoryId,
          priority,
          vendorId,
          scheduledFor,
          ...(vendorId && request.status === 'SUBMITTED' ? { status: 'SCHEDULED' as const } : {}),
        },
      });
      if (vendorId !== undefined) await syncThreadVendor(id, vendorId, request.vendorId);
      await notifyTenantOfStatus(
        request,
        session.sub,
        vendorId !== undefined
          ? `A vendor has been assigned to your request "${request.title}".`
          : `Your request "${request.title}" has been updated.`,
      );

      if (vendorId && vendorId !== session.sub) {
        await notifyUser(vendorId, {
          type: 'MAINTENANCE_STATUS',
          title: `New Job Assigned: ${request.title}`,
          body: `You have been assigned to maintenance request "${request.title}".`,
          link: `/dashboard/vendor/jobs/${request.id}`,
        });
      }

      return NextResponse.json({ data: updated });
    }

    // Cancel: MANAGER/LANDLORD/ADMIN, or the TENANT who owns the request. Only an open request can
    // be cancelled: a finished one has a vendor's work and invoice behind it.
    if (status === 'CANCELLED') {
      const isOwnerTenant = session.role === 'TENANT' && request.tenantId === session.sub;
      if (!canManage && !isOwnerTenant) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!isOpenStatus(request.status)) {
        return NextResponse.json(
          { error: `A ${request.status.toLowerCase()} request cannot be cancelled` },
          { status: 409 },
        );
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await notifyTenantOfStatus(
        request,
        session.sub,
        `Your request "${request.title}" was cancelled.`,
      );
      return NextResponse.json({ data: updated });
    }

    // Progress/completion: only the assigned VENDOR, and only on a job that is still open.
    if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
      if (!isAssignedVendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!isOpenStatus(request.status)) {
        return NextResponse.json(
          { error: `This job is already ${request.status.toLowerCase()}` },
          { status: 409 },
        );
      }

      if (status === 'COMPLETED') {
        // A job that was sent back is finished again at the cost already billed.
        const cost = finalCost ?? request.finalCost ?? undefined;
        if (cost === undefined) {
          return NextResponse.json(
            { error: 'finalCost is required to complete a request' },
            { status: 400 },
          );
        }
        const after = afterPhotoUrls ?? request.afterPhotoUrls;
        const proof = completionProofUrl ?? request.completionProofUrl;
        if (lacksEvidence({ afterPhotoUrls: after, completionProofUrl: proof })) {
          return NextResponse.json(EVIDENCE_REQUIRED, { status: 400 });
        }

        const data = {
          ...(await completionData(request)),
          ...evidenceData,
          // Older screens read the single proof link, so keep it filled from the first photo.
          completionProofUrl: proof ?? after[0],
          finalCost: cost,
        };

        // Claim the job and write the invoice together: the claim only matches while the job is
        // still open, so two simultaneous completions cannot both go through.
        const updated = await prisma.$transaction(async (tx) => {
          const claimed = await tx.maintenanceRequest.updateMany({
            where: { id, status: { in: [...OPEN_STATUSES] } },
            data,
          });
          if (claimed.count === 0) return null;

          // Skipped when the vendor already sent a live invoice for this job (one invoice per
          // job, ISS-051) or when there is nothing to bill.
          const alreadyInvoiced = await tx.invoice.findFirst({
            where: { maintenanceRequestId: id, type: 'MAINTENANCE', status: { not: 'CANCELLED' } },
            select: { id: true },
          });
          if (!alreadyInvoiced && cost > 0) {
            // maintenanceRequestId satisfies Invoice's "at least one of
            // rentId/maintenanceRequestId/userId" rule.
            await tx.invoice.create({
              data: {
                maintenanceRequestId: id,
                type: 'MAINTENANCE',
                amount: cost,
                dueDate: new Date(),
                description: `Maintenance: ${request.title}`,
              },
            });
          }
          return tx.maintenanceRequest.findUnique({ where: { id } });
        });
        if (!updated) {
          return NextResponse.json({ error: 'This job is already closed' }, { status: 409 });
        }

        await tellTenantRepairDone(request, data.confirmationStatus === 'AWAITING_TENANT', req);

        const property = request.unit?.property;
        const managersToNotify = [property?.managerId, property?.landlordId].filter(
          (id): id is string => Boolean(id) && id !== session.sub,
        );
        if (managersToNotify.length > 0) {
          await notifyUsers(managersToNotify, {
            type: 'MAINTENANCE_STATUS',
            title: `Maintenance Request Completed: ${request.title}`,
            body: `Work on "${request.title}" has been completed by the vendor.`,
            link: `/dashboard/maintenance/${request.id}`,
          });
        }

        return NextResponse.json({ data: updated });
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          ...(vendorNotes !== undefined ? { vendorNotes } : {}),
          ...evidenceData,
        },
      });
      await notifyTenantOfStatus(
        request,
        session.sub,
        `Work has started on your request "${request.title}".`,
      );
      return NextResponse.json({ data: updated });
    }

    // Notes and photos only: the assigned vendor leaving a progress note or adding photos without
    // changing status (e.g. a request already IN_PROGRESS).
    if (vendorNotes !== undefined || touchesEvidence) {
      if (!isAssignedVendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await prisma.maintenanceRequest.update({
        where: { id },
        data: { ...(vendorNotes !== undefined ? { vendorNotes } : {}), ...evidenceData },
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
  } catch (err) {
    return handleFileError(err);
  }
});
