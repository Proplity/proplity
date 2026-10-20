import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { PaymentRules } from '@/lib/api/types';

// Whether a payment the team records waits for a second person, per the admin's switches. Until it
// loads (or if it fails) it assumes the safe default, on, so a form never promises a payment counts
// at once when it may not.
const SAFE: PaymentRules = {
  requireSecondPersonForTenantPayments: true,
  requireSecondPersonForVendorPayments: true,
};

export function usePaymentRules(): PaymentRules {
  const [rules, setRules] = useState<PaymentRules>(SAFE);
  useEffect(() => {
    let cancelled = false;
    api.settings
      .paymentRules()
      .then((res) => {
        if (!cancelled) setRules(res.data.data);
      })
      .catch(() => {
        // keep the safe default
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return rules;
}
