import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  PropertyViewing,
  CreatePropertyInput,
  CreateUnitInput,
  CreateViewingInput,
  Property,
  PropertyDetail,
  Unit,
  UpdatePropertyInput,
} from '@/lib/api/types';

export function useProperties(filters?: { city?: string; state?: string; minBedrooms?: number }) {
  const [data, setData] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(filters);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.properties.list(filters);
      setData(res.data.data);
    } catch {
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
    // filters is a plain object literal at call sites -- stringify to avoid
    // an effect loop from a new object reference every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Full detail for one property -- units, reviews/reviewStats, latest
// neighbourhood report. Used by any property detail view, public or internal.
export function useProperty(propertyId: string | null) {
  const [data, setData] = useState<PropertyDetail | null>(null);
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
      const res = await api.properties.get(propertyId);
      setData(res.data.data as PropertyDetail);
    } catch {
      setError('Failed to load property');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// The logged-in MANAGER/LANDLORD/ADMIN's own properties (published or not --
// their own dashboard needs to see a pending-review listing too, unlike
// useProperties() above which only ever sees published ones).
export function useMyProperties() {
  const [data, setData] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.properties.mine();
      setData(res.data.data);
    } catch {
      setError('Failed to load your properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// A property's real units -- needed anywhere a form must pick a specific
// unit, not just a property (Lease.unitId requires one).
export function useUnits(propertyId: string | null, status?: string) {
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!propertyId) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.properties.listUnits(propertyId, status);
      setData(res.data.data);
    } catch {
      setError('Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [propertyId, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateProperty() {
  return useApiSubmit((body: CreatePropertyInput) =>
    api.properties.create(body).then((res) => res.data.data),
  );
}

export function useCreateUnit(propertyId: string) {
  return useApiSubmit((body: CreateUnitInput) =>
    api.properties.createUnit(propertyId, body).then((res) => res.data.data),
  );
}

export function useImportUnits(propertyId: string) {
  return useApiSubmit((file: File) =>
    api.properties.importUnits(propertyId, file).then((res) => res.data.data),
  );
}

export function useCreateViewing(propertyId: string) {
  return useApiSubmit((body: CreateViewingInput) => api.properties.createViewing(propertyId, body));
}

// The start times already booked at a property on a day (`YYYY-MM-DD`, Lagos), so the booking form
// can grey them out (ISS-104). A failed lookup greys nothing out: the server still refuses a time
// that is taken.
export function useViewingAvailability(propertyId: string, date: string) {
  const [loaded, setLoaded] = useState<{ date: string; taken: string[] }>({ date: '', taken: [] });
  const latest = useRef(0);

  const refetch = useCallback(async () => {
    if (!date) return [];
    const ticket = ++latest.current;
    let taken: string[] = [];
    try {
      taken = (await api.properties.viewingAvailability(propertyId, date)).data.data.taken;
    } catch {
      taken = [];
    }
    // A slower answer for a day the person has already moved off is ignored.
    if (ticket === latest.current) setLoaded({ date, taken });
    return taken;
  }, [propertyId, date]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { taken: loaded.date === date ? loaded.taken : [], refetch };
}

export function useSetPropertyPublished(propertyId: string) {
  return useApiSubmit((isPublished: boolean) =>
    api.properties.setPublished(propertyId, isPublished).then((res) => res.data.data),
  );
}

export function useUpdateProperty(propertyId: string) {
  return useApiSubmit((body: UpdatePropertyInput) =>
    api.properties.update(propertyId, body).then((res) => res.data.data),
  );
}

export function useMergeProperty(propertyId: string) {
  return useApiSubmit((targetPropertyId: string) =>
    api.properties.merge(propertyId, targetPropertyId).then((res) => res.data.data),
  );
}

export function useUnmergeProperty(propertyId: string) {
  return useApiSubmit(() => api.properties.unmerge(propertyId).then((res) => res.data.data));
}

export function useModerateProperty(propertyId: string) {
  return useApiSubmit(
    (body: { status: 'APPROVED' | 'REJECTED' | 'FLAGGED'; moderationNotes?: string }) =>
      api.properties.moderate(propertyId, body).then((res) => res.data.data),
  );
}

// Viewing requests for one property: everything for the property team, only
// the caller's own for anyone else (server-scoped).
export function usePropertyViewings(propertyId: string | null) {
  const [data, setData] = useState<PropertyViewing[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await api.properties.listViewings(propertyId);
      setData(res.data.data);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, refetch };
}

export function useUpdateViewing(propertyId: string) {
  return useApiSubmit((args: { viewingId: string; status: 'CONFIRMED' | 'CANCELLED' }) =>
    api.properties
      .updateViewing(propertyId, args.viewingId, args.status)
      .then((res) => res.data.data),
  );
}
