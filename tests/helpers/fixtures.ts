import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Role,
  UserStatus,
  PaymentFrequency,
  LeaseStatus,
  MaintenancePriority,
  MaintenanceStatus,
  ScheduleFrequency,
} from '@prisma/client';
import { testPrisma } from './db';

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** Default password for every fixture user, matching the seeded dev accounts. */
export const FIXTURE_PASSWORD = 'Password123!';
let cachedPasswordHash: string | null = null;
async function passwordHash() {
  if (!cachedPasswordHash) cachedPasswordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  return cachedPasswordHash;
}

export async function createUser(
  role: Role = Role.TENANT,
  overrides: Partial<{
    email: string;
    name: string;
    status: UserStatus;
    phoneNumber: string | null;
  }> = {},
) {
  return testPrisma.user.create({
    data: {
      email: overrides.email ?? `${unique(role.toLowerCase())}@test.local`,
      name: overrides.name ?? `Test ${role}`,
      passwordHash: await passwordHash(),
      role,
      status: overrides.status ?? UserStatus.ACTIVE,
      phoneNumber: overrides.phoneNumber ?? null,
    },
  });
}

/** Mirrors verify-email's own token hashing so the route can find what we create here. */
export async function createVerificationToken(
  userId: string,
  overrides: Partial<{ expiresAt: Date }> = {},
) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await testPrisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { rawToken, record };
}

/** Seeds LoginAttempt rows directly to simulate an identifier whose rate limit is already exhausted. */
export async function fillRateLimit(identifier: string, count = 5) {
  await testPrisma.loginAttempt.createMany({
    data: Array.from({ length: count }, () => ({ identifier })),
  });
}

export async function createProperty(
  overrides: Partial<{
    name: string;
    city: string;
    state: string;
    managerId: string | null;
    landlordId: string | null;
    isPublished: boolean;
  }> = {},
) {
  return testPrisma.property.create({
    data: {
      name: overrides.name ?? unique('Property'),
      address: '1 Test Street',
      city: overrides.city ?? 'Lagos',
      state: overrides.state ?? 'Lagos',
      managerId: overrides.managerId ?? null,
      landlordId: overrides.landlordId ?? null,
      isPublished: overrides.isPublished ?? false,
    },
  });
}

export async function createUnit(
  propertyId: string,
  overrides: Partial<{
    unitNumber: string;
    bedrooms: number;
    rentAmount: number;
    squareFeet: number | null;
  }> = {},
) {
  return testPrisma.unit.create({
    data: {
      propertyId,
      unitNumber: overrides.unitNumber ?? unique('Unit'),
      bedrooms: overrides.bedrooms ?? 2,
      rentAmount: overrides.rentAmount ?? 1_000_000,
      squareFeet: overrides.squareFeet ?? null,
    },
  });
}

export async function createLease(
  unitId: string,
  tenantId: string,
  overrides: Partial<{
    startDate: Date;
    endDate: Date;
    rentAmount: number;
    paymentFrequency: PaymentFrequency;
    deposit: number;
    status: LeaseStatus;
  }> = {},
) {
  return testPrisma.lease.create({
    data: {
      unitId,
      tenantId,
      startDate: overrides.startDate ?? new Date(),
      endDate: overrides.endDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      rentAmount: overrides.rentAmount ?? 1_000_000,
      paymentFrequency: overrides.paymentFrequency ?? PaymentFrequency.ANNUAL,
      deposit: overrides.deposit ?? 200_000,
      status: overrides.status ?? LeaseStatus.ACTIVE,
    },
  });
}

export async function createMaintenanceCategory(
  overrides: Partial<{ name: string; isActive: boolean }> = {},
) {
  return testPrisma.maintenanceCategory.create({
    data: {
      name: overrides.name ?? unique('Category'),
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createMaintenanceRequest(
  unitId: string,
  tenantId: string,
  overrides: Partial<{
    title: string;
    description: string;
    categoryId: string | null;
    vendorId: string | null;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
  }> = {},
) {
  return testPrisma.maintenanceRequest.create({
    data: {
      unitId,
      tenantId,
      title: overrides.title ?? 'Leaky faucet',
      description: overrides.description ?? 'The kitchen faucet is leaking.',
      categoryId: overrides.categoryId ?? null,
      vendorId: overrides.vendorId ?? null,
      priority: overrides.priority ?? MaintenancePriority.MEDIUM,
      status: overrides.status ?? MaintenanceStatus.SUBMITTED,
    },
  });
}

export async function createMaintenanceSchedule(
  unitId: string,
  categoryId: string,
  overrides: Partial<{ frequency: ScheduleFrequency; nextDueDate: Date }> = {},
) {
  return testPrisma.maintenanceSchedule.create({
    data: {
      unitId,
      categoryId,
      frequency: overrides.frequency ?? ScheduleFrequency.MONTHLY,
      nextDueDate: overrides.nextDueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}
