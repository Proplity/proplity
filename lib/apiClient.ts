import axios from 'axios';
import type { AttentionItem } from '@/lib/dashboardAttention';
import type {
  AccessCode,
  AgreementTemplate,
  AgreementTemplateInput,
  AccessCodeDetail,
  AccessVerifyResult,
  AdCampaign,
  AdminUser,
  Announcement,
  Application,
  AuditLog,
  AutoPayMandate,
  BankAccount,
  CheckoutSubscriptionInput,
  CreditEntry,
  InvitationBatchResult,
  Jurisdiction,
  JurisdictionInput,
  PaidService,
  PortfolioImportResult,
  PortfolioPreview,
  Plan,
  PlanInput,
  TeamOverview,
  CreateAutoPayMandateInput,
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
  CreateRentInput,
  UpdateRentTermsInput,
  RenewRentInput,
  CreateMaintenanceRequestInput,
  CreateMessageInput,
  CreatePropertyInput,
  CreateUnitInput,
  UpdateUnitInput,
  CreateViewingInput,
  MergePropertyInput,
  UpdatePropertyInput,
  OwnerDashboardSummary,
  OwnerBreakdownSummary,
  TenantDashboardSummary,
  VendorDashboardSummary,
  AdminBreakdownSummary,
  AdminDashboardSummary,
  AdminReportsSummary,
  PropertyViewing,
  LinkedLandlord,
  CreateViolationInput,
  Equipment,
  Invoice,
  Rent,
  RentSignature,
  CreateScheduleInput,
  MaintenanceCategory,
  MaintenanceRequest,
  MaintenanceSchedule,
  UpdateScheduleInput,
  ManagerInviteCode,
  Message,
  Note,
  Notice,
  CreateNoticeInput,
  Notification,
  Paginated,
  PaymentAuthorization,
  Property,
  ReviewApplicationInput,
  Subscription,
  Unit,
  UpdateMaintenanceRequestInput,
  RepairAnswerInput,
  RepairReviewInput,
  PlatformSettings,
  AdminPlatformSettings,
  PaymentRules,
  Vendor,
  Violation,
  BankTransferStatus,
  BankTransferSubmission,
  SubmitBankTransferInput,
  VendorPayoutStatus,
  VendorPayout,
  InitiateVendorPayoutInput,
} from './api/types';
import type { UploadFolder } from '@/lib/fileRef';
import type { Receipt } from '@/lib/receiptTypes';

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

// A 401 that comes back after the person has left the page that asked used to send the whole tab
// to /login: a slow request left behind by the page they had just signed out of threw a visitor
// off the public home page. Only the page that made the request may be sent to the sign-in screen.
const currentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname);

function sendToLogin(startedOn: string) {
  if (typeof window === 'undefined' || window.location.pathname !== startedOn) return;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears client state
  window.location.href = '/login';
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** The page the request was made from (see `sendToLogin`). */
    startedOn?: string;
  }
}

apiClient.interceptors.request.use((config) => {
  config.startedOn ??= currentPath();
  return config;
});

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
      } else {
        sendToLogin(originalRequest.startedOn ?? currentPath());
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Backward-compatible fetch wrapper using single refresh deduplication logic
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const startedOn = currentPath();
  const response = await fetch(url, options);

  if (response.status === 401 && !url.includes('/api/v1/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetch(url, options);
    } else {
      sendToLogin(startedOn);
    }
  }

  return response;
}

// Domain-grouped typed methods, built on the same apiClient instance (and
// therefore the same 401-refresh interceptor above) -- kept minimal to what
// Phase 7's forms actually call, not a full mirror of every domain route.
export type UploadPlan =
  | { mode: 'proxy'; uploadUrl: string; fileId: string }
  | { mode: 'direct'; kind: 'form-post'; url: string; fields: Record<string, string> }
  | { mode: 'direct'; kind: 'put'; url: string; headers: Record<string, string> };

export const api = {
  properties: {
    list: (params?: { city?: string; state?: string; minBedrooms?: number }) =>
      apiClient.get<Paginated<Property>>('/api/v1/properties', { params }),
    mine: (params?: { page?: number; limit?: number }) =>
      apiClient.get<Paginated<Property>>('/api/v1/properties', {
        params: { scope: 'mine', ...params },
      }),
    get: (propertyId: string) =>
      apiClient.get<{ data: Property }>(`/api/v1/properties/${propertyId}`),
    saveNeighbourhoodReport: (propertyId: string, body: Record<string, Record<string, unknown>>) =>
      apiClient.put<{ data: unknown }>(
        `/api/v1/properties/${propertyId}/neighbourhood-report`,
        body,
      ),
    create: (body: CreatePropertyInput) =>
      apiClient.post<{ data: Property }>('/api/v1/properties', body),
    listUnits: (propertyId: string, status?: string) =>
      apiClient.get<{ data: Unit[] }>(`/api/v1/properties/${propertyId}/units`, {
        params: status ? { status } : undefined,
      }),
    createUnit: (propertyId: string, body: CreateUnitInput) =>
      apiClient.post<{ data: Unit }>(`/api/v1/properties/${propertyId}/units`, body),
    updateUnit: (propertyId: string, unitId: string, body: UpdateUnitInput) =>
      apiClient.patch<{ data: Unit }>(`/api/v1/properties/${propertyId}/units/${unitId}`, body),
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
    /** A file of properties, units and tenants: preview first (saves nothing), then import it. */
    importPortfolio: (file: File, opts: { preview?: boolean; confirmOverage?: boolean } = {}) => {
      const formData = new FormData();
      formData.append('file', file);
      if (opts.preview) formData.append('preview', 'true');
      if (opts.confirmOverage) formData.append('confirmOverage', 'true');
      return apiClient.post<{ data: PortfolioPreview & PortfolioImportResult }>(
        '/api/v1/properties/import',
        formData,
        { headers: { 'Content-Type': undefined } },
      );
    },
    createViewing: (propertyId: string, body: CreateViewingInput) =>
      apiClient.post<{ data: unknown }>(`/api/v1/properties/${propertyId}/viewings`, body),
    viewingAvailability: (propertyId: string, date: string) =>
      apiClient.get<{ data: { date: string; taken: string[] } }>(
        `/api/v1/properties/${propertyId}/viewings/availability`,
        { params: { date } },
      ),
    listViewings: (propertyId: string) =>
      apiClient.get<{ data: PropertyViewing[] }>(`/api/v1/properties/${propertyId}/viewings`),
    updateViewing: (propertyId: string, viewingId: string, status: 'CONFIRMED' | 'CANCELLED') =>
      apiClient.patch<{ data: PropertyViewing }>(
        `/api/v1/properties/${propertyId}/viewings/${viewingId}`,
        { status },
      ),
    setPublished: (propertyId: string, isPublished: boolean) =>
      apiClient.patch<{ data: Property }>(`/api/v1/properties/${propertyId}`, { isPublished }),
    update: (propertyId: string, body: UpdatePropertyInput) =>
      apiClient.patch<{ data: Property }>(`/api/v1/properties/${propertyId}`, body),
    merge: (propertyId: string, targetPropertyIdOrBody: string | MergePropertyInput) => {
      const body: MergePropertyInput =
        typeof targetPropertyIdOrBody === 'string'
          ? { targetPropertyId: targetPropertyIdOrBody }
          : targetPropertyIdOrBody;
      return apiClient.post<{ data: Property }>(`/api/v1/properties/${propertyId}/merge`, body);
    },
    unmerge: (propertyId: string) =>
      apiClient.post<{ data: Property }>(`/api/v1/properties/${propertyId}/unmerge`),
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
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      apiClient.get<Paginated<MaintenanceRequest>>('/api/v1/maintenance/requests', { params }),
    get: (id: string) =>
      apiClient.get<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`),
    update: (id: string, body: UpdateMaintenanceRequestInput) =>
      apiClient.patch<{ data: MaintenanceRequest }>(`/api/v1/maintenance/requests/${id}`, body),
    createRequest: (body: CreateMaintenanceRequestInput) =>
      apiClient.post<{ data: { id: string } }>('/api/v1/maintenance/requests', body),
    schedules: {
      list: (params?: { page?: number; limit?: number }) =>
        apiClient.get<Paginated<MaintenanceSchedule>>('/api/v1/maintenance/schedules', { params }),
      create: (body: CreateScheduleInput) =>
        apiClient.post<{ data: MaintenanceSchedule }>('/api/v1/maintenance/schedules', body),
      update: (id: string, body: UpdateScheduleInput) =>
        apiClient.patch<{ data: MaintenanceSchedule }>(`/api/v1/maintenance/schedules/${id}`, body),
      remove: (id: string) =>
        apiClient.delete<{ data: { id: string } }>(`/api/v1/maintenance/schedules/${id}`),
    },
    rateVendor: (id: string, body: { rating: number; comment?: string }) =>
      apiClient.post<{ data: unknown }>(`/api/v1/maintenance/requests/${id}/rating`, body),
    answerRepair: (id: string, body: RepairAnswerInput) =>
      apiClient.post<{ data: MaintenanceRequest }>(
        `/api/v1/maintenance/requests/${id}/confirmation`,
        body,
      ),
    reviewRepair: (id: string, body: RepairReviewInput) =>
      apiClient.post<{ data: MaintenanceRequest }>(
        `/api/v1/maintenance/requests/${id}/review`,
        body,
      ),
  },
  vendors: {
    list: () => apiClient.get<{ data: Vendor[] }>('/api/v1/vendors'),
  },
  rents: {
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      apiClient.get<Paginated<Rent>>('/api/v1/rents', { params }),
    get: (id: string) => apiClient.get<{ data: Rent }>(`/api/v1/rents/${id}`),
    create: (body: CreateRentInput) => apiClient.post<{ data: Rent }>('/api/v1/rents', body),
    updateTerms: (id: string, body: UpdateRentTermsInput) =>
      apiClient.patch<{ data: Rent }>(`/api/v1/rents/${id}`, body),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<{ data: Rent }>(`/api/v1/rents/${id}`, { status }),
    renew: (id: string, body: RenewRentInput) =>
      apiClient.patch<{ data: Rent }>(`/api/v1/rents/${id}`, { renew: body }),
    /** Send (or send again) the invitation email to a tenant who has not signed in yet. */
    invite: (id: string) =>
      apiClient.post<{ data: { invitation: 'INVITED' } }>(`/api/v1/rents/${id}/invite`),
    /** Send every waiting invitation that today's limit allows. */
    inviteAll: () => apiClient.post<{ data: InvitationBatchResult }>('/api/v1/rents/invitations'),
    sign: (id: string, fullName: string) =>
      apiClient.post<{ data: RentSignature }>(`/api/v1/rents/${id}/sign`, { fullName }),
    notes: {
      list: (rentId: string) => apiClient.get<{ data: Note[] }>(`/api/v1/rents/${rentId}/notes`),
      create: (rentId: string, body: string) =>
        apiClient.post<{ data: Note }>(`/api/v1/rents/${rentId}/notes`, { body }),
    },
    notices: {
      list: (rentId: string) =>
        apiClient.get<{ data: Notice[] }>(`/api/v1/rents/${rentId}/notices`),
      create: (rentId: string, body: CreateNoticeInput) =>
        apiClient.post<{ data: Notice }>(`/api/v1/rents/${rentId}/notices`, body),
    },
  },
  dashboard: {
    summary: () => apiClient.get<{ data: OwnerDashboardSummary }>('/api/v1/dashboard/summary'),
    breakdown: () => apiClient.get<{ data: OwnerBreakdownSummary }>('/api/v1/dashboard/breakdown'),
    mineTenant: () => apiClient.get<{ data: TenantDashboardSummary }>('/api/v1/dashboard/mine'),
    mineVendor: () => apiClient.get<{ data: VendorDashboardSummary }>('/api/v1/dashboard/mine'),
    attention: () => apiClient.get<{ data: AttentionItem[] }>('/api/v1/dashboard/attention'),
  },
  invoices: {
    list: (params?: { type?: string; status?: string; page?: number; limit?: number }) =>
      apiClient.get<Paginated<Invoice>>('/api/v1/invoices', { params }),
    create: (body: CreateInvoiceInput) =>
      apiClient.post<{ data: Invoice }>('/api/v1/invoices', body),
  },
  accessCodes: {
    list: (unitId: string) =>
      apiClient.get<{ data: AccessCode[] }>('/api/v1/access-codes', { params: { unitId } }),
    create: (body: CreateAccessCodeInput) =>
      apiClient.post<{ data: AccessCode }>('/api/v1/access-codes', body),
    get: (id: string) => apiClient.get<{ data: AccessCodeDetail }>(`/api/v1/access-codes/${id}`),
    revoke: (id: string) => apiClient.delete<{ data: AccessCode }>(`/api/v1/access-codes/${id}`),
    verify: (body: { unitId: string; code: string }) =>
      apiClient.post<{ data: AccessVerifyResult }>('/api/v1/access-codes/verify', body),
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
      list: (params?: {
        role?: string;
        status?: string;
        vendorStatus?: string;
        q?: string;
        limit?: number;
        page?: number;
      }) => apiClient.get<Paginated<AdminUser>>('/api/v1/admin/users', { params }),
    },
    updateUser: (
      userId: string,
      body: { status?: 'ACTIVE' | 'SUSPENDED'; role?: string; reason: string },
    ) => apiClient.patch(`/api/v1/admin/users/${userId}`, body),
    summary: () => apiClient.get<{ data: AdminDashboardSummary }>('/api/v1/admin/summary'),
    breakdown: () => apiClient.get<{ data: AdminBreakdownSummary }>('/api/v1/admin/breakdown'),
    reports: (params: { from: string; to: string }) =>
      apiClient.get<{ data: AdminReportsSummary }>('/api/v1/admin/reports', { params }),
    vendors: {
      verify: (userId: string, body: { status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
        apiClient.patch(`/api/v1/admin/vendors/${userId}`, body),
    },
    auditLogs: {
      list: (params?: {
        action?: string;
        entityType?: string;
        entityId?: string;
        actor?: string;
        q?: string;
        from?: string;
        to?: string;
        facets?: 1;
        limit?: number;
        page?: number;
      }) =>
        apiClient.get<
          Paginated<AuditLog> & { facets?: { actions: string[]; entityTypes: string[] } }
        >('/api/v1/admin/audit-logs', { params }),
    },
    plans: {
      list: () => apiClient.get<{ data: Plan[] }>('/api/v1/admin/plans'),
      create: (body: PlanInput) => apiClient.post<{ data: Plan }>('/api/v1/admin/plans', body),
      update: (id: string, body: Partial<Omit<Plan, 'id' | 'key'>>) =>
        apiClient.patch<{ data: Plan }>(`/api/v1/admin/plans/${id}`, body),
      remove: (id: string) => apiClient.delete(`/api/v1/admin/plans/${id}`),
    },
    jurisdictions: {
      list: () => apiClient.get<{ data: Jurisdiction[] }>('/api/v1/admin/jurisdictions'),
      create: (body: JurisdictionInput & { key: string; name: string }) =>
        apiClient.post<{ data: Jurisdiction }>('/api/v1/admin/jurisdictions', body),
      update: (id: string, body: Omit<JurisdictionInput, 'key'>) =>
        apiClient.patch<{ data: Jurisdiction }>(`/api/v1/admin/jurisdictions/${id}`, body),
      remove: (id: string) => apiClient.delete(`/api/v1/admin/jurisdictions/${id}`),
    },
    agreementTemplates: {
      list: () => apiClient.get<{ data: AgreementTemplate[] }>('/api/v1/admin/agreement-templates'),
      create: (
        body: AgreementTemplateInput & {
          key: string;
          name: string;
          jurisdictionId: string;
          clauses: NonNullable<AgreementTemplateInput['clauses']>;
        },
      ) => apiClient.post<{ data: AgreementTemplate }>('/api/v1/admin/agreement-templates', body),
      update: (id: string, body: Omit<AgreementTemplateInput, 'key' | 'jurisdictionId'>) =>
        apiClient.patch<{ data: AgreementTemplate }>(
          `/api/v1/admin/agreement-templates/${id}`,
          body,
        ),
      remove: (id: string) => apiClient.delete(`/api/v1/admin/agreement-templates/${id}`),
      approve: (id: string) =>
        apiClient.post<{ data: AgreementTemplate }>(
          `/api/v1/admin/agreement-templates/${id}/approve`,
        ),
      newVersion: (id: string) =>
        apiClient.post<{ data: AgreementTemplate }>(
          `/api/v1/admin/agreement-templates/${id}/new-version`,
        ),
      archive: (id: string) =>
        apiClient.post<{ data: AgreementTemplate }>(
          `/api/v1/admin/agreement-templates/${id}/archive`,
        ),
    },
    services: {
      list: () => apiClient.get<{ data: PaidService[] }>('/api/v1/admin/services'),
      create: (body: {
        key: string;
        name: string;
        description?: string | null;
        creditCost: number;
        isActive?: boolean;
      }) => apiClient.post<{ data: PaidService }>('/api/v1/admin/services', body),
      update: (id: string, body: Partial<Omit<PaidService, 'id' | 'key'>>) =>
        apiClient.patch<{ data: PaidService }>(`/api/v1/admin/services/${id}`, body),
      remove: (id: string) => apiClient.delete(`/api/v1/admin/services/${id}`),
    },
    credits: {
      grant: (body: { email: string; amount: number; note?: string }) =>
        apiClient.post<{ data: { userId: string; name: string | null; balance: number } }>(
          '/api/v1/admin/credits',
          body,
        ),
    },
    settings: {
      get: () => apiClient.get<{ data: AdminPlatformSettings }>('/api/v1/admin/settings'),
      update: (data: Partial<Omit<PlatformSettings, 'setupComplete'>>) =>
        apiClient.patch<{ data: AdminPlatformSettings }>('/api/v1/admin/settings', data),
    },
  },
  settings: {
    paymentRules: () => apiClient.get<{ data: PaymentRules }>('/api/v1/settings/payment-rules'),
  },
  notifications: {
    list: (params?: { limit?: number; cursor?: string }) =>
      apiClient.get<{
        data: Notification[];
        meta: { hasMore: boolean; nextCursor: string | null; unreadCount: number };
      }>('/api/v1/notifications', { params }),
    markRead: (id: string, isRead: boolean = true) =>
      apiClient.patch<{ data: Notification }>(`/api/v1/notifications/${id}`, { isRead }),
    markAllRead: () =>
      apiClient.post<{ data: { updated: number } }>('/api/v1/notifications/mark-all-read'),
    remove: (id: string) =>
      apiClient.delete<{ data: { id: string } }>(`/api/v1/notifications/${id}`),
  },
  payments: {
    availability: () => apiClient.get<{ data: { card: boolean } }>('/api/v1/payments/availability'),
    initialize: (invoiceId: string) =>
      apiClient.post<{ data: { authorizationUrl: string; reference: string } }>(
        '/api/v1/payments/initialize',
        {
          invoiceId,
        },
      ),
    receipt: (paymentId: string) =>
      apiClient.get<{ data: Receipt }>(`/api/v1/payments/${paymentId}/receipt`),
    authorization: (rentId: string) =>
      apiClient.get<{ data: PaymentAuthorization | null }>('/api/v1/payments/authorization', {
        params: { rentId },
      }),
    autopay: {
      list: (rentId: string) =>
        apiClient.get<{ data: AutoPayMandate[] }>('/api/v1/payments/autopay', {
          params: { rentId },
        }),
      create: (body: CreateAutoPayMandateInput) =>
        apiClient.post<{ data: AutoPayMandate }>('/api/v1/payments/autopay', body),
      cancel: (id: string) =>
        apiClient.delete<{ data: AutoPayMandate }>('/api/v1/payments/autopay', { params: { id } }),
    },
  },
  uploads: {
    sign: (body: { folder: UploadFolder; fileName: string; contentType: string; size: number }) =>
      apiClient.post<{ data: { file: { id: string; url: string }; plan: UploadPlan } }>(
        '/api/v1/uploads/sign',
        body,
      ),
    complete: (body: { fileId: string; claimed?: Record<string, unknown> }) =>
      apiClient.post<{ data: { id: string; url: string; name: string } }>(
        '/api/v1/uploads/complete',
        body,
      ),
  },
  jurisdictions: {
    list: () => apiClient.get<{ data: Jurisdiction[] }>('/api/v1/jurisdictions'),
  },
  plans: {
    list: () => apiClient.get<{ data: Plan[] }>('/api/v1/plans'),
  },
  team: {
    get: () => apiClient.get<{ data: TeamOverview }>('/api/v1/team'),
    create: (name: string) =>
      apiClient.post<{ data: { id: string; name: string } }>('/api/v1/team', { name }),
    rename: (name: string) =>
      apiClient.patch<{ data: { id: string; name: string } }>('/api/v1/team', { name }),
    addMember: (body: { name: string; email: string; phoneNumber?: string }) =>
      apiClient.post<{ data: { id: string; name: string; email: string } }>(
        '/api/v1/team/members',
        body,
      ),
    removeMember: (id: string) =>
      apiClient.delete<{ data: { id: string; propertiesReassigned: number } }>(
        `/api/v1/team/members/${id}`,
      ),
  },
  services: {
    list: () =>
      apiClient.get<{
        data: { key: string; name: string; description: string | null; creditCost: number }[];
      }>('/api/v1/services'),
  },
  credits: {
    me: () =>
      apiClient.get<{ data: { balance: number; entries: CreditEntry[] } }>('/api/v1/credits/me'),
  },
  subscriptions: {
    me: () => apiClient.get<{ data: Subscription }>('/api/v1/subscriptions/me'),
    checkout: (body: CheckoutSubscriptionInput) =>
      apiClient.post<{
        data:
          | { activated: true; subscription: unknown }
          | { activated: false; scheduled: true; endsAt: string; subscription: unknown }
          | {
              invoiceId: string;
              amount: number;
              breakdown: { base: number; overage: number; extraUnits: number };
            };
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
    create: (body?: { email?: string }) =>
      apiClient.post<{ data: ManagerInviteCode; invitedEmail?: string }>(
        '/api/v1/manager-codes',
        body,
      ),
    setStatus: (id: string, status: 'ACTIVE' | 'DEACTIVATED') =>
      apiClient.patch<{ data: ManagerInviteCode }>(`/api/v1/manager-codes/${id}`, { status }),
    linked: () => apiClient.get<{ data: LinkedLandlord[] }>('/api/v1/manager-codes/linked'),
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
  bankTransfers: {
    list: (params?: {
      status?: BankTransferStatus;
      invoiceId?: string;
      page?: number;
      limit?: number;
    }) => apiClient.get<Paginated<BankTransferSubmission>>('/api/v1/bank-transfers', { params }),
    get: (id: string) =>
      apiClient.get<{ data: BankTransferSubmission }>(`/api/v1/bank-transfers/${id}`),
    submit: (body: SubmitBankTransferInput) =>
      apiClient.post<{ data: BankTransferSubmission }>('/api/v1/bank-transfers', body),
    reconcile: (
      id: string,
      body: { action: 'APPROVE' | 'REJECT'; notes?: string; rejectionReason?: string },
    ) =>
      apiClient.post<{
        data: {
          submission: BankTransferSubmission;
          payment?: unknown;
          newStatus?: string;
        };
      }>(`/api/v1/bank-transfers/${id}/reconcile`, body),
  },
  vendorPayouts: {
    list: (params?: {
      status?: VendorPayoutStatus;
      vendorId?: string;
      invoiceId?: string;
      page?: number;
      limit?: number;
    }) => apiClient.get<Paginated<VendorPayout>>('/api/v1/vendor-payouts', { params }),
    get: (id: string) => apiClient.get<{ data: VendorPayout }>(`/api/v1/vendor-payouts/${id}`),
    initiate: (body: InitiateVendorPayoutInput) =>
      apiClient.post<{ data: VendorPayout }>('/api/v1/vendor-payouts', body),
    patch: (
      id: string,
      body: {
        action: 'APPROVE' | 'PROCESS' | 'REJECT';
        reason?: string;
        externalReference?: string;
        manualNote?: string;
      },
    ) => apiClient.patch<{ data: VendorPayout }>(`/api/v1/vendor-payouts/${id}`, body),
  },
};
