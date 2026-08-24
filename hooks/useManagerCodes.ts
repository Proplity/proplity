import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { ManagerInviteCode } from '@/lib/api/types';

// LANDLORD's own issued codes.
export function useManagerCodes() {
  const [data, setData] = useState<ManagerInviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.managerCodes.list();
      setData(res.data.data);
    } catch {
      setError('Failed to load codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateManagerCode() {
  return useApiSubmit(() => api.managerCodes.create().then((res) => res.data.data));
}

export function useSetManagerCodeStatus() {
  return useApiSubmit((id: string, status: 'ACTIVE' | 'DEACTIVATED') =>
    api.managerCodes.setStatus(id, status).then((res) => res.data.data),
  );
}

// MANAGER redeeming a landlord's code to link accounts.
export function useRedeemManagerCode() {
  return useApiSubmit((code: string) => api.managerCodes.redeem(code).then((res) => res.data.data));
}
