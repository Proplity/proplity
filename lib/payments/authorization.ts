import { prisma } from '@/lib/db';

export type ReusableAuthorization = {
  authorizationCode: string;
  last4: string | null;
  cardType: string | null;
  bank: string | null;
};

// The reusable card token Paystack handed back on a lease's most recent card
// payment (Payment.rawProviderPayload keeps the signed webhook body). Auto-pay
// may only be set up with a token found here, so a made-up or someone else's
// token can never become a mandate (ISS-056).
export async function findReusableAuthorization(
  leaseId: string,
): Promise<ReusableAuthorization | null> {
  const payments = await prisma.payment.findMany({
    where: { invoice: { leaseId }, provider: 'PAYSTACK', rawProviderPayload: { not: null } },
    orderBy: { paidAt: 'desc' },
    take: 10,
  });

  for (const payment of payments) {
    try {
      const auth = JSON.parse(payment.rawProviderPayload!)?.data?.authorization;
      if (auth?.reusable && typeof auth.authorization_code === 'string') {
        return {
          authorizationCode: auth.authorization_code as string,
          last4: (auth.last4 as string | undefined) ?? null,
          cardType: (auth.card_type as string | undefined) ?? null,
          bank: (auth.bank as string | undefined) ?? null,
        };
      }
    } catch {
      // Malformed or legacy payload for this one payment -- try the next.
    }
  }
  return null;
}
