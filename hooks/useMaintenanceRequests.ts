import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  CreateMaintenanceRequestInput,
  MaintenanceCategory,
  MaintenanceRequest,
  UpdateMaintenanceRequestInput,
} from '@/lib/api/types';

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

// The logged-in user's own maintenance requests (server-scoped by role --
// tenant sees their own, vendor sees assigned jobs, manager/landlord see
// their properties'). Used by TenantDashboard and TenantMaintenanceRequests.
export function useMaintenanceRequests(params?: { status?: string }) {
  const [data, setData] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.maintenance.list(params);
      setData(res.data.data);
    } catch {
      setError('Failed to load maintenance requests');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Full detail for one maintenance request -- unit+property, category,
// vendor, tenant, and any vendorRating. Used by MaintenanceDetail.
export function useMaintenanceRequest(id: string | null) {
  const [data, setData] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.maintenance.get(id);
      setData(res.data.data);
    } catch {
      setError('Failed to load maintenance request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useUpdateMaintenanceRequest(id: string) {
  return useApiSubmit((body: UpdateMaintenanceRequestInput) =>
    api.maintenance.update(id, body).then((res) => res.data.data),
  );
}
