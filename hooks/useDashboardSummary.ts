import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type {
  AdminBreakdownSummary,
  AdminDashboardSummary,
  AdminReportsSummary,
  OwnerBreakdownSummary,
  OwnerDashboardSummary,
  TenantDashboardSummary,
  VendorDashboardSummary,
} from '@/lib/api/types';

// Server-computed totals for the dashboards (ISS-049): correct at any data
// size, unlike summing the first page of a list in the browser.
function useSummary<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch {
      setError('Failed to load dashboard totals');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useOwnerSummary() {
  return useSummary<OwnerDashboardSummary>(() =>
    api.dashboard.summary().then((res) => res.data.data),
  );
}

export function useAdminSummary() {
  return useSummary<AdminDashboardSummary>(() => api.admin.summary().then((res) => res.data.data));
}

export function useAdminReports(from: string, to: string) {
  const [data, setData] = useState<AdminReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await api.admin.reports({ from, to })).data.data);
    } catch {
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useOwnerBreakdown() {
  return useSummary<OwnerBreakdownSummary>(() =>
    api.dashboard.breakdown().then((res) => res.data.data),
  );
}

export function useAdminBreakdown() {
  return useSummary<AdminBreakdownSummary>(() =>
    api.admin.breakdown().then((res) => res.data.data),
  );
}

export function useTenantSummary() {
  return useSummary<TenantDashboardSummary>(() =>
    api.dashboard.mineTenant().then((res) => res.data.data),
  );
}

export function useVendorSummary() {
  return useSummary<VendorDashboardSummary>(() =>
    api.dashboard.mineVendor().then((res) => res.data.data),
  );
}
