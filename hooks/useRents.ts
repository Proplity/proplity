import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type {
  CreateRentInput,
  Rent,
  Note,
  UpdateRentTermsInput,
  RenewRentInput,
  CreateNoticeInput,
} from '@/lib/api/types';

export function useCreateRent() {
  return useApiSubmit((body: CreateRentInput) =>
    api.rents.create(body).then((res) => res.data.data),
  );
}

// Edits an existing rent's grace period / late-fee terms -- landlord/
// manager autonomy, see rents/[id] PATCH.
export function useUpdateRentTerms(rentId: string) {
  return useApiSubmit((body: UpdateRentTermsInput) =>
    api.rents.updateTerms(rentId, body).then((res) => res.data.data),
  );
}

// Explicit rent lifecycle transitions (e.g. activating a PENDING rent,
// terminating an ACTIVE one) -- Unit.status is kept in sync server-side.
export function useUpdateRentStatus(rentId: string) {
  return useApiSubmit((status: string) =>
    api.rents.updateStatus(rentId, status).then((res) => res.data.data),
  );
}

// Renews a rent: creates a new ACTIVE Rent row linked via renewedFromId
// and expires the current one -- see the `renew` branch of rents/[id] PATCH.
export function useRenewRent(rentId: string) {
  return useApiSubmit((body: RenewRentInput) =>
    api.rents.renew(rentId, body).then((res) => res.data.data),
  );
}

// Click-wrap e-signature -- see app/api/v1/rents/[id]/sign/route.ts.
export function useSignRent(rentId: string) {
  return useApiSubmit((fullName: string) =>
    api.rents.sign(rentId, fullName).then((res) => res.data.data),
  );
}

// The logged-in tenant's own active rent -- a tenant has exactly one in
// the seeded data model. Used to thread a real unitId into forms (e.g.
// MaintenanceRequestForm) that only ever had a mock property address, no id.
export function useActiveRent() {
  const [data, setData] = useState<Rent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.rents
      .list({ status: 'ACTIVE' })
      .then((res) => {
        if (!cancelled) setData(res.data.data[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load your rent');
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

// Every rent visible to the logged-in user (server-scoped by role --
// tenant sees their own, manager/landlord see their properties', admin sees
// all). Used by TenantManagement's tenant list and Dashboard's summary.
export function useRents(params?: { status?: string }) {
  const [data, setData] = useState<Rent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.rents.list(params);
      setData(res.data.data);
    } catch {
      setError('Failed to load rents');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Full detail for one rent -- tenant (incl. emergency contact), unit +
// property, notices, and invoices (each with its payments). Used by
// TenantDetail, the manager-facing "this tenant's rent" view.
export function useRent(rentId: string | null) {
  const [data, setData] = useState<Rent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!rentId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.rents.get(rentId);
      setData(res.data.data);
    } catch {
      setError('Failed to load rent');
    } finally {
      setLoading(false);
    }
  }, [rentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Manager notes on a rent (real Note model, rentId-scoped). Not wired to
// a form until TenantDetail's "Manager Notes" section.
export function useRentNotes(rentId: string | null) {
  const [data, setData] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!rentId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.rents.notes.list(rentId);
      setData(res.data.data);
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [rentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCreateRentNote(rentId: string) {
  return useApiSubmit((body: string) =>
    api.rents.notes.create(rentId, body).then((res) => res.data.data),
  );
}

// Drafts and immediately sends a formal rent notice (rent increase,
// default, termination, etc.) -- the backend route also supports a DRAFT
// status and a separate update step, but "Send Notice" from the tenant
// console has no draft-review UI, so this always creates it pre-SENT.
export function useCreateNotice(rentId: string) {
  return useApiSubmit((body: CreateNoticeInput) =>
    api.rents.notices.create(rentId, body).then((res) => res.data.data),
  );
}
