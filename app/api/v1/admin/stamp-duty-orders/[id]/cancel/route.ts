import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { notifyAndEmail } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

const cancelSchema = z
  .object({ reason: z.string().trim().min(1, 'Say why it cannot be done').max(500) })
  .strict();

/**
 * Proplity cannot stamp an order (a document the authority refused, say): the order is cancelled
 * with the reason, the agreement goes back to "not started", and a paid order is logged
 * `STAMP_DUTY_REFUND_DUE` for the whole amount so an admin returns the money. An unpaid order is
 * just withdrawn along with its invoice.
 */
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, cancelSchema);
      if (!validated.success) return validated.response;
      const found = await prisma.stampDutyOrder.findUnique({
        where: { id },
        include: { agreement: { select: { rentId: true } } },
      });
      if (!found) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${found.agreement.rentId} FOR UPDATE`;
        const order = await tx.stampDutyOrder.findUnique({ where: { id } });
        if (!order || (order.status !== 'PAID' && order.status !== 'AWAITING_PAYMENT')) {
          return { ok: false } as const;
        }
        const wasPaid = order.status === 'PAID';
        await tx.stampDutyOrder.update({
          where: { id },
          data: { status: 'CANCELLED', cancelReason: validated.data.reason },
        });
        if (wasPaid) {
          await tx.rentAgreement.update({
            where: { id: order.agreementId },
            data: { stampDutyStatus: 'NOT_STARTED', stampDutyAmount: null, stampedAt: null },
          });
        } else {
          await tx.invoice.update({
            where: { id: order.invoiceId },
            data: { status: 'CANCELLED' },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: wasPaid ? 'STAMP_DUTY_REFUND_DUE' : 'STAMP_DUTY_ORDER_CANCELLED',
            entityType: 'StampDutyOrder',
            entityId: id,
            metadata: {
              amount: wasPaid ? order.total : 0,
              invoiceId: order.invoiceId,
              requestedById: order.requestedById,
              reason: validated.data.reason,
            } as object,
          },
        });
        return { ok: true, order, wasPaid } as const;
      });
      if (!outcome.ok) {
        return NextResponse.json(
          { error: 'Only an order that is waiting or paid can be cancelled', code: 'NOT_OPEN' },
          { status: 409 },
        );
      }
      if (outcome.wasPaid) {
        await notifyAndEmail(outcome.order.requestedById, {
          title: 'Stamp duty could not be done',
          body: `Proplity could not stamp the rent agreement: ${validated.data.reason}. Your payment of ₦${outcome.order.total.toLocaleString()} will be refunded.`,
          link: `/dashboard/tenants/${found.agreement.rentId}`,
        });
      }
      return NextResponse.json({ data: { id, status: 'CANCELLED', refundDue: outcome.wasPaid } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
