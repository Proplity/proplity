import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { CreateEquipmentInput, Equipment } from '@/lib/api/types';

export function useEquipment(propertyId: string | null) {
  const [data, setData] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!propertyId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.properties.equipment.list(propertyId);
      setData(res.data.data);
    } catch {
      setError('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateEquipment(propertyId: string) {
  return useApiSubmit((body: CreateEquipmentInput) =>
    api.properties.equipment.create(propertyId, body).then((res) => res.data.data),
  );
}

export function useDeleteEquipment(propertyId: string) {
  return useApiSubmit((equipmentId: string) =>
    api.properties.equipment.remove(propertyId, equipmentId).then((res) => res.data.data),
  );
}
