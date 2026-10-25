import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { RentAgreementView, RuleFindingView } from '@/lib/api/types';

/**
 * A rent's agreement and the legal warnings for its tenancy. `data` is null when the rent has no
 * agreement (or, for a tenant, none that has been sent to them yet).
 */
export function useRentAgreement(rentId: string | null) {
  const [data, setData] = useState<RentAgreementView | null>(null);
  const [findings, setFindings] = useState<RuleFindingView[]>([]);
  const [loading, setLoading] = useState(Boolean(rentId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!rentId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.rents.agreement.get(rentId);
      setData(res.data.data);
      setFindings(res.data.findings ?? []);
    } catch {
      setError('Failed to load the agreement');
    } finally {
      setLoading(false);
    }
  }, [rentId]);

  useEffect(() => {
    const timer = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, findings, loading, error, refetch };
}
