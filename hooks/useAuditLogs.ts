import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { AuditLog } from '@/lib/api/types';

// Admin-only view of AuditLog (GET /admin/audit-logs) -- the model existed
// with a single writer (setup/route.ts's FIRST_RUN_SETUP entry) and no
// reader anywhere. limit: 100 mirrors useAdminUsers' own call on real
// seeded scale; revisit with real pagination if this ever needs to page.
export function useAuditLogs() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.auditLogs.list({ limit: 100 });
      setData(res.data.data);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
