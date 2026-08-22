import axios from 'axios';
import type {
  AccessCode,
  AdminUser,
  Conversation,
  CreateAccessCodeInput,
  CreateConversationInput,
  CreateInvoiceInput,
  CreateLeaseInput,
  CreateMaintenanceRequestInput,
  CreateMessageInput,
  CreatePropertyInput,
  CreateUnitInput,
  CreateViewingInput,
  Invoice,
  Lease,
  MaintenanceCategory,
  MaintenanceRequest,
  Message,
  Note,
  Paginated,
  Property,
  Unit,
  UpdateMaintenanceRequestInput,
  Vendor,
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
    mine: () => apiClient.get<Paginated<Property>>('/api/v1/properties', { params: { scope: 'mine' } }),
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
    list: (params?: { status?: string }) =>
      apiClient.get<Paginated<MaintenanceRequest>>('/api/v1/maintenance/requests', { params }),
    get: (id: string) => apiClient.get<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`),
    update: (id: string, body: UpdateMaintenanceRequestInput) =>
      apiClient.patch<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`, body),
    createRequest: (body: CreateMaintenanceRequestInput) =>
      apiClient.post<{ data: unknown }>('/api/v1/maintenance/requests', body),
  },
  vendors: {
    list: () => apiClient.get<{ data: Vendor[] }>('/api/v1/vendors'),
  },
  leases: {
    list: (params?: { status?: string }) => apiClient.get<Paginated<Lease>>('/api/v1/leases', { params }),
    get: (id: string) => apiClient.get<{ data: Lease }>(`/api/v1/leases/${id}`),
    create: (body: CreateLeaseInput) => apiClient.post<{ data: Lease }>('/api/v1/leases', body),
    notes: {
      list: (leaseId: string) => apiClient.get<{ data: Note[] }>(`/api/v1/leases/${leaseId}/notes`),
      create: (leaseId: string, body: string) =>
        apiClient.post<{ data: Note }>(`/api/v1/leases/${leaseId}/notes`, { body }),
    },
  },
  invoices: {
    list: (params?: { type?: string; status?: string }) =>
      apiClient.get<Paginated<Invoice>>('/api/v1/invoices', { params }),
    create: (body: CreateInvoiceInput) => apiClient.post<{ data: Invoice }>('/api/v1/invoices', body),
  },
  accessCodes: {
    list: (unitId: string) => apiClient.get<{ data: AccessCode[] }>('/api/v1/access-codes', { params: { unitId } }),
    create: (body: CreateAccessCodeInput) => apiClient.post<{ data: AccessCode }>('/api/v1/access-codes', body),
  },
  conversations: {
    list: () => apiClient.get<{ data: Conversation[] }>('/api/v1/conversations'),
    create: (body: CreateConversationInput) => apiClient.post<{ data: Conversation }>('/api/v1/conversations', body),
    messages: {
      list: (conversationId: string, cursor?: string) =>
        apiClient.get<{ data: Message[]; meta: { hasMore: boolean; nextCursor: string | null } }>(
          `/api/v1/conversations/${conversationId}/messages`,
          { params: cursor ? { cursor } : undefined },
        ),
      create: (conversationId: string, body: CreateMessageInput) =>
        apiClient.post<{ data: Message }>(`/api/v1/conversations/${conversationId}/messages`, body),
    },
  },
  admin: {
    users: {
      list: (params?: { role?: string; limit?: number }) =>
        apiClient.get<Paginated<AdminUser>>('/api/v1/admin/users', { params }),
    },
  },
};
