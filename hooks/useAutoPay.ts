import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  AutoPayMandate,
  CreateAutoPayMandateInput,
  PaymentAuthorization,
} from '@/lib/api/types';

export function useAutoPayMandates(leaseId: string | null) {
  const [data, setData] = useState<AutoPayMandate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!leaseId) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.payments.autopay.list(leaseId);
      setData(res.data.data);
    } catch {
      setError('Failed to load auto-pay status');
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Looks up whether the tenant has a reusable card authorization from a past
// Paystack payment on this lease -- auto-pay can only be set up from that,
// since there's no card-entry UI in this codebase (see payments/authorization
// route.ts for why). null means "none found yet", not "still loading".
export function usePaymentAuthorization(leaseId: string | null) {
  const [data, setData] = useState<PaymentAuthorization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!leaseId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.payments.authorization(leaseId);
      setData(res.data.data);
    } catch {
      setError('Failed to check for a saved payment method');
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateAutoPayMandate() {
  return useApiSubmit((body: CreateAutoPayMandateInput) =>
    api.payments.autopay.create(body).then((res) => res.data.data),
  );
}

export function useCancelAutoPayMandate() {
  return useApiSubmit((id: string) => api.payments.autopay.cancel(id).then((res) => res.data.data));
}
