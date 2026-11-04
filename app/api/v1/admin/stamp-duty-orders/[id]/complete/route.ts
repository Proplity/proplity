import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleFileError } from '@/lib/api/fileErrors';
import { validateBody } from '@/lib/api/validate';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { parseFileUrl } from '@/lib/fileRef';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

const completeSchema = z
  .object({
    reference: z.string().trim().min(1, 'Enter the reference the tax authority gave').max(120),
    actualAmount: z.number().min(0).max(1_000_000_000),
    receiptUrl: z.string().min(1).max(500),
    stampedAt: z.coerce.date().optional(),
  })
  .strict();

/**
 * Records that Proplity paid the tax authority and stamped the agreement: the order is completed
 * and the agreement shows STAMPED with the reference, the amount actually paid and the receipt,
 * which the tenant and the property team can open. If the authority charged less than was
 * collected, the difference is logged for a refund; if more, the shortfall is logged (Proplity's).
 */
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, completeSchema);
      if (!validated.success) return validated.response;
      const body = validated.data;
      if (!parseFileUrl(body.receiptUrl)) {
        return NextResponse.json(
          { error: 'Upload the receipt as a file', code: 'BAD_FILE' },
          { status: 400 },
        );
      }
      await assertOwnsFileUrls([body.receiptUrl], session.sub, 'rents');

      const found = await prisma.stampDutyOrder.findUnique({
        where: { id },
        include: { agreement: { select: { rentId: true } } },
      });
      if (!found) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${found.agreement.rentId} FOR UPDATE`;
        const order = await tx.stampDutyOrder.findUnique({ where: { id } });
        if (!order || order.status !== 'PAID') return { ok: false } as const;
        const now = new Date();
        const stampedAt = body.stampedAt ?? now;
        await tx.stampDutyOrder.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            completedById: session.sub,
            actualAmount: body.actualAmount,
            reference: body.reference,
          },
        });
        await tx.rentAgreement.update({
          where: { id: order.agreementId },
          data: {
            stampDutyStatus: 'STAMPED',
            stampDutyReference: body.reference,
            stampDutyAmount: body.actualAmount,
            stampDutyReceiptUrl: body.receiptUrl,
            stampedAt,
          },
        });
        const difference = Math.round((order.dutyAmount - body.actualAmount) * 100) / 100;
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'STAMP_DUTY_COMPLETED',
            entityType: 'StampDutyOrder',
            entityId: id,
            metadata: {
              reference: body.reference,
              quoted: order.dutyAmount,
              paidToAuthority: body.actualAmount,
            } as object,
          },
        });
        if (difference !== 0) {
          await tx.auditLog.create({
            data: {
              actorId: session.sub,
              action: difference > 0 ? 'STAMP_DUTY_REFUND_DUE' : 'STAMP_DUTY_SHORTFALL',
              entityType: 'StampDutyOrder',
              entityId: id,
              metadata: {
                amount: Math.abs(difference),
                invoiceId: order.invoiceId,
                requestedById: order.requestedById,
              } as object,
            },
          });
        }
        return { ok: true, order, difference } as const;
      });
      if (!outcome.ok) {
        return NextResponse.json(
          { error: 'Only an order that has been paid can be completed', code: 'NOT_PAID' },
          { status: 409 },
        );
      }

      const rent = await prisma.rent.findUnique({
        where: { id: found.agreement.rentId },
        include: { unit: { include: { property: true } } },
      });
      if (rent) {
        const note = {
          title: 'Rent agreement stamped',
          body: `The rent agreement for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} is stamped. The receipt is on the agreement.`,
        };
        await notifyAndEmail(
          outcome.order.requestedById,
          { ...note, link: `/dashboard/tenants/${rent.id}` },
          { email: false },
        );
        await notifyPropertyTeam(
          rent.unit.property,
          { ...note, link: `/dashboard/tenants/${rent.id}` },
          {
            email: false,
            exceptId: outcome.order.requestedById,
          },
        );
        await notifyAndEmail(rent.tenantId, { ...note, link: '/dashboard' }, { email: false });
      }
      return NextResponse.json({
        data: {
          id,
          status: 'COMPLETED',
          refundDue: outcome.difference > 0 ? outcome.difference : 0,
        },
      });
    } catch (err) {
      return handleFileError(err);
    }
  },
  { roles: ['ADMIN'] },
);
