import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { notifyAndEmail } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ orderId: string }> };

const refundedSchema = z
  .object({
    reference: z.string().trim().min(3, 'Add the transfer or Paystack reference').max(120),
  })
  .strict();

/**
 * Records that a stamp duty refund was paid back by hand. Once per order: the audit row
 * `STAMP_DUTY_REFUNDED` is the record, and the order is locked while it is checked and written so
 * two clicks cannot record it twice.
 */
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { orderId } = await ctx.params;
    try {
      const validated = await validateBody(req, refundedSchema);
      if (!validated.success) return validated.response;
      const { reference } = validated.data;

      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stamp-refund:${orderId}`}))`;
        const due = await tx.auditLog.findFirst({
          where: {
            action: 'STAMP_DUTY_REFUND_DUE',
            entityType: 'StampDutyOrder',
            entityId: orderId,
          },
        });
        if (!due) return { ok: false, status: 404, code: 'NO_REFUND_DUE' } as const;
        const already = await tx.auditLog.findFirst({
          where: { action: 'STAMP_DUTY_REFUNDED', entityType: 'StampDutyOrder', entityId: orderId },
          select: { id: true },
        });
        if (already) return { ok: false, status: 409, code: 'ALREADY_REFUNDED' } as const;
        const meta = (due.metadata ?? {}) as { amount?: number; requestedById?: string };
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'STAMP_DUTY_REFUNDED',
            entityType: 'StampDutyOrder',
            entityId: orderId,
            metadata: { reference, amount: meta.amount ?? 0 } as object,
          },
        });
        return { ok: true, amount: meta.amount ?? 0, buyerId: meta.requestedById } as const;
      });
      if (!outcome.ok) {
        const error =
          outcome.code === 'NO_REFUND_DUE'
            ? 'No refund is due for this order'
            : 'This refund was already recorded';
        return NextResponse.json({ error, code: outcome.code }, { status: outcome.status });
      }

      if (outcome.buyerId) {
        await notifyAndEmail(outcome.buyerId, {
          title: 'Your stamp duty refund was sent',
          body: `₦${outcome.amount.toLocaleString()} was refunded to you (reference ${reference}).`,
          link: '/dashboard',
        });
      }
      return NextResponse.json({ data: { orderId, amount: outcome.amount, reference } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
