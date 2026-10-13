import { useCallback, useEffect, useState } from 'react';
import type { Paginated } from '@/lib/api/types';

const PAGE_SIZE = 100;

// Loads a server-paged list a page at a time (100 rows per request) up to
// `cap` rows, so a long table is never silently cut at the first page of 20.
// `total` is the real count; `truncated` tells the page to say it is showing
// only part of it.
export function usePagedList<T>(
  fetchPage: (page: number, limit: number) => Promise<{ data: Paginated<T> }>,
  cap = 500,
  enabled = true,
) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const rows: T[] = [];
      let count = 0;
      for (let page = 1; rows.length < cap; page++) {
        const res = await fetchPage(page, PAGE_SIZE);
        rows.push(...res.data.data);
        count = res.data.meta.total;
        if (!res.data.meta.hasMore) break;
      }
      setData(rows);
      setTotal(count);
    } catch {
      setError('Failed to load the list');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, total, loading, error, truncated: total > data.length, refetch };
}
