import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CheckoutSubscriptionInput, Subscription } from '@/lib/api/types';

export function useMySubscription() {
  const [data, setData] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.subscriptions.me();
      setData(res.data.data);
    } catch {
      setError('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCheckoutSubscription() {
  return useApiSubmit((body: CheckoutSubscriptionInput) =>
    api.subscriptions.checkout(body).then((res) => res.data.data),
  );
}
