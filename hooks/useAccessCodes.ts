import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { AccessCode, CreateAccessCodeInput } from '@/lib/api/types';

// Not wired to a form this phase -- no access-code UI exists yet. Built per
// the plan's explicit hook list, available for a future addition.
export function useAccessCodes(unitId: string | null) {
  const [data, setData] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!unitId) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.accessCodes.list(unitId);
      setData(res.data.data);
    } catch {
      setError('Failed to load access codes');
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateAccessCode() {
  return useApiSubmit((body: CreateAccessCodeInput) => api.accessCodes.create(body).then((res) => res.data.data));
}
