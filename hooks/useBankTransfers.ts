import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  BankTransferStatus,
  BankTransferSubmission,
  SubmitBankTransferInput,
} from '@/lib/api/types';
import type { Receipt } from '@/lib/receiptTypes';

// Transfers the signed-in person may see (server-scoped by role): a tenant's own, the property
// team's, or everything for an admin.
export function useBankTransfers(
  params?: { status?: BankTransferStatus; invoiceId?: string },
  // Off for people the list is not for (a vendor is refused), so no failing request is made.
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [data, setData] = useState<BankTransferSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.bankTransfers.list({ ...params, limit: 100 });
      setData(res.data.data);
    } catch {
      setError('Failed to load bank transfers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.status, params?.invoiceId, enabled]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Records "I paid this another way": a transfer proof that waits for someone else to confirm it.
export function useSubmitBankTransfer() {
  return useApiSubmit((body: SubmitBankTransferInput) =>
    api.bankTransfers.submit(body).then((res) => res.data.data),
  );
}

export function useReconcileBankTransfer() {
  return useApiSubmit(
    (id: string, body: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string }) =>
      api.bankTransfers.reconcile(id, body).then((res) => res.data.data),
  );
}

export function useReceipt(paymentId: string) {
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  // 404 covers "no such receipt" and "not yours": the API does not say which.
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.payments
      .receipt(paymentId)
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return { data, loading, notFound };
}
