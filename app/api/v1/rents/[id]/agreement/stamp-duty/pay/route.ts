import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  cardPaymentsAvailable,
} from '@/lib/payments/availability';
import { accessibleRent, currentAgreement } from '@/lib/rentAgreement';
import { liveOrder, serializeOrder, stampDutyBlock, stampDutyQuoteFor } from '@/lib/stampDutyOrder';

type RouteCtx = { params: Promise<{ id: string }> };

const off = () =>
  NextResponse.json(
    {
      error: 'Paying stamp duty through Proplity is not available',
      code: 'STAMP_DUTY_PAYMENT_OFF',
    },
    { status: 403 },
  );

/**
 * What paying stamp duty through Proplity would cost for this rent, and the order if one exists.
 * The property team and the tenant can both see it; the quote is worked out on the server from
 * the place's rates (Admin > Rent agreements > Jurisdictions) and the admin's service fee.
 */
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const access = await accessibleRent(session, id);
      if (access === 'NOT_FOUND')
        return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (access === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const settings = await getSystemSettings();
      const agreement = await currentAgreement(id);
      if (!settings.stampDutyPaymentEnabled || !agreement || agreement.status === 'DRAFT') {
        return NextResponse.json({ data: { enabled: false } });
      }
      const order = await liveOrder(agreement.id);
      const block = stampDutyBlock(agreement);
      const { quote } = await stampDutyQuoteFor(access.rent, settings.stampDutyServiceFee);
      return NextResponse.json({
        data: {
          enabled: true,
          cardsAvailable: cardPaymentsAvailable(),
          canPay: !block && quote.ok && !(order && order.status !== 'AWAITING_PAYMENT'),
          reason: block?.error ?? (quote.ok ? null : quote.error),
          quote: quote.ok ? quote : null,
          order: order ? serializeOrder(order) : null,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

/**
 * Starts paying: an order with the quote copied onto it and an unpaid invoice for the total, to be
 * paid with POST /payments/initialize. Asking again while nothing was paid reuses the order, or
 * replaces it if the rates changed. Once paid, Proplity staff stamp it and attach the receipt.
 */
export const POST = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const settings = await getSystemSettings();
      if (!settings.stampDutyPaymentEnabled) return off();
      if (!cardPaymentsAvailable()) {
        return NextResponse.json(
          { error: CARD_PAYMENTS_UNAVAILABLE_MESSAGE, code: 'CARD_PAYMENTS_UNAVAILABLE' },
          { status: 503 },
        );
      }
      const access = await accessibleRent(session, id);
      if (access === 'NOT_FOUND')
        return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (access === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const { jurisdiction, quote } = await stampDutyQuoteFor(
        access.rent,
        settings.stampDutyServiceFee,
      );
      if (!quote.ok || !jurisdiction) {
        return NextResponse.json(
          { error: quote.ok ? 'No rates' : quote.error, code: 'NO_STAMP_RATE' },
          { status: 422 },
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const agreement = await currentAgreement(id, tx);
        if (!agreement || agreement.status === 'DRAFT') {
          return {
            ok: false,
            status: 409,
            code: 'NO_AGREEMENT',
            error: 'There is no signed agreement to stamp',
          } as const;
        }
        const block = stampDutyBlock(agreement);
        if (block) return block;
        const existing = await liveOrder(agreement.id, tx);
        if (existing && existing.status !== 'AWAITING_PAYMENT') {
          return {
            ok: false,
            status: 409,
            code: existing.status === 'PAID' ? 'ALREADY_PAID' : 'ALREADY_STAMPED',
            error:
              existing.status === 'PAID'
                ? 'Stamp duty is already paid for this agreement and is being processed'
                : 'This agreement is already stamped',
          } as const;
        }
        if (existing) {
          const same = existing.total === quote.total && existing.dutyAmount === quote.dutyAmount;
          if (same && existing.requestedById === session.sub)
            return { ok: true, order: existing } as const;
          const paid = await tx.payment.count({ where: { invoiceId: existing.invoiceId } });
          if (paid > 0) {
            return {
              ok: false,
              status: 409,
              code: 'PAYMENT_IN_PROGRESS',
              error: 'A payment for this is in progress',
            } as const;
          }
          await tx.stampDutyOrder.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', cancelReason: 'Replaced by a new quote' },
          });
          await tx.invoice.update({
            where: { id: existing.invoiceId },
            data: { status: 'CANCELLED' },
          });
        }
        const invoice = await tx.invoice.create({
          data: {
            // No rentId: this is not rent, so it must stay out of the tenant's rent invoices and
            // the overdue and late-fee jobs. Only the person who asked can pay it.
            userId: session.sub,
            type: 'STAMP_DUTY',
            amount: quote.total,
            dueDate: new Date(),
            description: `Stamp duty for the rent agreement (${jurisdiction.name})`,
          },
        });
        const order = await tx.stampDutyOrder.create({
          data: {
            agreementId: agreement.id,
            requestedById: session.sub,
            invoiceId: invoice.id,
            jurisdictionName: jurisdiction.name,
            termYears: quote.termYears,
            basis: quote.basis,
            basisAmount: quote.basisAmount,
            ratePercent: quote.ratePercent,
            dutyAmount: quote.dutyAmount,
            serviceFee: quote.serviceFee,
            total: quote.total,
          },
        });
        return { ok: true, order } as const;
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status },
        );
      }
      return NextResponse.json(
        { data: { ...serializeOrder(result.order), invoiceId: result.order.invoiceId } },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
