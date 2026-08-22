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
    security: Record<string, unknown> | null;
    electricity: Record<string, unknown> | null;
    water: Record<string, unknown> | null;
    roadNetwork: Record<string, unknown> | null;
    flooding: Record<string, unknown> | null;
    amenities: Record<string, unknown> | null;
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

export type Lease = { id: string; unitId: string; tenantId: string; status: string; tenantInvited?: boolean };

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

export type Invoice = { id: string; invoiceNumber: string; amount: number; status: string };

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
