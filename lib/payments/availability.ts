import { paymentsMockEnabled } from '@/lib/payments/mockGateway';

/**
 * Whether a card payment can be started: a Paystack key is set, or the local mock gateway is on
 * (never on a real deployment, see `mockGateway.ts`). The key is read per request, so adding
 * `PAYSTACK_SECRET_KEY` turns card payments on without a rebuild. Until then, screens say so
 * instead of offering a button that can only fail (ISS-010).
 */
export function cardPaymentsAvailable(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY) || paymentsMockEnabled();
}

export const CARD_PAYMENTS_UNAVAILABLE_MESSAGE =
  "Card payments aren't available yet. Please pay another way (bank transfer or cash) instead.";
