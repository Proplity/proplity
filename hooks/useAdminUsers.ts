import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { AdminUser } from '@/lib/api/types';

// Every registered user on the platform -- ADMIN only (GET /admin/users,
// built in Phase 9.6). limit: 100 covers the real seeded scale (9 users);
// revisit with real pagination if the platform ever needs it.
export function useAdminUsers() {
  const [data, setData] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin.users
      .list({ limit: 100 })
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load users');
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
