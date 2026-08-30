import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { Application, CreateApplicationInput, ReviewApplicationInput } from '@/lib/api/types';

export function useApplications(params?: { status?: string; unitId?: string }) {
  const [data, setData] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.applications.list(params);
      setData(res.data.data);
    } catch {
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.status, params?.unitId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateApplication() {
  return useApiSubmit((body: CreateApplicationInput) =>
    api.applications.create(body).then((res) => res.data.data),
  );
}

export function useReviewApplication(id: string) {
  return useApiSubmit((body: ReviewApplicationInput) =>
    api.applications.review(id, body).then((res) => res.data.data),
  );
}
