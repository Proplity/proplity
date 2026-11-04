import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { Plan } from '@/lib/api/types';

/** The plans a visitor can choose from, as the admin has set them up. */
export function usePlans() {
  const [data, setData] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.plans.list();
      setData(res.data.data);
    } catch {
      setError('Failed to load plans');
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

  return { data, loading, error, refetch };
}
