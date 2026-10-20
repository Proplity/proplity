import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleFileError } from '@/lib/api/fileErrors';
import { validateBody } from '@/lib/api/validate';
import { safeUrl } from '@/lib/api/urlField';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

// The tenant's answer once the vendor says a repair is done. It never touches payment: the
// vendor's invoice is payable whatever the tenant says.
const answerSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('CONFIRMED') }),
  z.object({
    outcome: z.literal('DISPUTED'),
    reason: z.string().trim().min(5, 'Say what is still wrong, in a few words').max(2000),
    photoUrls: z.array(safeUrl).max(6).optional(),
  }),
]);

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const request = await prisma.maintenanceRequest.findUnique({
        where: { id },
        include: { unit: { include: { property: true } }, tenant: { select: { name: true } } },
      });
      if (!request)
        return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
      if (request.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, answerSchema);
      if (!validated.success) return validated.response;
      const answer = validated.data;

      if (request.status !== 'COMPLETED' || request.confirmationStatus !== 'AWAITING_TENANT') {
        return NextResponse.json(
          { error: 'This repair is not waiting for your answer', code: 'NOT_AWAITING_TENANT' },
          { status: 409 },
        );
      }

      const disputed = answer.outcome === 'DISPUTED';
      const photoUrls = disputed ? (answer.photoUrls ?? []) : [];
      await assertOwnsFileUrls(photoUrls, session.sub, 'maintenance-requests');

      // Only one answer can land: the claim matches while the repair is still waiting.
      const claimed = await prisma.maintenanceRequest.updateMany({
        where: { id, status: 'COMPLETED', confirmationStatus: 'AWAITING_TENANT' },
        data: disputed
          ? {
              confirmationStatus: 'DISPUTED',
              confirmationRespondedAt: new Date(),
              disputeReason: answer.reason,
              disputePhotoUrls: photoUrls,
              // A dispute puts any earlier sign-off back in question.
              approvedAt: null,
              approvedById: null,
            }
          : {
              confirmationStatus: 'CONFIRMED',
              confirmationRespondedAt: new Date(),
              disputeReason: null,
              disputePhotoUrls: [],
            },
      });
      if (claimed.count === 0) {
        return NextResponse.json(
          { error: 'This repair is not waiting for your answer', code: 'NOT_AWAITING_TENANT' },
          { status: 409 },
        );
      }

      const managerLink = `/dashboard/maintenance/${id}`;
      if (disputed) {
        // The property team decides what happens next, so they get an email as well.
        await notifyPropertyTeam(
          request.unit.property,
          {
            type: 'MAINTENANCE_STATUS',
            title: `Repair not fixed: ${request.title}`,
            body: `${request.tenant?.name ?? 'The tenant'} says "${request.title}" is still a problem: ${answer.reason}. Send it back to the vendor, give it to another vendor, or approve it anyway.`,
            link: managerLink,
          },
          { req },
        );
      } else {
        await notifyPropertyTeam(
          request.unit.property,
          {
            type: 'MAINTENANCE_STATUS',
            title: `Tenant confirmed: ${request.title}`,
            body: `${request.tenant?.name ?? 'The tenant'} confirmed "${request.title}" is fixed.`,
            link: managerLink,
          },
          { email: false },
        );
        if (request.vendorId) {
          await notifyAndEmail(
            request.vendorId,
            {
              type: 'MAINTENANCE_STATUS',
              title: `Tenant confirmed: ${request.title}`,
              body: `The tenant confirmed your work on "${request.title}".`,
              link: `/dashboard/vendor/jobs/${id}`,
            },
            { email: false },
          );
        }
      }

      const updated = await prisma.maintenanceRequest.findUnique({ where: { id } });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleFileError(err);
    }
  },
  { roles: ['TENANT'] },
);
