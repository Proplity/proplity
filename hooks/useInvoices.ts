import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateInvoiceInput, Invoice } from '@/lib/api/types';

export function useCreateInvoice() {
  return useApiSubmit((body: CreateInvoiceInput) => api.invoices.create(body).then((res) => res.data.data));
}

// Starts a real Paystack checkout for one invoice -- POST /payments/initialize
// (fully built, just never had a UI caller). Resolves to the authorization
// URL to redirect the browser to; the actual Payment row is only created
// once Paystack's webhook fires on charge.success.
export function usePayInvoice() {
  return useApiSubmit((invoiceId: string) => api.payments.initialize(invoiceId).then((res) => res.data.data));
}

// The logged-in user's own invoices (server-scoped by role -- see
// GET /api/v1/invoices). Used for tenant payment history and rent-status
// summaries; each invoice carries its real payments[] now that the route
// includes them.
export function useInvoices(params?: { type?: string; status?: string }) {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoices.list(params);
      setData(res.data.data);
    } catch {
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.type, params?.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
