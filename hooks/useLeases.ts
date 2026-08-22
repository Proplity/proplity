import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateLeaseInput, Lease } from '@/lib/api/types';

export function useCreateLease() {
  return useApiSubmit((body: CreateLeaseInput) => api.leases.create(body).then((res) => res.data.data));
}

// The logged-in tenant's own active lease -- a tenant has exactly one in
// the seeded data model. Used to thread a real unitId into forms (e.g.
// MaintenanceRequestForm) that only ever had a mock property address, no id.
export function useActiveLease() {
  const [data, setData] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.leases
      .list({ status: 'ACTIVE' })
      .then((res) => {
        if (!cancelled) setData(res.data.data[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load your lease');
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
