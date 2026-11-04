import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

const statusSchema = z.enum(['DUE', 'REFUNDED', 'ALL']);

type DueMeta = { amount?: number; invoiceId?: string; requestedById?: string; reason?: string };
type RefundedMeta = { reference?: string };

// Stamp duty money Proplity owes back: a paid order that was cancelled (the whole payment) or one
// stamped for less than quoted (the difference). Refunds are paid by hand; this list is where an
// admin sees what is owed and records that it was paid. The audit rows are the record.
export const GET = withAuth(
  async (req) => {
    try {
      const parsed = statusSchema.safeParse(req.nextUrl.searchParams.get('status') ?? 'DUE');
      if (!parsed.success) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });

      const dues = await prisma.auditLog.findMany({
        where: { action: 'STAMP_DUTY_REFUND_DUE', entityType: 'StampDutyOrder' },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      const orderIds = dues.map((d) => d.entityId);
      const [paid, orders] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            action: 'STAMP_DUTY_REFUNDED',
            entityType: 'StampDutyOrder',
            entityId: { in: orderIds },
          },
        }),
        prisma.stampDutyOrder.findMany({
          where: { id: { in: orderIds } },
          include: {
            invoice: { select: { invoiceNumber: true } },
            agreement: {
              select: {
                rentId: true,
                rent: {
                  select: {
                    unit: { select: { unitNumber: true, property: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        }),
      ]);
      const buyerIds = [
        ...new Set(dues.map((d) => (d.metadata as DueMeta | null)?.requestedById ?? '')),
      ].filter(Boolean);
      const buyers = await prisma.user.findMany({
        where: { id: { in: buyerIds } },
        select: { id: true, name: true, email: true },
      });

      const rows = dues
        .map((due) => {
          const meta = (due.metadata ?? {}) as DueMeta;
          const order = orders.find((o) => o.id === due.entityId);
          const settled = paid.find((p) => p.entityId === due.entityId);
          return {
            orderId: due.entityId,
            amount: meta.amount ?? 0,
            reason: meta.reason ?? order?.cancelReason ?? 'Stamped for less than quoted',
            dueAt: due.createdAt,
            invoiceNumber: order?.invoice.invoiceNumber ?? null,
            rentId: order?.agreement.rentId ?? null,
            unit: order
              ? `Unit ${order.agreement.rent.unit.unitNumber}, ${order.agreement.rent.unit.property.name}`
              : null,
            buyer: buyers.find((b) => b.id === meta.requestedById) ?? null,
            refunded: settled
              ? {
                  at: settled.createdAt,
                  reference: (settled.metadata as RefundedMeta | null)?.reference ?? '',
                }
              : null,
          };
        })
        .filter((r) =>
          parsed.data === 'ALL' ? true : parsed.data === 'DUE' ? !r.refunded : !!r.refunded,
        );
      return NextResponse.json({ data: rows });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
