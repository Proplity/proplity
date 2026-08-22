import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentProvider, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

export const GET = withAuth(
  async (req, { session }) => {
    try {
      const leaseId = req.nextUrl.searchParams.get('leaseId');
      const where: Prisma.AutoPayMandateWhereInput = {
        lease: { tenantId: session.sub },
        status: 'ACTIVE',
        ...(leaseId ? { leaseId } : {}),
      };

      const mandates = await prisma.autoPayMandate.findMany({ where, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ data: mandates });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);

const createMandateSchema = z.object({
  leaseId: z.string(),
  // Provider-side token only -- schema comment is explicit that raw card/
  // account data is never stored here.
  paymentMethodToken: z.string().min(1),
  provider: z.nativeEnum(PaymentProvider).optional(),
  nextChargeDate: z.coerce.date().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createMandateSchema);
      if (!validated.success) return validated.response;
      const { leaseId, ...rest } = validated.data;

      const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
      if (lease.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const mandate = await prisma.autoPayMandate.create({ data: { leaseId, ...rest } });
      return NextResponse.json({ data: mandate }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);

export const DELETE = withAuth(
  async (req, { session }) => {
    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 });

      const mandate = await prisma.autoPayMandate.findUnique({ where: { id }, include: { lease: true } });
      if (!mandate) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
      if (mandate.lease.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Soft-cancel only, consistent with the codebase's archive-over-delete
      // convention -- never a hard delete of the mandate row.
      const updated = await prisma.autoPayMandate.update({ where: { id }, data: { status: 'CANCELLED' } });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
