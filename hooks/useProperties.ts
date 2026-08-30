import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  CreatePropertyInput,
  CreateUnitInput,
  CreateViewingInput,
  Property,
  PropertyDetail,
  Unit,
} from '@/lib/api/types';

export function useProperties(filters?: { city?: string; state?: string; minBedrooms?: number }) {
  const [data, setData] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    refetch();
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
    refetch();
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
    refetch();
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
    refetch();
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

export function useSetPropertyPublished(propertyId: string) {
  return useApiSubmit((isPublished: boolean) =>
    api.properties.setPublished(propertyId, isPublished).then((res) => res.data.data),
  );
}

export function useModerateProperty(propertyId: string) {
  return useApiSubmit(
    (body: { status: 'APPROVED' | 'REJECTED' | 'FLAGGED'; moderationNotes?: string }) =>
      api.properties.moderate(propertyId, body).then((res) => res.data.data),
  );
}
