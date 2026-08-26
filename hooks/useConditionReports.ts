import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { ConditionReport, CreateConditionReportInput } from '@/lib/api/types';

export function useConditionReports(propertyId: string | null, unitId: string | null) {
  const [data, setData] = useState<ConditionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!propertyId || !unitId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.properties.conditionReports.list(propertyId, unitId);
      setData(res.data.data);
    } catch {
      setError('Failed to load condition reports');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateConditionReport(propertyId: string, unitId: string) {
  return useApiSubmit((body: CreateConditionReportInput) =>
    api.properties.conditionReports.create(propertyId, unitId, body).then((res) => res.data.data),
  );
}
