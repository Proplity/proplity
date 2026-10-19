import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAndEmail, notifyUser } from '@/lib/notifications';
import { syncThreadVendor, vendorProblem } from '@/lib/maintenanceFlow';

type RouteCtx = { params: Promise<{ id: string }> };

// What the property team does with a finished repair: sign it off, or (when the tenant says it is
// not fixed) send it back to the same vendor or give it to another one. None of this decides
// payment; the vendor's invoice stays payable on its own terms.
const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE') }),
  z.object({ action: z.literal('REOPEN'), note: z.string().trim().max(1000).optional() }),
  z.object({
    action: z.literal('REASSIGN'),
    vendorId: z.string().min(1),
    note: z.string().trim().max(1000).optional(),
  }),
]);

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const request = await prisma.maintenanceRequest.findUnique({
        where: { id },
        include: {
          unit: { include: { property: true } },
          invoices: {
            where: { type: 'MAINTENANCE', status: { not: 'CANCELLED' } },
            include: { payments: { select: { amount: true } } },
          },
        },
      });
      if (!request)
        return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
      if (!canManageProperty(session, request.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, reviewSchema);
      if (!validated.success) return validated.response;
      const input = validated.data;

      if (request.status !== 'COMPLETED') {
        return NextResponse.json(
          { error: 'Only a finished repair can be reviewed', code: 'NOT_COMPLETED' },
          { status: 409 },
        );
      }

      // ── Approve ────────────────────────────────────────────────────────────
      if (input.action === 'APPROVE') {
        const claimed = await prisma.maintenanceRequest.updateMany({
          where: { id, status: 'COMPLETED', approvedAt: null },
          data: { approvedAt: new Date(), approvedById: session.sub },
        });
        if (claimed.count === 0) {
          return NextResponse.json(
            { error: 'This repair is already approved', code: 'ALREADY_APPROVED' },
            { status: 409 },
          );
        }
        await notifyUser(request.tenantId, {
          type: 'MAINTENANCE_STATUS',
          title: `Repair approved: ${request.title}`,
          body: `Your property team signed off on "${request.title}".`,
          link: `/dashboard/maintenance/${id}`,
        });
        if (request.vendorId) {
          await notifyUser(request.vendorId, {
            type: 'MAINTENANCE_STATUS',
            title: `Work approved: ${request.title}`,
            body: `The property team approved your work on "${request.title}".`,
            link: `/dashboard/vendor/jobs/${id}`,
          });
        }
        return NextResponse.json({
          data: await prisma.maintenanceRequest.findUnique({ where: { id } }),
        });
      }

      // ── Send back / reassign: only for a repair the tenant disputed ────────
      if (request.confirmationStatus !== 'DISPUTED' || request.approvedAt) {
        return NextResponse.json(
          {
            error: 'Only a repair the tenant disputed, and that is not yet approved, can be redone',
            code: 'NOT_DISPUTED',
          },
          { status: 409 },
        );
      }
      if (!request.vendorId) {
        return NextResponse.json({ error: 'This repair has no vendor' }, { status: 409 });
      }

      // The job is open again and its sign-offs are cleared. The tenant's reason and photos stay,
      // so whoever does the work can read them; they are cleared when the job is finished again.
      const reopened = {
        completedAt: null,
        confirmationStatus: 'NOT_REQUESTED' as const,
        confirmationRespondedAt: null,
        approvedAt: null,
        approvedById: null,
      };
      const reason = request.disputeReason ?? 'the tenant says it is not fixed';
      const note = input.note ? ` Note from the property team: ${input.note}` : '';

      if (input.action === 'REOPEN') {
        const claimed = await prisma.maintenanceRequest.updateMany({
          where: { id, status: 'COMPLETED', confirmationStatus: 'DISPUTED', approvedAt: null },
          data: { ...reopened, status: 'IN_PROGRESS' },
        });
        if (claimed.count === 0) {
          return NextResponse.json({ error: 'This repair changed, try again' }, { status: 409 });
        }
        await notifyAndEmail(
          request.vendorId,
          {
            type: 'MAINTENANCE_STATUS',
            title: `Repair sent back to you: ${request.title}`,
            body: `The tenant says "${request.title}" is still a problem: ${reason}.${note} Please fix it and mark the work done again.`,
            link: `/dashboard/vendor/jobs/${id}`,
          },
          { req },
        );
        await notifyUser(request.tenantId, {
          type: 'MAINTENANCE_STATUS',
          title: `Repair sent back: ${request.title}`,
          body: `Your property team sent "${request.title}" back to the vendor to be fixed.`,
          link: `/dashboard/maintenance/${id}`,
        });
        return NextResponse.json({
          data: await prisma.maintenanceRequest.findUnique({ where: { id } }),
        });
      }

      // REASSIGN
      if (input.vendorId === request.vendorId) {
        return NextResponse.json(
          { error: 'That vendor already has this job. Use "Send back to vendor" instead.' },
          { status: 400 },
        );
      }
      const problem = await vendorProblem(input.vendorId);
      if (problem) return problem;

      // The first vendor's bill is for work the tenant disputed. An unpaid one is cancelled so the
      // new vendor can bill the job; one that has been paid (even in part) cannot be quietly
      // cancelled, so the property team decides that first.
      const paid = request.invoices.find(
        (inv) =>
          inv.payments.length > 0 || inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID',
      );
      if (paid) {
        return NextResponse.json(
          {
            error: `Invoice ${paid.invoiceNumber} has already been paid, so the job cannot move to another vendor. Send it back to the same vendor or approve it.`,
            code: 'INVOICE_HAS_PAYMENTS',
          },
          { status: 409 },
        );
      }

      const previousVendorId = request.vendorId;
      const moved = await prisma.$transaction(async (tx) => {
        const claimed = await tx.maintenanceRequest.updateMany({
          where: { id, status: 'COMPLETED', confirmationStatus: 'DISPUTED', approvedAt: null },
          data: {
            ...reopened,
            status: 'SCHEDULED',
            vendorId: input.vendorId,
            // The new vendor starts clean: the first vendor's photos, cost and notes were theirs.
            beforePhotoUrls: [],
            afterPhotoUrls: [],
            completionProofUrl: null,
            finalCost: null,
            vendorNotes: null,
          },
        });
        if (claimed.count === 0) return false;
        for (const inv of request.invoices) {
          await tx.invoice.update({ where: { id: inv.id }, data: { status: 'CANCELLED' } });
          await tx.auditLog.create({
            data: {
              actorId: session.sub,
              action: 'INVOICE_CANCELLED_ON_REASSIGN',
              entityType: 'Invoice',
              entityId: inv.id,
              metadata: {
                invoiceNumber: inv.invoiceNumber,
                amount: inv.amount,
                maintenanceRequestId: id,
                fromVendorId: previousVendorId,
                toVendorId: input.vendorId,
              },
            },
          });
        }
        return true;
      });
      if (!moved) {
        return NextResponse.json({ error: 'This repair changed, try again' }, { status: 409 });
      }

      await syncThreadVendor(id, input.vendorId, previousVendorId);
      await notifyAndEmail(
        input.vendorId,
        {
          type: 'MAINTENANCE_STATUS',
          title: `New Job Assigned: ${request.title}`,
          body: `You have been assigned to "${request.title}". The tenant reported a problem with the earlier work: ${reason}.${note}`,
          link: `/dashboard/vendor/jobs/${id}`,
        },
        { req },
      );
      await notifyUser(previousVendorId, {
        type: 'MAINTENANCE_STATUS',
        title: `Job reassigned: ${request.title}`,
        body: `"${request.title}" was given to another vendor.`,
        link: '/dashboard',
      });
      await notifyUser(request.tenantId, {
        type: 'MAINTENANCE_STATUS',
        title: `New vendor for: ${request.title}`,
        body: `Your property team gave "${request.title}" to another vendor to put right.`,
        link: `/dashboard/maintenance/${id}`,
      });
      return NextResponse.json({
        data: await prisma.maintenanceRequest.findUnique({ where: { id } }),
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD', 'ADMIN'] },
);
