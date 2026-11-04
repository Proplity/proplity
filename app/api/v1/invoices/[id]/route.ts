import { NextResponse } from 'next/server';
import { PUBLIC_PAYMENT_SELECT } from '@/lib/api/paymentSelect';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, PUBLIC_PROPERTY } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

function loadInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      payments: { select: PUBLIC_PAYMENT_SELECT, orderBy: { paidAt: 'desc' } },
      rent: { include: { unit: { include: { property: PUBLIC_PROPERTY } } } },
      maintenanceRequest: { include: { unit: { include: { property: PUBLIC_PROPERTY } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

type InvoiceWithAccessContext = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

function canAccessInvoice(session: { sub: string; role: Role }, invoice: InvoiceWithAccessContext) {
  if (session.role === 'ADMIN') return true;
  if (invoice.userId === session.sub) return true;

  if (invoice.rent) {
    if (invoice.rent.tenantId === session.sub) return true;
    if (canManageProperty(session, invoice.rent.unit.property)) return true;
  }
  if (invoice.maintenanceRequest) {
    if (invoice.maintenanceRequest.tenantId === session.sub) return true;
    if (invoice.maintenanceRequest.vendorId === session.sub) return true;
    if (canManageProperty(session, invoice.maintenanceRequest.unit.property)) return true;
  }
  return false;
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const invoice = await loadInvoice(id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!canAccessInvoice(session, invoice)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: invoice });
  } catch (err) {
    return handleApiError(err);
  }
});

// What a manager can change by hand (ISS-053). PAID and PARTIALLY_PAID are never
// set directly: they follow from recorded payments (POST /invoices/[id]/payments).
// An invoice with payments on it keeps its amount and cannot be cancelled.
const patchSchema = z.object({
  status: z.enum(['UNPAID', 'OVERDUE', 'CANCELLED']).optional(),
  amount: z.number().positive().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const invoice = await loadInvoice(id);
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      // MANAGER may only mutate invoices tied to a property they actually
      // manage -- a userId-only invoice (e.g. SUBSCRIPTION) with no property
      // is ADMIN-only, same as an invoice on someone else's property.
      const property = invoice.rent?.unit.property ?? invoice.maintenanceRequest?.unit.property;
      const canManage =
        session.role === 'ADMIN' || (!!property && canManageProperty(session, property));
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const { status, amount } = validated.data;
      const hasPayments = invoice.payments.length > 0;
      if (hasPayments && (amount !== undefined || status !== undefined)) {
        return NextResponse.json(
          {
            error:
              'This invoice already has payments on it, so its amount and status can no longer be changed',
          },
          { status: 409 },
        );
      }
      if (invoice.status === 'CANCELLED' || invoice.status === 'PAID') {
        return NextResponse.json(
          { error: `A ${invoice.status.toLowerCase()} invoice cannot be edited` },
          { status: 409 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Payments lock the invoice row too, so a payment that lands while this edit is being
        // made cannot be followed by a cancellation or a new amount that ignores it.
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.invoice.findUniqueOrThrow({
          where: { id },
          select: { status: true, amount: true, _count: { select: { payments: true } } },
        });
        if (
          current._count.payments > 0 ||
          current.status === 'CANCELLED' ||
          current.status === 'PAID'
        ) {
          return null;
        }
        const row = await tx.invoice.update({ where: { id }, data: validated.data });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'INVOICE_EDITED',
            entityType: 'Invoice',
            entityId: id,
            metadata: {
              from: { status: current.status, amount: current.amount },
              to: { status: row.status, amount: row.amount },
            },
          },
        });
        return row;
      });
      if (!updated) {
        return NextResponse.json(
          { error: 'This invoice was just paid or closed, so it can no longer be edited' },
          { status: 409 },
        );
      }
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);
