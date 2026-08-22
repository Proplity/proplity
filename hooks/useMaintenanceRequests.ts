import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateMaintenanceRequestInput, MaintenanceCategory } from '@/lib/api/types';

export function useMaintenanceCategories() {
  const [data, setData] = useState<MaintenanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.maintenance
      .categories()
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load categories');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

export function useCreateMaintenanceRequest() {
  return useApiSubmit((body: CreateMaintenanceRequestInput) => api.maintenance.createRequest(body));
}
