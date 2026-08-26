import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { BankAccount, CreateBankAccountInput } from '@/lib/api/types';

// Self-service storage only -- no Paystack/payout automation reads this
// table yet (see CLAUDE.md's orphaned-model note). Not wired to a form
// this phase -- no account-settings page exists to host it yet, same
// situation useAccessCodes/useCreateAccessCode were in before their own
// UI landed. Built and ready for whenever that surface exists.
export function useBankAccounts() {
  const [data, setData] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.bankAccounts.list();
      setData(res.data.data);
    } catch {
      setError('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateBankAccount() {
  return useApiSubmit((body: CreateBankAccountInput) => api.bankAccounts.create(body).then((res) => res.data.data));
}

export function useSetDefaultBankAccount() {
  return useApiSubmit((id: string) => api.bankAccounts.setDefault(id).then((res) => res.data.data));
}

export function useDeleteBankAccount() {
  return useApiSubmit((id: string) => api.bankAccounts.remove(id).then((res) => res.data.data));
}
