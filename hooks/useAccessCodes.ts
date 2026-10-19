import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { AccessCode, CreateAccessCodeInput } from '@/lib/api/types';

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
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateAccessCode() {
  return useApiSubmit((body: CreateAccessCodeInput) =>
    api.accessCodes.create(body).then((res) => res.data.data),
  );
}

export function useRevokeAccessCode() {
  return useApiSubmit((id: string) => api.accessCodes.revoke(id).then((res) => res.data.data));
}

export function useVerifyAccessCode() {
  return useApiSubmit((body: { unitId: string; code: string }) =>
    api.accessCodes.verify(body).then((res) => res.data.data),
  );
}
