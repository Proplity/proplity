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
  /** Kept for tenant management only: never listed, never in the admin review queue. */
  managementOnly?: boolean;
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
  kind: 'TENANT' | 'VISITOR';
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
  /** Keep it for tenant management only: never listed, never reviewed by an admin. */
  managementOnly?: boolean;
};

export type UpdatePropertyInput = {
  /** false lists a management-only property publicly (it then waits for an admin's approval); true takes it off the market. */
  managementOnly?: boolean;
  /** A company's managing partner can hand a property to someone on their team. */
  managerId?: string;
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
  /** Sent again after the person has seen what units over their plan cost (OVERAGE_NEEDS_CONFIRMATION). */
  confirmOverage?: boolean;
};

export type PropertyViewing = {
  id: string;
  propertyId: string;
  requestedById: string;
  requestedBy?: {
    name: string;
    email: string;
    phoneNumber: string | null;
    createdAt: string;
    kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    hasIdOnFile: boolean;
  };
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
  /** Work orders only: hand it to a verified vendor straight away. */
  vendorId?: string;
};

export type ScheduleFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

/** A recurring repair the property team has set up for a unit. */
export type MaintenanceSchedule = {
  id: string;
  unitId: string;
  unit?: Unit & { property?: { id: string; name: string } };
  equipmentId: string | null;
  equipment?: Equipment | null;
  categoryId: string;
  category?: MaintenanceCategory;
  frequency: ScheduleFrequency;
  nextDueDate: string;
  lastGeneratedAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateScheduleInput = {
  unitId: string;
  categoryId: string;
  frequency: ScheduleFrequency;
  nextDueDate: string;
  equipmentId?: string;
};

export type UpdateScheduleInput = Partial<{
  categoryId: string;
  frequency: ScheduleFrequency;
  nextDueDate: string;
  equipmentId: string | null;
  isActive: boolean;
}>;

export type RepairConfirmationStatus =
  'NOT_REQUESTED' | 'AWAITING_TENANT' | 'CONFIRMED' | 'DISPUTED';

export type MaintenanceRequest = {
  id: string;
  unitId: string;
  unit?: Unit & { property?: Property };
  /** Null on a work order: a repair the property team raised itself, with no tenant. */
  tenantId: string | null;
  tenant?: { id: string; name: string; email: string; phoneNumber: string | null } | null;
  /** Who raised a work order (null when a tenant reported it). */
  createdBy?: { id: string; name: string } | null;
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
  /** The vendor's photos of the work, uploaded through the file gateway. */
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  /** The tenant's answer once the job is finished (the admin can switch the step off). */
  confirmationStatus: RepairConfirmationStatus;
  confirmationRespondedAt: string | null;
  disputeReason: string | null;
  disputePhotoUrls: string[];
  /** The property team's sign-off. */
  approvedAt: string | null;
  approvedBy?: { id: string; name: string } | null;
  scheduledFor: string | null;
  completedAt: string | null;
  costEstimate: number | null;
  finalCost: number | null;
  vendorRating?: { rating: number; comment: string | null } | null;
  // Present on the single-request fetch only.
  workflow?: { autoCompleteOnInvoice: boolean; evidenceRequired: boolean };
  // Present on the single-request fetch only (ISS-051).
  invoices?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    description: string | null;
    dueDate: string;
    createdAt: string;
    payments: Pick<Payment, 'id' | 'amount' | 'paidAt' | 'paymentMethod' | 'receiptNumber'>[];
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
  /** Each list replaces the stored photos (assigned vendor only). */
  beforePhotoUrls?: string[];
  afterPhotoUrls?: string[];
};

export type RepairAnswerInput =
  { outcome: 'CONFIRMED' } | { outcome: 'DISPUTED'; reason: string; photoUrls?: string[] };

export type RepairReviewInput =
  | { action: 'APPROVE' }
  | { action: 'REOPEN'; note?: string }
  | { action: 'REASSIGN'; vendorId: string; note?: string };

export type PlatformSettings = {
  setupComplete: boolean;
  autoCompleteMaintenanceOnInvoice: boolean;
  requireTenantRepairConfirmation: boolean;
  requireSecondPersonForTenantPayments: boolean;
  requireSecondPersonForVendorPayments: boolean;
  autopayChargingEnabled: boolean;
  retentionEnabled: boolean;
  retentionAfterTenancyDays: number;
  retentionAfterRejectionDays: number;
  tenantInvitesPerDay: number;
  inviteTenantsToManagementOnly: boolean;
  enforcePlanLimits: boolean;
  unitBillingOwner: 'MANAGER_ELSE_LANDLORD' | 'CREATOR' | 'BOTH';
  overageMode: 'ALLOW_AND_BILL' | 'HARD_STOP' | 'CONFIRM_EACH_TIME';
  downgradeRule: 'BLOCK' | 'GRACE_PERIOD' | 'ALLOW_AND_BILL';
  downgradeGraceDays: number;
  teamMemberAccess: 'ASSIGNED_ONLY' | 'ALL_COMPANY';
  agreementTemplatesNeedApproval: boolean;
  agreementLandlordNameByManager: boolean;
  agreementAgencyFee: boolean;
  agreementLegalFee: boolean;
  agreementCautionFee: boolean;
  rentActivationRule: 'INDEPENDENT' | 'AFTER_BOTH_SIGN';
  chargeForAgreements: boolean;
  chargeForUploads: boolean;
};

/** Platform Settings as the admin screen reads them: the settings plus what the deployment allows. */
export type AdminPlatformSettings = PlatformSettings & {
  deploymentAllows: { autopay: boolean; retention: boolean };
};

/** What a signed-in person needs to know about the payment rules (GET /settings/payment-rules). */
export type PaymentRules = Pick<
  PlatformSettings,
  'requireSecondPersonForTenantPayments' | 'requireSecondPersonForVendorPayments'
>;

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
  rentId: string;
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
  rentId: string | null;
  authorId: string;
  body: string;
  createdAt: string;
};

/** Where a tenant is in joining: signed in (JOINED), link sent (INVITED), link ran out (EXPIRED), or no invitation sent yet (NOT_SENT). */
export type InvitationState = 'JOINED' | 'INVITED' | 'EXPIRED' | 'NOT_SENT';

export type Rent = {
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
  signatures?: RentSignature[];
  notices?: Notice[];
  invoices?: Invoice[];
  tenantInvited?: boolean;
  invitation?: InvitationState;
};

export type CreateRentInput = {
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

export type UpdateRentTermsInput = {
  gracePeriodDays?: number;
  lateFeeType?: 'PERCENTAGE' | 'FIXED';
  lateFeePercentage?: number;
  lateFeeFlatAmount?: number;
};

export type RenewRentInput = {
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
  /** The number printed on this payment's receipt (`/receipts/<id>`). */
  receiptNumber: string;
};

export type AutoPayMandate = {
  id: string;
  rentId: string;
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER' | 'CASH' | 'CHECK';
  paymentMethodToken: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextChargeDate: string | null;
  lastChargedAt: string | null;
  createdAt: string;
};

export type CreateAutoPayMandateInput = {
  rentId: string;
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
  rentId: string | null;
  rent?: {
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
  rentId?: string;
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
  /** Who wrote it, kept even after they left the thread. */
  sender?: { id: string; name: string } | null;
  createdAt: string;
};

export type ConversationParticipant = {
  userId: string;
  lastReadAt: string | null;
  leftAt: string | null;
  user: { id: string; name: string; avatarUrl: string | null; role: string };
};

export type Conversation = {
  id: string;
  type: 'DIRECT' | 'MAINTENANCE_THREAD' | 'RENT_THREAD' | 'COMMUNITY_DISCUSSION' | 'SUPPORT';
  title: string | null;
  maintenanceRequestId: string | null;
  rentId: string | null;
  propertyId: string | null;
  property?: { id: string; name: string } | null;
  rent?: { unit: { unitNumber: string; property: { id: string; name: string } } } | null;
  maintenanceRequest?: { title: string } | null;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  lastReadAt: string | null;
  /** Set when the caller's tenancy ended: the thread is read-only up to this moment. */
  leftAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateConversationInput = {
  type: 'DIRECT' | 'MAINTENANCE_THREAD' | 'RENT_THREAD' | 'COMMUNITY_DISCUSSION' | 'SUPPORT';
  title?: string;
  participantIds?: string[];
  maintenanceRequestId?: string;
  rentId?: string;
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

/** A plan an admin has set up (Admin > Plans & billing). Prices are whole naira. */
export type Plan = {
  id: string;
  key: string;
  name: string;
  tagline: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  unitsIncluded: number;
  usersIncluded: number;
  overagePerUnit: number | null;
  monthlyCredits: number;
  features: string[];
  isDefault: boolean;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
};

export type PlanInput = Partial<Omit<Plan, 'id'>> &
  Pick<Plan, 'key' | 'name' | 'monthlyPrice' | 'unitsIncluded'>;

export type PaidService = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  creditCost: number;
  isActive: boolean;
  sortOrder: number;
};

export type PlanUsage = {
  units: number;
  unitsIncluded: number;
  extraUnits: number;
  overageMonthly: number;
  users: number;
  usersIncluded: number;
};

/** The signed-in account's plan, what it uses against it, and its credits (GET /subscriptions/me). */
export type Subscription = {
  userId: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
  /** A paid plan whose period ended: the account is back on the default plan. */
  lapsed: boolean;
  plan: Plan;
  usage: PlanUsage;
  credits: { balance: number };
  limitsEnforced: boolean;
  subscriptionsEnabled: boolean;
  canChangePlan: boolean;
  company: { isPartner: boolean } | null;
};

export type CheckoutSubscriptionInput = {
  planKey: string;
  billingCycle?: 'monthly' | 'yearly';
  confirmDowngrade?: boolean;
};

export type CreditEntry = {
  id: string;
  delta: number;
  reason: 'MONTHLY_ALLOWANCE' | 'ADMIN_GRANT' | 'PURCHASE' | 'SPEND' | 'REFUND';
  serviceKey: string | null;
  note: string | null;
  createdAt: string;
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
  rentId?: string | null;
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

export type RentSignature = {
  id: string;
  rentId: string;
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
  rents: { active: number; upcomingRenewalCount: number };
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
    rentId: string | null;
    tenant: string | null;
    property: string | null;
  }[];
  recentCompletedMaintenance: {
    id: string;
    completedAt: string | null;
    finalCost: number | null;
    unit: { property: { name: string } } | null;
  }[];
  recentRents: {
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
  rents: {
    active: number;
    terminated: number;
    paid: number;
    due: number;
    overdue: number;
    rentStatusByRent: Record<string, 'due' | 'overdue'>;
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
  payment?: {
    id: string;
    amount: number;
    paidAt: string;
    transactionRef: string | null;
    receiptNumber: string;
  } | null;
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

/** A person in a company (GET /team). */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  status: string;
  isPartner: boolean;
  /** Properties they are the manager of. */
  properties: number;
};

export type TeamOverview = {
  organisation: { id: string; name: string } | null;
  isPartner: boolean;
  members: TeamMember[];
  seats: { used: number; included: number };
  limitsEnforced: boolean;
};

/** What a spreadsheet of properties, units and tenants would do (POST /properties/import?preview=true). */
export type PortfolioSummary = {
  properties: number;
  newProperties: number;
  existingProperties: number;
  units: number;
  tenancies: number;
  activeTenancies: number;
  newTenantAccounts: number;
  linkedTenantAccounts: number;
};

export type PortfolioPreview = {
  summary: PortfolioSummary;
  properties: {
    name: string;
    address: string;
    city: string;
    /** The property already exists, so the file adds units to it. */
    existing: boolean;
    units: {
      row: number;
      unitNumber: string;
      rentAmount: number;
      paymentFrequency: string;
      tenant: {
        name: string;
        email: string;
        account: 'NEW' | 'EXISTING';
        status: 'ACTIVE' | 'PENDING';
      } | null;
    }[];
  }[];
  issues: { row: number; error: string }[];
  /** What the plan's unit limit says about adding all these units; null when it has no objection. */
  capacity: {
    blocking: boolean;
    code: string;
    message: string;
    details: Record<string, unknown>;
  } | null;
  invitations: { toSend: number; dailyLimit: number; remainingToday: number | null };
  canImport: boolean;
};

export type PortfolioImportResult = {
  summary: PortfolioSummary;
};

export type InvitationBatchResult = {
  sent: number;
  stillWaiting: number;
  notAllowed: number;
  limitReached: boolean;
  dailyLimit: number;
};

// ── Rent agreement rules and templates ──────────────────────────────────────────────────────────

export type RuleMode = 'OFF' | 'WARN' | 'BLOCK';

export type Jurisdiction = {
  id: string;
  key: string;
  name: string;
  states: string[];
  isDefault: boolean;
  isActive: boolean;
  advanceRentMaxMonths: number | null;
  advanceRentMode: RuleMode;
  /** Days of notice to quit by payment frequency. */
  noticeDays: Partial<Record<'MONTHLY' | 'QUARTERLY' | 'BI_ANNUAL' | 'ANNUAL', number>>;
  excludedAreas: string[];
  excludedAreasMode: RuleMode;
  registrationThresholdYears: number | null;
  stampDutyNote: string | null;
  sourceNote: string | null;
  rulesCheckedAt: string | null;
  lawyerReviewed: boolean;
  sortOrder: number;
};

export type JurisdictionInput = Partial<Omit<Jurisdiction, 'id' | 'rulesCheckedAt'>> & {
  rulesCheckedAt?: string | null;
};

export type TemplateClauseData = {
  id: string;
  title: string;
  body: string;
  mode: 'LOCKED' | 'EDITABLE' | 'OPTIONAL';
  defaultOn?: boolean;
};

export type AgreementTemplate = {
  id: string;
  key: string;
  name: string;
  version: number;
  jurisdictionId: string;
  jurisdiction?: { id: string; name: string };
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  clauses: TemplateClauseData[];
  witnessRequired: boolean;
  notes: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type AgreementTemplateInput = {
  key?: string;
  name?: string;
  jurisdictionId?: string;
  clauses?: TemplateClauseData[];
  witnessRequired?: boolean;
  notes?: string | null;
};
