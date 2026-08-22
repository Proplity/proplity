import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateInvoiceInput } from '@/lib/api/types';

export function useCreateInvoice() {
  return useApiSubmit((body: CreateInvoiceInput) => api.invoices.create(body).then((res) => res.data.data));
}
