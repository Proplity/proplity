import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateViolationInput, Violation } from '@/lib/api/types';

export function useViolations(propertyId: string | null, unitId: string | null) {
  const [data, setData] = useState<Violation[]>([]);
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
      const res = await api.properties.violations.list(propertyId, unitId);
      setData(res.data.data);
    } catch {
      setError('Failed to load violations');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateViolation(propertyId: string, unitId: string) {
  return useApiSubmit((body: CreateViolationInput) =>
    api.properties.violations.create(propertyId, unitId, body).then((res) => res.data.data),
  );
}

export function useUpdateViolation(propertyId: string, unitId: string) {
  return useApiSubmit(
    ({
      violationId,
      ...body
    }: {
      violationId: string;
      status: Violation['status'];
      resolutionNote?: string;
    }) =>
      api.properties.violations
        .update(propertyId, unitId, violationId, body)
        .then((res) => res.data.data),
  );
}
