import 'dotenv/config';
import {
  PrismaClient,
  Role,
  UserStatus,
  KycStatus,
  PropertyType,
  UnitStatus,
  LeaseStatus,
  PaymentFrequency,
  WaterSupplyType,
  ElectricalSetup,
  MaintenancePriority,
  MaintenanceStatus,
  InvoiceType,
  InvoiceStatus,
  PaymentMethod,
  PaymentProvider,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/proplity?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_MAINTENANCE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Structural',
  'Appliance',
  'Cleaning',
  'Other',
];

async function seedMaintenanceCategories() {
  for (const name of DEFAULT_MAINTENANCE_CATEGORIES) {
    await prisma.maintenanceCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function main() {
  console.log('🌱 Starting Proplity seed...');

  // 0. Clear existing data to allow safe, repeatable re-runs
  console.log('🧹 Cleaning old table data...');
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.vendorRating.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.propertyReview.deleteMany();
  await prisma.neighbourhoodReport.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.accessCode.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.vendorProfile.deleteMany();
  await prisma.user.deleteMany();

  // 0. Seed Maintenance Categories lookup table
  await seedMaintenanceCategories();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Create Demo Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@proplity.com' },
    update: {},
    create: {
      email: 'admin@proplity.com',
      name: 'System Admin',
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348011112222',
      kycStatus: KycStatus.VERIFIED,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@proplity.com' },
    update: {},
    create: {
      email: 'manager@proplity.com',
      name: 'Alex Vance (Manager)',
      passwordHash,
      role: Role.MANAGER,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348022223333',
      kycStatus: KycStatus.VERIFIED,
    },
  });

  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@proplity.com' },
    update: {},
    create: {
      email: 'landlord@proplity.com',
      name: 'Eleanor Sterling (Landlord)',
      passwordHash,
      role: Role.LANDLORD,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348033334444',
      kycStatus: KycStatus.VERIFIED,
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@proplity.com' },
    update: {},
    create: {
      email: 'tenant@proplity.com',
      name: 'Jordan Hayes (Tenant)',
      passwordHash,
      role: Role.TENANT,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348044445555',
      kycStatus: KycStatus.VERIFIED,
      moveReason: 'Relocating closer to workplace in Victoria Island',
      occupantCount: 2,
    },
  });

  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@proplity.com' },
    update: {},
    create: {
      email: 'vendor@proplity.com',
      name: 'Apex Repairs & Plumbing',
      passwordHash,
      role: Role.VENDOR,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348055556666',
      kycStatus: KycStatus.VERIFIED,
    },
  });

  // 2. Create Bank Account for Landlord
  await prisma.bankAccount.create({
    data: {
      userId: landlord.id,
      accountNumber: '0123456789',
      bankCode: '058',
      bankName: 'GTBank',
      accountName: 'Eleanor Sterling Properties',
      isDefault: true,
    },
  });

  // 3. Create Demo Property & Units with PRD Discovery Attributes
  const property = await prisma.property.create({
    data: {
      name: 'Highland Park Residences',
      address: '12 Admiralty Way, Lekki Phase 1',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '105102',
      type: PropertyType.RESIDENTIAL,
      description:
        'Luxury modern apartments in Lekki Phase 1 with 24/7 power, security, and rooftop amenities.',
      isPublished: true,
      trustScore: 98.5,
      powerReliabilityScore: 92.0,
      floodRiskScore: 15.0,
      securityRating: 95.0,
      roadConditionScore: 90.0,
      waterSupplyType: WaterSupplyType.COMBINED,
      electricalSetup: ElectricalSetup.COMBINED,
      managerId: manager.id,
      landlordId: landlord.id,
      units: {
        create: [
          {
            unitNumber: '4B',
            bedrooms: 2,
            bathrooms: 2,
            squareFeet: 1100,
            rentAmount: 3500000.0,
            depositAmount: 350000.0,
            status: UnitStatus.OCCUPIED,
            amenities: [
              'Air Conditioning',
              '24/7 Power',
              'Fitted Kitchen',
              'Water Heater',
              'Balcony',
            ],
          },
          {
            unitNumber: '2A',
            bedrooms: 1,
            bathrooms: 1,
            squareFeet: 750,
            rentAmount: 2500000.0,
            depositAmount: 250000.0,
            status: UnitStatus.VACANT,
            amenities: ['Air Conditioning', 'Generator Backup', 'Fitted Kitchen', 'Parking'],
          },
        ],
      },
    },
    include: { units: true },
  });

  const occupiedUnit = property.units.find((u) => u.unitNumber === '4B')!;

  // 4. Create Lease (Annual Rent in Nigeria)
  const lease = await prisma.lease.create({
    data: {
      unitId: occupiedUnit.id,
      tenantId: tenant.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rentAmount: 3500000.0,
      paymentFrequency: PaymentFrequency.ANNUAL,
      deposit: 350000.0,
      gracePeriodDays: 7,
      lateFeePercentage: 5.0,
      status: LeaseStatus.ACTIVE,
    },
  });

  // 5. Create Access Code for Visitor
  await prisma.accessCode.create({
    data: {
      unitId: occupiedUnit.id,
      createdById: tenant.id,
      code: '849201',
      guestName: 'Samuel Okoro',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // 6. Create Maintenance Request
  const plumbingCat = await prisma.maintenanceCategory.findUnique({ where: { name: 'Plumbing' } });
  await prisma.maintenanceRequest.create({
    data: {
      unitId: occupiedUnit.id,
      tenantId: tenant.id,
      vendorId: vendor.id,
      title: 'Kitchen Sink Leaking',
      description: 'Water leaking underneath the kitchen sink pipe junction.',
      categoryId: plumbingCat?.id,
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      costEstimate: 25000.0,
    },
  });

  // 7. Create Rent Invoice & Payment
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-0001',
      leaseId: lease.id,
      type: InvoiceType.RENT,
      amount: 3500000.0,
      dueDate: new Date('2026-01-01'),
      status: InvoiceStatus.PAID,
      description: 'Annual Rent 2026 Invoice',
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 3500000.0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      provider: PaymentProvider.PAYSTACK,
      transactionRef: 'PSK_REF_202601019842',
      paidAt: new Date('2026-01-01'),
    },
  });

  console.log('🌱 PRD-enhanced Seed completed successfully!');
  console.log({
    admin: admin.email,
    manager: manager.email,
    landlord: landlord.email,
    tenant: tenant.email,
    vendor: vendor.email,
    property: property.name,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
