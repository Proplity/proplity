import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAndEmail, notifyUser } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

// A payment that did not go through the payment provider -- cash handed over,
// a bank transfer or a cheque (ISS-053). The invoice status follows from the
// payments recorded, and every entry is written to the audit log with who
// recorded it.
//
// This route is only for an invoice that belongs to no rent and no repair (an account
// holder's own invoice, which only an admin can reach). Money a tenant owes, or that is paid to a
// vendor, is recorded as a transfer (POST /bank-transfers), which keeps the proof, issues the
// receipt and, unless an admin switched the two-person rule off for that kind of money, waits for
// someone other than the person who recorded it to confirm it (ISS-117).
const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          rent: { include: { unit: { include: { property: true } } } },
          maintenanceRequest: { include: { unit: { include: { property: true } } } },
        },
      });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const property = invoice.rent?.unit.property ?? invoice.maintenanceRequest?.unit.property;
      if (session.role !== 'ADMIN' && !(property && canManageProperty(session, property))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (invoice.rentId || invoice.maintenanceRequestId) {
        return NextResponse.json(
          {
            error:
              'A tenant or vendor invoice is recorded as paid another way (it keeps the proof and issues a receipt), not through this route.',
          },
          { status: 409 },
        );
      }

      const validated = await validateBody(req, schema);
      if (!validated.success) return validated.response;
      const { amount, method, reference, paidAt, notes } = validated.data;

      let result: { status: string; paidTotal: number; paymentId: string };
      try {
        result = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
          const current = await tx.invoice.findUniqueOrThrow({ where: { id } });
          if (current.status === 'CANCELLED') throw new Error('CANCELLED');
          const { _sum } = await tx.payment.aggregate({
            where: { invoiceId: id },
            _sum: { amount: true },
          });
          const outstanding = Math.round((current.amount - (_sum.amount ?? 0)) * 100) / 100;
          if (outstanding <= 0) throw new Error('ALREADY_PAID');
          if (amount > outstanding) throw new Error(`TOO_MUCH:${outstanding}`);

          const created = await tx.payment.create({
            data: {
              invoiceId: id,
              amount,
              paymentMethod: method,
              provider: method,
              transactionRef: reference || null,
              paidAt: paidAt ? new Date(paidAt) : new Date(),
              notes: notes || null,
            },
          });
          const paidTotal = (_sum.amount ?? 0) + amount;
          const status = paidTotal >= current.amount - 0.005 ? 'PAID' : 'PARTIALLY_PAID';
          await tx.invoice.update({ where: { id }, data: { status } });
          await tx.auditLog.create({
            data: {
              actorId: session.sub,
              action: 'PAYMENT_RECORDED_MANUALLY',
              entityType: 'Invoice',
              entityId: id,
              metadata: { amount, method, reference: reference ?? null, status, paidTotal },
            },
          });
          return { status, paidTotal, paymentId: created.id };
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'CANCELLED')
          return NextResponse.json({ error: 'This invoice was cancelled' }, { status: 409 });
        if (msg === 'ALREADY_PAID')
          return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });
        if (msg.startsWith('TOO_MUCH:'))
          return NextResponse.json(
            { error: `Amount is more than the outstanding balance of ₦${msg.slice(9)}` },
            { status: 400 },
          );
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          return NextResponse.json(
            { error: 'A payment with that reference is already recorded' },
            { status: 409 },
          );
        throw err;
      }

      if (invoice.rent?.tenantId) {
        await notifyUser(invoice.rent.tenantId, {
          type: 'SYSTEM',
          title: 'Payment recorded',
          body: `A payment of ₦${amount.toLocaleString()} was recorded on your account.`,
          link: `/receipts/${result.paymentId}`,
        });
      }
      // A vendor's invoice paid by hand: the vendor is told, with the receipt.
      if (invoice.maintenanceRequest?.vendorId) {
        await notifyAndEmail(invoice.maintenanceRequest.vendorId, {
          type: 'SYSTEM',
          title: `Payment received: ${invoice.invoiceNumber}`,
          body: `₦${amount.toLocaleString()} was recorded as paid on your invoice ${invoice.invoiceNumber}. Open the receipt to view or print it.`,
          link: `/receipts/${result.paymentId}`,
        });
      }

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
