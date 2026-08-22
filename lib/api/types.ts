// Hand-written types matching each route's actual Zod input/response shape
// (no codegen in this repo). Only the fields Phase 7's forms actually need
// are modeled -- not a full mirror of every Prisma field.

export type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; hasMore: boolean } };

export type Unit = {
  id: string;
  propertyId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  rentAmount: number;
  listedPaymentFrequency: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  amenities: string[];
};

export type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  managerId?: string | null;
  landlordId?: string | null;
  manager?: { id: string; name: string; phoneNumber: string | null; email: string } | null;
  isPublished: boolean;
  trustScore: number | null;
  powerReliabilityScore: number | null;
  floodRiskScore: number | null;
  securityRating: number | null;
  roadConditionScore: number | null;
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  waterSupplyType: 'BOREHOLE' | 'PUBLIC_GRID' | 'WATER_TANKER' | 'COMBINED';
  electricalSetup: 'PUBLIC_GRID' | 'GENERATOR' | 'INVERTER_SOLAR' | 'COMBINED';
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
};

export type CreateUnitInput = {
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
  listedPaymentFrequency?: string;
  depositAmount?: number;
  sqft?: number;
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
  type: 'RENEWAL_OFFER' | 'RENT_INCREASE' | 'DEFAULT_NOTICE' | 'EXPIRATION_ALERT' | 'PAYMENT_REMINDER' | 'TERMINATION_NOTICE';
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED';
  content: string | null;
  documentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
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
  paymentFrequency: string;
  deposit: number;
  status: string;
  riskScore?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  paymentReliability?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | null;
  signedAgreementUrl?: string | null;
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
  type: 'RENT' | 'MAINTENANCE' | 'SECURITY_DEPOSIT' | 'UTILITY' | 'LATE_FEE' | 'ASSOCIATION_FEE' | 'SUBSCRIPTION';
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
  type: 'RENT' | 'MAINTENANCE' | 'SECURITY_DEPOSIT' | 'UTILITY' | 'LATE_FEE' | 'ASSOCIATION_FEE' | 'SUBSCRIPTION';
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
};

export type CreateAccessCodeInput = {
  unitId: string;
  code: string;
  guestName?: string;
  validFrom: string;
  validUntil?: string | null;
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
