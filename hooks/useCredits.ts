import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreditShop } from '@/lib/api/types';

/** The credit packs on sale to the signed-in account, and whether buying is open. */
export function useCreditShop() {
  const [data, setData] = useState<CreditShop | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await api.credits.packs();
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, refetch };
}

/** Makes the invoice for a pack and returns where to pay it (Paystack, or the local mock). */
export function useBuyCredits() {
  return useApiSubmit(async (packKey: string) => {
    const { invoiceId } = (await api.credits.checkout(packKey)).data.data;
    return (await api.payments.initialize(invoiceId)).data.data;
  });
}
