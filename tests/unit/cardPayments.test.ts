import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardPaymentsAvailable } from '@/lib/payments/availability';

describe('card payment availability (ISS-010)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off with no Paystack key and no mock gateway', () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED', 'false');
    expect(cardPaymentsAvailable()).toBe(false);
  });

  it('turns on as soon as a Paystack key is set, with no rebuild', () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED', 'false');
    expect(cardPaymentsAvailable()).toBe(false);
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_example');
    expect(cardPaymentsAvailable()).toBe(true);
  });

  it('is on with the local mock gateway, which exists for development and tests', () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED', 'true');
    expect(cardPaymentsAvailable()).toBe(true);
  });
});
