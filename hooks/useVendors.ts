import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { Vendor } from '@/lib/api/types';

// Active vendor users with computed reputation stats (rating, completion
// rate) -- MANAGER/LANDLORD/ADMIN only. Used by MaintenanceDetail's
// assign-vendor picker.
export function useVendors() {
  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.vendors
      .list()
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load vendors');
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
