import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { Announcement, CreateAnnouncementInput } from '@/lib/api/types';

export function useAnnouncements(propertyId: string | null) {
  const [data, setData] = useState<Announcement[]>([]);
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
      const res = await api.properties.announcements.list(propertyId);
      setData(res.data.data);
    } catch {
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateAnnouncement(propertyId: string) {
  return useApiSubmit((body: CreateAnnouncementInput) =>
    api.properties.announcements.create(propertyId, body).then((res) => res.data.data),
  );
}

export function useUpdateAnnouncement(propertyId: string, announcementId: string) {
  return useApiSubmit((body: Partial<CreateAnnouncementInput>) =>
    api.properties.announcements
      .update(propertyId, announcementId, body)
      .then((res) => res.data.data),
  );
}

export function useDeleteAnnouncement(propertyId: string) {
  return useApiSubmit((announcementId: string) =>
    api.properties.announcements.remove(propertyId, announcementId).then((res) => res.data.data),
  );
}
