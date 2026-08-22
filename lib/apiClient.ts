import axios from 'axios';
import type {
  AccessCode,
  CreateAccessCodeInput,
  CreateInvoiceInput,
  CreateLeaseInput,
  CreateMaintenanceRequestInput,
  CreatePropertyInput,
  CreateUnitInput,
  CreateViewingInput,
  Invoice,
  Lease,
  MaintenanceCategory,
  Paginated,
  Property,
  Unit,
} from './api/types';

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((res) => res.status === 200)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/v1/auth/refresh')
    ) {
      originalRequest._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient(originalRequest);
      } else if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Backward-compatible fetch wrapper using single refresh deduplication logic
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);

  if (response.status === 401 && !url.includes('/api/v1/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetch(url, options);
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  return response;
}

// Domain-grouped typed methods, built on the same apiClient instance (and
// therefore the same 401-refresh interceptor above) -- kept minimal to what
// Phase 7's forms actually call, not a full mirror of every domain route.
export const api = {
  properties: {
    list: (params?: { city?: string; state?: string; minBedrooms?: number }) =>
      apiClient.get<Paginated<Property>>('/api/v1/properties', { params }),
    get: (propertyId: string) => apiClient.get<{ data: Property }>(`/api/v1/properties/${propertyId}`),
    create: (body: CreatePropertyInput) => apiClient.post<{ data: Property }>('/api/v1/properties', body),
    listUnits: (propertyId: string, status?: string) =>
      apiClient.get<{ data: Unit[] }>(`/api/v1/properties/${propertyId}/units`, {
        params: status ? { status } : undefined,
      }),
    createUnit: (propertyId: string, body: CreateUnitInput) =>
      apiClient.post<{ data: Unit }>(`/api/v1/properties/${propertyId}/units`, body),
    createViewing: (propertyId: string, body: CreateViewingInput) =>
      apiClient.post<{ data: unknown }>(`/api/v1/properties/${propertyId}/viewings`, body),
  },
  maintenance: {
    categories: () => apiClient.get<{ data: MaintenanceCategory[] }>('/api/v1/maintenance/categories'),
    createRequest: (body: CreateMaintenanceRequestInput) =>
      apiClient.post<{ data: unknown }>('/api/v1/maintenance/requests', body),
  },
  leases: {
    list: (params?: { status?: string }) => apiClient.get<Paginated<Lease>>('/api/v1/leases', { params }),
    create: (body: CreateLeaseInput) => apiClient.post<{ data: Lease }>('/api/v1/leases', body),
  },
  invoices: {
    create: (body: CreateInvoiceInput) => apiClient.post<{ data: Invoice }>('/api/v1/invoices', body),
  },
  accessCodes: {
    list: (unitId: string) => apiClient.get<{ data: AccessCode[] }>('/api/v1/access-codes', { params: { unitId } }),
    create: (body: CreateAccessCodeInput) => apiClient.post<{ data: AccessCode }>('/api/v1/access-codes', body),
  },
};
