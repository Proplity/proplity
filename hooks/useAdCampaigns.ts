import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { AdCampaign } from '@/lib/api/types';

// The property's currently-active ad campaign, if any.
export function useAdCampaign(propertyId: string | null) {
  const [data, setData] = useState<AdCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!propertyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.adCampaigns.get(propertyId);
      setData(res.data.data);
    } catch {
      setError('Failed to load ad campaign');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateAdCampaign(propertyId: string) {
  return useApiSubmit((body: { budget: number; durationDays: number }) =>
    api.adCampaigns.create(propertyId, body).then((res) => res.data.data),
  );
}

export function useCancelAdCampaign(propertyId: string) {
  return useApiSubmit((adId: string) =>
    api.adCampaigns.cancel(propertyId, adId).then((res) => res.data.data),
  );
}
