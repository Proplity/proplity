import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvoiceStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

function loadInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { paidAt: 'desc' } },
      lease: { include: { unit: { include: { property: true } } } },
      maintenanceRequest: { include: { unit: { include: { property: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

type InvoiceWithAccessContext = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

function canAccessInvoice(session: { sub: string; role: Role }, invoice: InvoiceWithAccessContext) {
  if (session.role === 'ADMIN') return true;
  if (invoice.userId === session.sub) return true;

  if (invoice.lease) {
    if (invoice.lease.tenantId === session.sub) return true;
    if (canManageProperty(session, invoice.lease.unit.property)) return true;
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

const patchSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
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
      const property = invoice.lease?.unit.property ?? invoice.maintenanceRequest?.unit.property;
      const canManage = session.role === 'ADMIN' || (!!property && canManageProperty(session, property));
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.invoice.update({ where: { id }, data: validated.data });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);
