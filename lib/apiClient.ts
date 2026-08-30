import axios from 'axios';
import type {
  AccessCode,
  AdCampaign,
  AdminUser,
  Announcement,
  Application,
  BankAccount,
  CheckoutSubscriptionInput,
  ConditionReport,
  Conversation,
  CreateAccessCodeInput,
  CreateAnnouncementInput,
  CreateApplicationInput,
  CreateBankAccountInput,
  CreateConditionReportInput,
  CreateConversationInput,
  CreateEquipmentInput,
  CreateInvoiceInput,
  CreateLeaseInput,
  UpdateLeaseTermsInput,
  CreateMaintenanceRequestInput,
  CreateMessageInput,
  CreatePropertyInput,
  CreateUnitInput,
  CreateViewingInput,
  CreateViolationInput,
  Equipment,
  Invoice,
  Lease,
  LeaseSignature,
  MaintenanceCategory,
  MaintenanceRequest,
  ManagerInviteCode,
  Message,
  Note,
  Paginated,
  Property,
  ReviewApplicationInput,
  Subscription,
  Unit,
  UpdateMaintenanceRequestInput,
  Vendor,
  Violation,
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
    mine: () =>
      apiClient.get<Paginated<Property>>('/api/v1/properties', { params: { scope: 'mine' } }),
    get: (propertyId: string) =>
      apiClient.get<{ data: Property }>(`/api/v1/properties/${propertyId}`),
    create: (body: CreatePropertyInput) =>
      apiClient.post<{ data: Property }>('/api/v1/properties', body),
    listUnits: (propertyId: string, status?: string) =>
      apiClient.get<{ data: Unit[] }>(`/api/v1/properties/${propertyId}/units`, {
        params: status ? { status } : undefined,
      }),
    createUnit: (propertyId: string, body: CreateUnitInput) =>
      apiClient.post<{ data: Unit }>(`/api/v1/properties/${propertyId}/units`, body),
    importUnits: (propertyId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post<{
        data: { created: number; errors: { row: number; error: string }[] };
      }>(
        `/api/v1/properties/${propertyId}/units/import`,
        formData,
        // Instance-level default is application/json -- must be cleared so
        // the browser sets multipart/form-data with the correct boundary
        // itself, which it only does when no Content-Type is preset.
        { headers: { 'Content-Type': undefined } },
      );
    },
    createViewing: (propertyId: string, body: CreateViewingInput) =>
      apiClient.post<{ data: unknown }>(`/api/v1/properties/${propertyId}/viewings`, body),
    setPublished: (propertyId: string, isPublished: boolean) =>
      apiClient.patch<{ data: Property }>(`/api/v1/properties/${propertyId}`, { isPublished }),
    moderate: (
      propertyId: string,
      body: { status: 'APPROVED' | 'REJECTED' | 'FLAGGED'; moderationNotes?: string },
    ) => apiClient.patch<{ data: Property }>(`/api/v1/properties/${propertyId}/moderation`, body),
    announcements: {
      list: (propertyId: string) =>
        apiClient.get<{ data: Announcement[] }>(`/api/v1/properties/${propertyId}/announcements`),
      create: (propertyId: string, body: CreateAnnouncementInput) =>
        apiClient.post<{ data: Announcement }>(
          `/api/v1/properties/${propertyId}/announcements`,
          body,
        ),
      update: (
        propertyId: string,
        announcementId: string,
        body: Partial<CreateAnnouncementInput>,
      ) =>
        apiClient.patch<{ data: Announcement }>(
          `/api/v1/properties/${propertyId}/announcements/${announcementId}`,
          body,
        ),
      remove: (propertyId: string, announcementId: string) =>
        apiClient.delete<{ data: { id: string; deleted: boolean } }>(
          `/api/v1/properties/${propertyId}/announcements/${announcementId}`,
        ),
    },
    equipment: {
      list: (propertyId: string) =>
        apiClient.get<{ data: Equipment[] }>(`/api/v1/properties/${propertyId}/equipment`),
      create: (propertyId: string, body: CreateEquipmentInput) =>
        apiClient.post<{ data: Equipment }>(`/api/v1/properties/${propertyId}/equipment`, body),
      remove: (propertyId: string, equipmentId: string) =>
        apiClient.delete<{ data: { id: string; deleted: boolean } }>(
          `/api/v1/properties/${propertyId}/equipment/${equipmentId}`,
        ),
    },
    violations: {
      list: (propertyId: string, unitId: string) =>
        apiClient.get<{ data: Violation[] }>(
          `/api/v1/properties/${propertyId}/units/${unitId}/violations`,
        ),
      create: (propertyId: string, unitId: string, body: CreateViolationInput) =>
        apiClient.post<{ data: Violation }>(
          `/api/v1/properties/${propertyId}/units/${unitId}/violations`,
          body,
        ),
      update: (
        propertyId: string,
        unitId: string,
        violationId: string,
        body: { status: Violation['status']; resolutionNote?: string },
      ) =>
        apiClient.patch<{ data: Violation }>(
          `/api/v1/properties/${propertyId}/units/${unitId}/violations/${violationId}`,
          body,
        ),
    },
    conditionReports: {
      list: (propertyId: string, unitId: string) =>
        apiClient.get<{ data: ConditionReport[] }>(
          `/api/v1/properties/${propertyId}/units/${unitId}/condition-reports`,
        ),
      create: (propertyId: string, unitId: string, body: CreateConditionReportInput) =>
        apiClient.post<{ data: ConditionReport }>(
          `/api/v1/properties/${propertyId}/units/${unitId}/condition-reports`,
          body,
        ),
    },
  },
  bankAccounts: {
    list: () => apiClient.get<{ data: BankAccount[] }>('/api/v1/bank-accounts'),
    create: (body: CreateBankAccountInput) =>
      apiClient.post<{ data: BankAccount }>('/api/v1/bank-accounts', body),
    setDefault: (id: string) =>
      apiClient.patch<{ data: BankAccount }>(`/api/v1/bank-accounts/${id}`, { isDefault: true }),
    remove: (id: string) =>
      apiClient.delete<{ data: { id: string; deleted: boolean } }>(`/api/v1/bank-accounts/${id}`),
  },
  maintenance: {
    categories: () =>
      apiClient.get<{ data: MaintenanceCategory[] }>('/api/v1/maintenance/categories'),
    list: (params?: { status?: string }) =>
      apiClient.get<Paginated<MaintenanceRequest>>('/api/v1/maintenance/requests', { params }),
    get: (id: string) =>
      apiClient.get<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`),
    update: (id: string, body: UpdateMaintenanceRequestInput) =>
      apiClient.patch<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`, body),
    createRequest: (body: CreateMaintenanceRequestInput) =>
      apiClient.post<{ data: unknown }>('/api/v1/maintenance/requests', body),
  },
  vendors: {
    list: () => apiClient.get<{ data: Vendor[] }>('/api/v1/vendors'),
  },
  leases: {
    list: (params?: { status?: string }) =>
      apiClient.get<Paginated<Lease>>('/api/v1/leases', { params }),
    get: (id: string) => apiClient.get<{ data: Lease }>(`/api/v1/leases/${id}`),
    create: (body: CreateLeaseInput) => apiClient.post<{ data: Lease }>('/api/v1/leases', body),
    updateTerms: (id: string, body: UpdateLeaseTermsInput) =>
      apiClient.patch<{ data: Lease }>(`/api/v1/leases/${id}`, body),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<{ data: Lease }>(`/api/v1/leases/${id}`, { status }),
    sign: (id: string, fullName: string) =>
      apiClient.post<{ data: LeaseSignature }>(`/api/v1/leases/${id}/sign`, { fullName }),
    notes: {
      list: (leaseId: string) => apiClient.get<{ data: Note[] }>(`/api/v1/leases/${leaseId}/notes`),
      create: (leaseId: string, body: string) =>
        apiClient.post<{ data: Note }>(`/api/v1/leases/${leaseId}/notes`, { body }),
    },
  },
  invoices: {
    list: (params?: { type?: string; status?: string }) =>
      apiClient.get<Paginated<Invoice>>('/api/v1/invoices', { params }),
    create: (body: CreateInvoiceInput) =>
      apiClient.post<{ data: Invoice }>('/api/v1/invoices', body),
  },
  accessCodes: {
    list: (unitId: string) =>
      apiClient.get<{ data: AccessCode[] }>('/api/v1/access-codes', { params: { unitId } }),
    create: (body: CreateAccessCodeInput) =>
      apiClient.post<{ data: AccessCode }>('/api/v1/access-codes', body),
  },
  conversations: {
    list: () => apiClient.get<{ data: Conversation[] }>('/api/v1/conversations'),
    create: (body: CreateConversationInput) =>
      apiClient.post<{ data: Conversation }>('/api/v1/conversations', body),
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
  payments: {
    initialize: (invoiceId: string) =>
      apiClient.post<{ data: { authorizationUrl: string; reference: string } }>(
        '/api/v1/payments/initialize',
        {
          invoiceId,
        },
      ),
  },
  subscriptions: {
    me: () => apiClient.get<{ data: Subscription }>('/api/v1/subscriptions/me'),
    checkout: (body: CheckoutSubscriptionInput) =>
      apiClient.post<{
        data:
          { activated: true; subscription: Subscription } | { invoiceId: string; amount: number };
      }>('/api/v1/subscriptions/checkout', body),
  },
  applications: {
    list: (params?: { status?: string; unitId?: string }) =>
      apiClient.get<{ data: Application[] }>('/api/v1/applications', { params }),
    get: (id: string) => apiClient.get<{ data: Application }>(`/api/v1/applications/${id}`),
    create: (body: CreateApplicationInput) =>
      apiClient.post<{ data: Application }>('/api/v1/applications', body),
    review: (id: string, body: ReviewApplicationInput) =>
      apiClient.patch<{ data: Application }>(`/api/v1/applications/${id}`, body),
  },
  managerCodes: {
    list: () => apiClient.get<{ data: ManagerInviteCode[] }>('/api/v1/manager-codes'),
    create: () => apiClient.post<{ data: ManagerInviteCode }>('/api/v1/manager-codes'),
    setStatus: (id: string, status: 'ACTIVE' | 'DEACTIVATED') =>
      apiClient.patch<{ data: ManagerInviteCode }>(`/api/v1/manager-codes/${id}`, { status }),
    redeem: (code: string) =>
      apiClient.post<{ data: ManagerInviteCode }>('/api/v1/manager-codes/redeem', { code }),
  },
  adCampaigns: {
    get: (propertyId: string) =>
      apiClient.get<{ data: AdCampaign | null }>(`/api/v1/properties/${propertyId}/ads`),
    create: (propertyId: string, body: { budget: number; durationDays: number }) =>
      apiClient.post<{ data: AdCampaign }>(`/api/v1/properties/${propertyId}/ads`, body),
    cancel: (propertyId: string, adId: string) =>
      apiClient.patch<{ data: AdCampaign }>(`/api/v1/properties/${propertyId}/ads/${adId}`),
  },
};
