import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { Notification } from '@/lib/api/types';

const POLL_INTERVAL_MS = 20000;
const RECENT_LIMIT = 8;

// Lives once in DashboardChrome's header. Polls the same endpoint the full
// notifications page uses, but keeps only the newest handful for the
// dropdown, and tracks which ids are new since the last poll so the caller
// can pop a toast + play a sound for them -- never for what was already on
// screen at mount (that would fire a burst of toasts every page load).
export function useNotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newlyArrived, setNewlyArrived] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await api.notifications.list({ limit: RECENT_LIMIT });
      const fresh = res.data.data;
      setItems(fresh);
      setUnreadCount(res.data.meta.unreadCount);

      if (seenIds.current === null) {
        // First poll: seed the seen-set silently, nothing to announce yet.
        seenIds.current = new Set(fresh.map((n) => n.id));
      } else {
        const arrived = fresh.filter((n) => !seenIds.current!.has(n.id));
        if (arrived.length > 0) {
          arrived.forEach((n) => seenIds.current!.add(n.id));
          setNewlyArrived(arrived);
        }
      }
    } catch {
      // Silent -- a missed poll tick isn't worth surfacing as an error UI.
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  const clearNewlyArrived = useCallback(() => setNewlyArrived([]), []);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.notifications.markRead(id, true);
    } catch {
      // best-effort -- next poll reconciles state either way
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.notifications.markAllRead();
    } catch {
      // best-effort -- next poll reconciles state either way
    }
  }, []);

  return { items, unreadCount, newlyArrived, clearNewlyArrived, markRead, markAllRead };
}
