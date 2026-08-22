import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateLeaseInput, Lease, Note } from '@/lib/api/types';

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

// Every lease visible to the logged-in user (server-scoped by role --
// tenant sees their own, manager/landlord see their properties', admin sees
// all). Used by TenantManagement's tenant list and Dashboard's summary.
export function useLeases(params?: { status?: string }) {
  const [data, setData] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.leases.list(params);
      setData(res.data.data);
    } catch {
      setError('Failed to load leases');
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

// Full detail for one lease -- tenant (incl. emergency contact), unit +
// property, notices, and invoices (each with its payments). Used by
// TenantDetail, the manager-facing "this tenant's lease" view.
export function useLease(leaseId: string | null) {
  const [data, setData] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!leaseId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.leases.get(leaseId);
      setData(res.data.data);
    } catch {
      setError('Failed to load lease');
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Manager notes on a lease (real Note model, leaseId-scoped). Not wired to
// a form until TenantDetail's "Manager Notes" section.
export function useLeaseNotes(leaseId: string | null) {
  const [data, setData] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!leaseId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.leases.notes.list(leaseId);
      setData(res.data.data);
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateLeaseNote(leaseId: string) {
  return useApiSubmit((body: string) => api.leases.notes.create(leaseId, body).then((res) => res.data.data));
}
