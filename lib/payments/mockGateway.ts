import crypto from 'crypto';

// Off by default, same pattern as emailInboxEnabled()/subscriptionsEnabled().
// Deliberately ALSO requires PAYSTACK_SECRET_KEY to be unset (see the two
// call sites in app/api/v1/payments/{initialize,webhook}/route.ts) -- a
// real deployment that has a real key configured must never fall back to
// the mock just because this flag was left on by mistake.
export function paymentsMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED === 'true';
}

// Stands in for PAYSTACK_SECRET_KEY on both ends of the mock round trip:
// app/dev/mock-checkout signs its fake webhook call with this, and
// payments/webhook verifies against it -- only ever reached when there's no
// real secret key configured, so this never substitutes for a real one.
export const MOCK_PAYSTACK_SECRET = 'sk_test_mock_paystack_secret_for_local_testing_only';

export function signMockPayload(rawBody: string): string {
  return crypto.createHmac('sha512', MOCK_PAYSTACK_SECRET).update(rawBody).digest('hex');
}

// Shaped like a real Paystack `charge.success` webhook `data` object --
// see docs/testing-guide.md's note on this mock for what's verified vs.
// invented. Only the fields payments/webhook/route.ts actually reads
// (reference, amount, channel, paid_at, metadata.invoiceId) are load-
// bearing; the rest exists so the payload looks like the real thing to
// anyone inspecting it, not because our own code consumes it.
export function buildMockChargePayload({
  reference,
  invoiceId,
  amountKobo,
  email,
  outcome,
}: {
  reference: string;
  invoiceId: string;
  amountKobo: number;
  email: string;
  outcome: 'success' | 'failed';
}) {
  const now = new Date().toISOString();
  const status = outcome === 'success' ? 'success' : 'failed';

  return {
    event: outcome === 'success' ? 'charge.success' : 'charge.failed',
    data: {
      id: Math.floor(Date.now() / 1000),
      domain: 'test',
      status,
      reference,
      amount: amountKobo,
      message: outcome === 'success' ? null : 'Declined',
      gateway_response: outcome === 'success' ? 'Successful' : 'Declined',
      paid_at: outcome === 'success' ? now : null,
      created_at: now,
      channel: 'card',
      currency: 'NGN',
      ip_address: '127.0.0.1',
      metadata: { invoiceId },
      fees: outcome === 'success' ? Math.round(amountKobo * 0.015) : null,
      customer: {
        id: Math.floor(Date.now() / 1000) - 1,
        email,
        customer_code: `CUS_mock${reference.slice(-10)}`,
        first_name: null,
        last_name: null,
        phone: null,
        risk_action: 'default',
      },
      authorization: {
        authorization_code: `AUTH_mock${reference.slice(-10)}`,
        bin: '408408',
        last4: '4081',
        exp_month: '12',
        exp_year: '2030',
        channel: 'card',
        card_type: 'visa',
        bank: 'TEST BANK',
        country_code: 'NG',
        brand: 'visa',
        reusable: false,
        signature: `SIG_mock${reference.slice(-10)}`,
      },
      plan: null,
    },
  };
}
