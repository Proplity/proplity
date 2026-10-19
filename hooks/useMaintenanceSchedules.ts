import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  CreateScheduleInput,
  MaintenanceSchedule,
  UpdateScheduleInput,
} from '@/lib/api/types';

// The recurring repairs for the properties the signed-in manager, landlord or admin looks after.
export function useMaintenanceSchedules() {
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.maintenance.schedules.list({ limit: 100 });
      setData(res.data.data);
    } catch {
      setError('Failed to load schedules');
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

export function useCreateSchedule() {
  return useApiSubmit((body: CreateScheduleInput) => api.maintenance.schedules.create(body));
}

export function useUpdateSchedule() {
  return useApiSubmit((id: string, body: UpdateScheduleInput) =>
    api.maintenance.schedules.update(id, body),
  );
}

export function useDeleteSchedule() {
  return useApiSubmit((id: string) => api.maintenance.schedules.remove(id));
}
