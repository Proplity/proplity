// Hand-written types matching each route's actual Zod input/response shape
// (no codegen in this repo). Only the fields Phase 7's forms actually need
// are modeled -- not a full mirror of every Prisma field.

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
};

export type Unit = {
  id: string;
  propertyId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  rentAmount: number;
  serviceCharge: number | null;
  listedPaymentFrequency: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  amenities: string[];
};

export type PropertyPendingChanges = {
  status: 'DRAFT' | 'PENDING_REVIEW';
  submittedAt?: string;
  updatedAt?: string;
  property?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    type?: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'MIXED_USE';
    description?: string;
    imageUrl?: string;
    photoUrls?: string[];
  };
  units?: {
    [unitId: string]: Partial<{
      unitNumber: string;
      bedrooms: number;
      bathrooms: number;
      rentAmount: number;
      serviceCharge: number;
      listedPaymentFrequency: string;
      amenities: string[];
    }>;
  };
  newUnits?: Array<{
    unitNumber: string;
    bedrooms: number;
    bathrooms: number;
    rentAmount: number;
    serviceCharge?: number;
    listedPaymentFrequency?: string;
    amenities?: string[];
  }>;
};

export type PropertyMetadata = {
  pendingChanges?: PropertyPendingChanges;
  [key: string]: unknown;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'MIXED_USE';
  description?: string | null;
  imageUrl?: string | null;
  exteriorPhotoUrl?: string | null;
  video360Url?: string | null;
  photoUrls?: string[];
  managerId?: string | null;
  landlordId?: string | null;
  manager?: { id: string; name: string; phoneNumber: string | null; email: string } | null;
  landlord?: {
    id: string;
    name: string;
    phoneNumber: string | null;
    email: string;
    role?: string;
  } | null;
  isPublished: boolean;
  trustScore: number | null;
  powerReliabilityScore: number | null;
  floodRiskScore: number | null;
  securityRating: number | null;
  roadConditionScore: number | null;
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  moderationNotes?: string | null;
  metadata?: PropertyMetadata | null;
  listingHash?: string | null;
  mergedIntoId?: string | null;
  mergedInto?: { id: string; name: string; address?: string; city?: string } | null;
  mergedFrom?: { id: string; name: string; address?: string; city?: string }[];
  waterSupplyType: 'BOREHOLE' | 'PUBLIC_GRID' | 'WATER_TANKER' | 'COMBINED';
  electricalSetup: 'PUBLIC_GRID' | 'GENERATOR' | 'INVERTER_SOLAR' | 'COMBINED';
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  isEdited?: boolean;
  units: Unit[];
};

export type PropertyReview = {
  id: string;
  reviewerId: string;
  rating: number;
  comment: string | null;
  verified: boolean;
  createdAt: string;
};

export type PropertyDetail = Property & {
  reviews: PropertyReview[];
  reviewStats: { count: number; averageRating: number | null };
  neighbourhoodReports: {
    generatedAt: string;
    security: Record<string, unknown> | null;
    electricity: Record<string, unknown> | null;
    water: Record<string, unknown> | null;
    roadNetwork: Record<string, unknown> | null;
    flooding: Record<string, unknown> | null;
    amenities: Record<string, unknown> | null;
    demographics: Record<string, unknown> | null;
  }[];
};

export type CreatePropertyInput = {
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode?: string;
  type?: string;
  description?: string;
  imageUrl?: string;
  video360Url?: string;
  exteriorPhotoUrl?: string;
  photoUrls?: string[];
};

export type UpdatePropertyInput = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  type?: string;
  description?: string;
  imageUrl?: string | null;
  video360Url?: string | null;
  exteriorPhotoUrl?: string | null;
  photoUrls?: string[];
  isPublished?: boolean;
  moderationStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  moderationNotes?: string;
  metadata?: PropertyMetadata | null;
  saveAsDraft?: boolean;
  submitForReview?: boolean;
  cancelPendingEdits?: boolean;
  deletePendingEdits?: boolean;
};

export type MergePropertyInput = {
  targetPropertyId: string;
};

export type UpdateUnitInput = Partial<CreateUnitInput> & {
  status?: string;
  action?: 'APPROVE' | 'REJECT';
  saveAsDraft?: boolean;
  cancelPendingEdits?: boolean;
  deletePendingEdits?: boolean;
};

export type CreateUnitInput = {
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
  serviceCharge?: number;
  listedPaymentFrequency?: string;
  depositAmount?: number;
  sqft?: number;
  amenities?: string[];
};

export type PropertyViewing = {
  id: string;
  propertyId: string;
  requestedById: string;
  requestedBy?: { name: string; email: string };
  scheduledAt: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes: string | null;
  createdAt: string;
};

export type CreateViewingInput = { scheduledAt: string; unitId?: string; notes?: string };

export type MaintenanceCategory = { id: string; name: string; isActive: boolean };

export type CreateMaintenanceRequestInput = {
  unitId: string;
  title: string;
  description: string;
  categoryId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  mediaUrls?: string[];
};

export type MaintenanceRequest = {
  id: string;
  unitId: string;
  unit?: Unit & { property?: Property };
  tenantId: string;
  tenant?: { id: string; name: string; email: string; phoneNumber: string | null };
  vendorId: string | null;
  vendor?: { id: string; name: string; phoneNumber?: string | null } | null;
  title: string;
  description: string;
  categoryId: string | null;
  category: MaintenanceCategory | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  status: 'SUBMITTED' | 'IN_PROGRESS' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  mediaUrls: string[];
  vendorNotes: string | null;
  completionProofUrl: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  costEstimate: number | null;
  finalCost: number | null;
  vendorRating?: { rating: number; comment: string | null } | null;
  // Present on the single-request fetch only (ISS-051).
  invoices?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    payments: { amount: number }[];
  }[];
  createdAt: string;
  updatedAt: string;
};

export type UpdateMaintenanceRequestInput = {
  categoryId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  vendorId?: string | null;
  scheduledFor?: string | null;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completionProofUrl?: string;
  finalCost?: number;
  vendorNotes?: string;
};

export type Vendor = {
  id: string;
  name: string;
  phoneNumber: string | null;
  businessName: string;
  categories: string[];
  coverageArea: string | null;
  jobsDone: number;
  totalJobs: number;
  completionRate: number | null;
  rating: number | null;
};

export type Notice = {
  id: string;
  leaseId: string;
  invoiceId: string | null;
  type:
    | 'RENEWAL_OFFER'
    | 'RENT_INCREASE'
    | 'DEFAULT_NOTICE'
    | 'EXPIRATION_ALERT'
    | 'PAYMENT_REMINDER'
    | 'TERMINATION_NOTICE';
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED';
  content: string | null;
  documentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export type CreateNoticeInput = {
  type: Notice['type'];
  content?: string;
  status?: Notice['status'];
};

export type Note = {
  id: string;
  leaseId: string | null;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Lease = {
  id: string;
  unitId: string;
  unit?: Unit & { property?: Property };
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    emergencyContactName?: string | null;
    emergencyContactRelationship?: string | null;
    emergencyContactPhone?: string | null;
  };
  startDate: string;
  endDate: string;
  rentAmount: number;
  serviceCharge: number;
  paymentFrequency: string;
  deposit: number;
  status: string;
  gracePeriodDays: number;
  lateFeeType: 'PERCENTAGE' | 'FIXED';
  lateFeePercentage: number;
  lateFeeFlatAmount: number;
  riskScore?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  paymentReliability?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | null;
  signedAgreementUrl?: string | null;
  agreementSignedAt?: string | null;
  signatures?: LeaseSignature[];
  notices?: Notice[];
  invoices?: Invoice[];
  tenantInvited?: boolean;
};

export type CreateLeaseInput = {
  unitId: string;
  tenantId?: string;
  tenantEmail?: string;
  tenantName?: string;
  tenantPhone?: string;
  applicationId?: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  serviceCharge?: number;
  paymentFrequency?: string;
  deposit: number;
  gracePeriodDays?: number;
  lateFeeType?: 'PERCENTAGE' | 'FIXED';
  lateFeePercentage?: number;
  lateFeeFlatAmount?: number;
};

export type UpdateLeaseTermsInput = {
  gracePeriodDays?: number;
  lateFeeType?: 'PERCENTAGE' | 'FIXED';
  lateFeePercentage?: number;
  lateFeeFlatAmount?: number;
};

export type RenewLeaseInput = {
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentFrequency?: string;
  deposit: number;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CASH' | 'CHECK';
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER' | 'CASH' | 'CHECK';
  transactionRef: string | null;
  paidAt: string;
  notes: string | null;
};

export type AutoPayMandate = {
  id: string;
  leaseId: string;
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER' | 'CASH' | 'CHECK';
  paymentMethodToken: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextChargeDate: string | null;
  lastChargedAt: string | null;
  createdAt: string;
};

export type CreateAutoPayMandateInput = {
  leaseId: string;
  paymentMethodToken: string;
  provider?: string;
  nextChargeDate?: string;
};

export type PaymentAuthorization = {
  authorizationCode: string;
  last4: string | null;
  cardType: string | null;
  bank: string | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  leaseId: string | null;
  lease?: {
    id: string;
    tenant: { id: string; name: string };
    unit: { unitNumber: string; property: { id: string; name: string } };
  } | null;
  maintenanceRequestId: string | null;
  userId: string | null;
  type:
    | 'RENT'
    | 'MAINTENANCE'
    | 'SECURITY_DEPOSIT'
    | 'UTILITY'
    | 'LATE_FEE'
    | 'ASSOCIATION_FEE'
    | 'SUBSCRIPTION';
  amount: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  description: string | null;
  payments: Payment[];
  createdAt: string;
};

export type CreateInvoiceInput = {
  maintenanceRequestId?: string;
  leaseId?: string;
  userId?: string;
  type:
    | 'RENT'
    | 'MAINTENANCE'
    | 'SECURITY_DEPOSIT'
    | 'UTILITY'
    | 'LATE_FEE'
    | 'ASSOCIATION_FEE'
    | 'SUBSCRIPTION'
    | 'SERVICE_CHARGE';
  amount: number;
  dueDate: string;
  description?: string;
};

export type AccessCode = {
  id: string;
  unitId: string;
  code: string;
  guestName: string | null;
  validFrom: string;
  validUntil: string | null;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  singleUse: boolean;
};

export type AccessLogEntry = {
  id: string;
  action: 'GRANTED' | 'DENIED' | 'EXPIRED_ATTEMPT' | 'REVOKED';
  occurredAt: string;
};

export type AccessCodeDetail = AccessCode & { logs: AccessLogEntry[] };

// POST /access-codes/verify: a code that does not exist answers { granted: false, reason: 'NOT_FOUND' }.
export type AccessVerifyResult = {
  granted: boolean;
  action?: AccessLogEntry['action'];
  reason?: 'NOT_FOUND';
  guestName?: string | null;
};

export type CreateAccessCodeInput = {
  unitId: string;
  code: string;
  guestName?: string;
  validFrom: string;
  validUntil?: string | null;
  singleUse?: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderType: 'USER' | 'AI_ASSISTANT' | 'SYSTEM';
  channel: 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'SMS';
  body: string;
  attachmentUrls: string[];
  createdAt: string;
};

export type ConversationParticipant = {
  userId: string;
  lastReadAt: string | null;
  user: { id: string; name: string; avatarUrl: string | null; role: string };
};

export type Conversation = {
  id: string;
  type: 'DIRECT' | 'MAINTENANCE_THREAD' | 'LEASE_THREAD' | 'COMMUNITY_DISCUSSION' | 'SUPPORT';
  title: string | null;
  maintenanceRequestId: string | null;
  leaseId: string | null;
  propertyId: string | null;
  property?: { id: string; name: string } | null;
  lease?: { unit: { unitNumber: string; property: { id: string; name: string } } } | null;
  maintenanceRequest?: { title: string } | null;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  lastReadAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateConversationInput = {
  type: 'DIRECT' | 'MAINTENANCE_THREAD' | 'LEASE_THREAD' | 'COMMUNITY_DISCUSSION' | 'SUPPORT';
  title?: string;
  participantIds?: string[];
  maintenanceRequestId?: string;
  leaseId?: string;
  propertyId?: string;
};

export type CreateMessageInput = {
  body: string;
  channel?: 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'SMS';
  attachmentUrls?: string[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'LANDLORD' | 'TENANT' | 'VENDOR';
  status: string;
  phoneNumber: string | null;
  createdAt: string;
  propertiesCount: number;
  vendorProfile?: {
    businessName: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    verificationNote: string | null;
  } | null;
};

export type AuditLog = {
  id: string;
  actorId: string | null;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  // A readable name for the thing the entry is about, when it still exists.
  entityLabel?: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type Subscription = {
  userId: string;
  tier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
  currentPeriodEnd: string | null;
};

export type CheckoutSubscriptionInput = {
  tier: 'FREE' | 'PRO';
  billingCycle?: 'monthly' | 'yearly';
  confirmDowngrade?: boolean;
};

export type Application = {
  id: string;
  unitId: string;
  applicantId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  details: Record<string, unknown>;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  leaseId?: string | null;
  createdAt: string;
  applicant?: { id: string; name: string; email: string; phoneNumber: string | null };
  unit?: { id: string; unitNumber: string; property: { id: string; name: string } };
};

export type CreateApplicationInput = { unitId: string; details: Record<string, unknown> };
export type ReviewApplicationInput = { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string };

export type LinkedLandlord = {
  codeId: string;
  landlord: { id: string; name: string };
  linkedAt: string | null;
  active: boolean;
};

export type ManagerInviteCode = {
  id: string;
  code: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  linkedManagerId: string | null;
  linkedManager?: { id: string; name: string; email: string } | null;
  landlord?: { id: string; name: string } | null;
  linkedAt: string | null;
  createdAt: string;
};

export type AdCampaign = {
  id: string;
  propertyId: string;
  budget: number;
  durationDays: number;
  status: 'ACTIVE' | 'CANCELLED';
  impressions: number;
  clicks: number;
  createdAt: string;
};

export type Announcement = {
  id: string;
  propertyId: string;
  authorId: string;
  author?: { id: string; name: string; role: string };
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
};

export type CreateAnnouncementInput = {
  title: string;
  body: string;
  isPinned?: boolean;
};

export type Notification = {
  id: string;
  recipientId: string;
  type: 'ANNOUNCEMENT' | 'MAINTENANCE_STATUS' | 'SYSTEM';
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export type Violation = {
  id: string;
  unitId: string;
  reportedById: string;
  reportedBy?: { id: string; name: string; role: string };
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  evidenceUrls: string[];
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type CreateViolationInput = {
  description: string;
  severity?: 'MINOR' | 'MODERATE' | 'SEVERE';
  evidenceUrls?: string[];
};

export type ConditionReport = {
  id: string;
  unitId: string;
  rooms: Record<string, unknown>;
  aiFlags: Record<string, unknown> | null;
  inconsistencyNotes: string | null;
  reportedAt: string;
  createdAt: string;
};

export type CreateConditionReportInput = {
  rooms: Record<string, unknown>;
  inconsistencyNotes?: string;
};

export type Equipment = {
  id: string;
  unitId: string | null;
  propertyId: string | null;
  type: 'HVAC' | 'WATER_HEATER' | 'GENERATOR' | 'INVERTER' | 'APPLIANCE' | 'ELEVATOR' | 'OTHER';
  serialNumber: string | null;
  installedAt: string | null;
  warrantyExpiresAt: string | null;
  createdAt: string;
};

export type CreateEquipmentInput = {
  unitId?: string;
  type: Equipment['type'];
  serialNumber?: string;
  installedAt?: string;
  warrantyExpiresAt?: string;
};

export type BankAccount = {
  id: string;
  userId: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  isDefault: boolean;
  createdAt: string;
};

export type CreateBankAccountInput = {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  isDefault?: boolean;
};

export type LeaseSignature = {
  id: string;
  leaseId: string;
  signerId: string;
  signer?: { id: string; name: string; role: string };
  signerRole: string;
  fullNameTyped: string;
  ipAddress: string | null;
  signedAt: string;
};

// Server-computed dashboard totals (GET /dashboard/summary, ISS-049).
export type OwnerDashboardSummary = {
  properties: {
    count: number;
    rows: {
      id: string;
      name: string;
      units: number;
      occupied: number;
      occupancy: number;
      listedRent: number;
      collected: number;
      pending: number;
    }[];
  };
  managers: { id: string; name: string }[];
  units: { total: number; occupied: number; occupancyRate: number; totalListedRent: number };
  leases: { active: number; upcomingRenewalCount: number };
  money: {
    collected: number;
    collectedThisMonth: number;
    pending: number;
    maintenanceCosts: number;
  };
  maintenance: { pending: number };
  upcomingRenewals: {
    id: string;
    endDate: string;
    tenant: { name: string } | null;
    unit: { unitNumber: string; property: { name: string } } | null;
  }[];
  recentPayments: {
    id: string;
    amount: number;
    paidAt: string;
    invoiceNumber: string;
    type: string;
    leaseId: string | null;
    tenant: string | null;
    property: string | null;
  }[];
  recentCompletedMaintenance: {
    id: string;
    completedAt: string | null;
    finalCost: number | null;
    unit: { property: { name: string } } | null;
  }[];
  recentLeases: {
    id: string;
    startDate: string;
    tenant: { name: string } | null;
    unit: { property: { name: string } } | null;
  }[];
};

// GET /admin/summary (ISS-049).
export type AdminDashboardSummary = {
  users: { total: number; byRole: Record<string, number>; newThisWeek: number };
  properties: { total: number; newThisWeek: number };
  money: { collected: number };
  maintenance: { open: number };
  attentionItems: {
    title: string;
    time: string;
    severity: 'high' | 'medium';
    href: string | null;
  }[];
};

// GET /admin/reports?from=YYYY-MM&to=YYYY-MM (ISS-049). Series are keyed by
// UTC month ('YYYY-MM'); months with no activity are absent.
export type AdminReportsSummary = {
  totals: {
    collected: number;
    paymentCount: number;
    avgTransactionValue: number;
    pending: number;
    invoiceCount: number;
    cancelledInvoices: number;
  };
  series: {
    billed: Record<string, number>;
    collected: Record<string, number>;
    newUsers: Record<string, Record<string, number>>;
    maintenanceCreated: Record<string, number>;
    maintenanceResolved: Record<string, number>;
  };
  revenueByType: { type: string; amount: number }[];
  recentPayments: {
    id: string;
    amount: number;
    paidAt: string;
    type: string;
    tenant: string | null;
    property: string | null;
  }[];
  users: {
    total: number;
    byRole: Record<string, number>;
    statusByRole: Record<string, { active: number; pending: number; other: number }>;
  };
  maintenance: {
    total: number;
    completed: number;
    open: number;
    highPriorityOpen: number;
    avgResolutionDays: number;
  };
  properties: {
    total: number;
    approved: number;
    byType: Record<string, number>;
    byState: {
      state: string;
      total: number;
      approved: number;
      pending: number;
      avgRent: number;
      occupancy: number;
    }[];
  };
  units: { total: number; occupied: number; avgOccupancy: number; avgRent: number };
};

// GET /dashboard/breakdown (ISS-049): totals and chart data for the pages
// opened from a dashboard card.
export type OwnerBreakdownSummary = {
  properties: { count: number; fully: number; partial: number; vacant: number };
  leases: {
    active: number;
    terminated: number;
    paid: number;
    due: number;
    overdue: number;
    rentStatusByLease: Record<string, 'due' | 'overdue'>;
  };
  money: {
    collected: number;
    collectedThisMonth: number;
    pending: number;
    collectionRate: number;
    paymentCount: number;
    trend: { month: string; expected: number; collected: number }[];
    byProperty: { name: string; amount: number }[];
    methods: { name: string; count: number }[];
  };
  maintenance: { open: number; high: number; medium: number; low: number };
  renewals: {
    count: number;
    urgent: number;
    soon: number;
    later: number;
    rows: {
      id: string;
      endDate: string;
      rentAmount: number;
      tenant: string | null;
      property: string | null;
      unitNumber: string | null;
      daysLeft: number;
    }[];
  };
  payments: {
    id: string;
    amount: number;
    paidAt: string;
    method: string;
    tenant: string | null;
    property: string | null;
  }[];
};

// GET /admin/breakdown (ISS-049).
export type AdminBreakdownSummary = {
  users: { total: number; manager: number; landlord: number; tenant: number; vendor: number };
  properties: { total: number; approved: number; pending: number; flagged: number };
  money: { collected: number; pending: number; cancelled: number; paymentCount: number };
  maintenance: { open: number; high: number; medium: number; low: number };
};

// GET /dashboard/mine (ISS-049): totals over the caller's own records.
export type TenantDashboardSummary = {
  money: { balance: number };
  nextDue: { id: string; dueDate: string; amount: number; status: string } | null;
  recentPayments: {
    id: string;
    amount: number;
    paidAt: string;
    invoiceNumber: string;
    type: string;
  }[];
};

export type VendorDashboardSummary = {
  jobs: {
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    onTimeRate: number | null;
  };
  earnings: {
    completedThisMonth: number;
    thisMonth: number;
    completedThisWeek: number;
    thisWeek: number;
    pendingPayments: number;
    totalPaid: number;
  };
  rating: { average: number | null; count: number };
};

// PRD §5.1 / §5.2 / ISS-012 "Bank-Transfer Reconciliation"
export type BankTransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type BankTransferSubmission = {
  id: string;
  invoiceId: string;
  submittedById: string;
  amount: number;
  bankName: string;
  senderAccountName: string;
  senderAccountNumber?: string | null;
  referenceNumber: string;
  paymentDate: string;
  proofFileUrl?: string | null;
  notes?: string | null;
  status: BankTransferStatus;
  reconciledById?: string | null;
  reconciledAt?: string | null;
  rejectionReason?: string | null;
  paymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    type: string;
    dueDate: string;
  };
  submittedBy?: { id: string; name: string; email: string };
  reconciledBy?: { id: string; name: string; role: string } | null;
  payment?: { id: string; amount: number; paidAt: string; transactionRef: string | null } | null;
};

export type SubmitBankTransferInput = {
  invoiceId: string;
  amount: number;
  bankName: string;
  senderAccountName: string;
  senderAccountNumber?: string;
  referenceNumber: string;
  paymentDate: string;
  proofFileUrl?: string;
  notes?: string;
};

// PRD §5.4 / §5.5 / ISS-012 "Vendor Payouts"
export type VendorPayoutStatus =
  'PENDING_APPROVAL' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';

export type PayoutMethod = 'BANK_TRANSFER' | 'PAYSTACK_TRANSFER' | 'MANUAL';

export type VendorPayout = {
  id: string;
  payoutNumber: string;
  vendorId: string;
  invoiceId?: string | null;
  maintenanceRequestId?: string | null;
  amount: number;
  currency: string;
  status: VendorPayoutStatus;
  payoutMethod: PayoutMethod;
  bankAccountId?: string | null;
  reference?: string | null;
  transferCode?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  initiatedById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vendor?: { id: string; name: string; email: string; phone?: string | null };
  bankAccount?: { id: string; bankName: string; accountName: string; accountNumber: string } | null;
  invoice?: { id: string; invoiceNumber: string; amount: number; status: string } | null;
  maintenanceRequest?: { id: string; title: string; status: string } | null;
  initiatedBy?: { id: string; name: string; role: string };
  approvedBy?: { id: string; name: string; role: string } | null;
};

export type InitiateVendorPayoutInput = {
  vendorId: string;
  invoiceId?: string;
  maintenanceRequestId?: string;
  amount: number;
  bankAccountId?: string;
  payoutMethod?: PayoutMethod;
  notes?: string;
};
