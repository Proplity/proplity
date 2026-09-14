import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { Notification } from '@/lib/api/types';

// Full notifications page: one fetch on mount plus manual refetch/loadMore,
// no polling -- the bell (useNotificationBell) already polls for live
// updates while this page isn't necessarily open.
export function useNotifications() {
  const [data, setData] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notifications.list({ limit: 20 });
      setData(res.data.data);
      setUnreadCount(res.data.meta.unreadCount);
      setHasMore(res.data.meta.hasMore);
      setNextCursor(res.data.meta.nextCursor);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const res = await api.notifications.list({ limit: 20, cursor: nextCursor });
      setData((prev) => [...prev, ...res.data.data]);
      setHasMore(res.data.meta.hasMore);
      setNextCursor(res.data.meta.nextCursor);
    } catch {
      setError('Failed to load more notifications');
    }
  }, [nextCursor]);

  const markRead = useCallback(async (id: string, isRead: boolean = true) => {
    setData((prev) => prev.map((n) => (n.id === id ? { ...n, isRead } : n)));
    setUnreadCount((prev) => Math.max(0, prev + (isRead ? -1 : 1)));
    try {
      await api.notifications.markRead(id, isRead);
    } catch {
      setError('Failed to update notification');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setData((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.notifications.markAllRead();
    } catch {
      setError('Failed to mark all as read');
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      const removed = data.find((n) => n.id === id);
      setData((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await api.notifications.remove(id);
      } catch {
        setError('Failed to delete notification');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [data],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    unreadCount,
    loading,
    error,
    hasMore,
    refetch,
    loadMore,
    markRead,
    markAllRead,
    remove,
  };
}
