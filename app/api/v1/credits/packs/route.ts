import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { getSystemSettings } from '@/lib/systemSettings';
import { cardPaymentsAvailable } from '@/lib/payments/availability';
import { creditBalance } from '@/lib/credits';
import { listCreditPacks } from '@/lib/creditPacks';

// The packs the signed-in account can buy, and whether buying is open: the admin's switch, and a
// card payment being possible at all. A switched-off shop lists no packs.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const settings = await getSystemSettings();
      const enabled = settings.creditPurchaseEnabled;
      const packs = enabled ? await listCreditPacks({ onlyActive: true }) : [];
      return NextResponse.json({
        data: {
          enabled,
          cardsAvailable: cardPaymentsAvailable(),
          balance: await creditBalance(session.sub),
          packs: packs.map((p) => ({
            key: p.key,
            name: p.name,
            credits: p.credits,
            price: p.price,
          })),
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
