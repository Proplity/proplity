import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentProvider, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { findReusableAuthorization } from '@/lib/payments/authorization';

export const GET = withAuth(
  async (req, { session }) => {
    try {
      const rentId = req.nextUrl.searchParams.get('rentId');
      const where: Prisma.AutoPayMandateWhereInput = {
        rent: { tenantId: session.sub },
        status: 'ACTIVE',
        ...(rentId ? { rentId } : {}),
      };

      const mandates = await prisma.autoPayMandate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ data: mandates });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);

const createMandateSchema = z.object({
  rentId: z.string(),
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
      const { rentId, ...rest } = validated.data;

      const rent = await prisma.rent.findUnique({ where: { id: rentId } });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (rent.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (rent.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Auto-pay can only be set up on an active rent' },
          { status: 409 },
        );
      }

      // The token must be one Paystack itself gave us for a card payment on this
      // rent -- never a value the client made up or took from someone else.
      const known = await findReusableAuthorization(rentId);
      if (!known || known.authorizationCode !== rest.paymentMethodToken) {
        return NextResponse.json(
          {
            error:
              'That card is not saved for this rent. Pay one invoice by card first, then set up auto-pay with that card.',
          },
          { status: 400 },
        );
      }

      // One active mandate per rent: a new one replaces the old.
      const mandate = await prisma.$transaction(async (tx) => {
        await tx.autoPayMandate.updateMany({
          where: { rentId, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        });
        return tx.autoPayMandate.create({ data: { rentId, ...rest } });
      });
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

      const mandate = await prisma.autoPayMandate.findUnique({
        where: { id },
        include: { rent: true },
      });
      if (!mandate) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
      if (mandate.rent.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Soft-cancel only, consistent with the codebase's archive-over-delete
      // convention -- never a hard delete of the mandate row.
      const updated = await prisma.autoPayMandate.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
