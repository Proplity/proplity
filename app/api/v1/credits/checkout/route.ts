import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  cardPaymentsAvailable,
} from '@/lib/payments/availability';
import { ensureDefaultCreditPacks } from '@/lib/plans';
import { startCreditPurchase } from '@/lib/creditPacks';

// Server-authoritative: the price and the credits are read from the pack the admin edits, never
// from the request. The invoice this returns is paid through POST /payments/initialize; the
// credits are added when Paystack confirms the payment (the webhook), not before.
const checkoutSchema = z.object({ packKey: z.string().min(1) }).strict();

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, checkoutSchema);
      if (!validated.success) return validated.response;

      const settings = await getSystemSettings();
      if (!settings.creditPurchaseEnabled) {
        return NextResponse.json(
          { error: 'Buying credits is not available right now', code: 'CREDIT_PURCHASE_OFF' },
          { status: 403 },
        );
      }
      if (!cardPaymentsAvailable()) {
        return NextResponse.json(
          { error: CARD_PAYMENTS_UNAVAILABLE_MESSAGE, code: 'CARD_PAYMENTS_UNAVAILABLE' },
          { status: 503 },
        );
      }

      await ensureDefaultCreditPacks();
      const pack = await prisma.creditPack.findUnique({ where: { key: validated.data.packKey } });
      if (!pack || !pack.isActive) {
        return NextResponse.json({ error: 'That credit pack is not available' }, { status: 404 });
      }

      const purchase = await startCreditPurchase(session.sub, pack);
      return NextResponse.json(
        {
          data: {
            invoiceId: purchase.invoiceId,
            amount: purchase.price,
            credits: purchase.credits,
            packName: purchase.packName,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
