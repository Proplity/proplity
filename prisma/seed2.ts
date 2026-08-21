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
  ViewingStatus,
  AccessCodeStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/proplity_db?schema=public';

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
  const categoriesMap: Record<string, string> = {};
  for (const name of DEFAULT_MAINTENANCE_CATEGORIES) {
    const category = await prisma.maintenanceCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoriesMap[name] = category.id;
  }
  return categoriesMap;
}

async function main() {
  console.log('🌱 Starting enriched Proplity seed2...');

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

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Seed Maintenance Categories
  const categories = await seedMaintenanceCategories();

  // 2. Create Users (Admin, Manager, Landlord, Tenants, Vendors)
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

  const tenantJordan = await prisma.user.upsert({
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
      emergencyContactName: 'Brenda Hayes',
      emergencyContactRelationship: 'Sister',
      emergencyContactPhone: '+2348044445556',
    },
  });

  const tenantAdewale = await prisma.user.upsert({
    where: { email: 'adewale.j@email.com' },
    update: {},
    create: {
      email: 'adewale.j@email.com',
      name: 'Adewale Johnson',
      passwordHash,
      role: Role.TENANT,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348034567890',
      kycStatus: KycStatus.VERIFIED,
      moveReason: 'Relocating for proximity to Lekki corporate zone',
      occupantCount: 1,
      emergencyContactName: 'Funmi Johnson',
      emergencyContactRelationship: 'Spouse',
      emergencyContactPhone: '+2348034567891',
    },
  });

  const tenantTunde = await prisma.user.upsert({
    where: { email: 'tunde@email.com' },
    update: {},
    create: {
      email: 'tunde@email.com',
      name: 'Tunde Bakare',
      passwordHash,
      role: Role.TENANT,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348055557777',
      kycStatus: KycStatus.VERIFIED,
      moveReason: 'Yaba tech hub proximity',
      occupantCount: 1,
    },
  });

  const vendorApex = await prisma.user.upsert({
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
      vendorProfile: {
        create: {
          businessName: 'Apex Repairs & Plumbing Ltd',
          licenseNumber: 'LIC-PLUMB-9872',
        },
      },
    },
  });

  const vendorJohn = await prisma.user.upsert({
    where: { email: 'john.electrical@email.com' },
    update: {},
    create: {
      email: 'john.electrical@email.com',
      name: 'John Electricals',
      passwordHash,
      role: Role.VENDOR,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348066667777',
      kycStatus: KycStatus.VERIFIED,
      vendorProfile: {
        create: {
          businessName: 'John Electrical Services',
          licenseNumber: 'LIC-ELEC-4421',
        },
      },
    },
  });

  const vendorAqua = await prisma.user.upsert({
    where: { email: 'aquafix@email.com' },
    update: {},
    create: {
      email: 'aquafix@email.com',
      name: 'AquaFix Plumbers',
      passwordHash,
      role: Role.VENDOR,
      status: UserStatus.ACTIVE,
      phoneNumber: '+2348077778888',
      kycStatus: KycStatus.VERIFIED,
      vendorProfile: {
        create: {
          businessName: 'AquaFix Plumbing & Services',
          licenseNumber: 'LIC-PLUMB-1092',
        },
      },
    },
  });

  // 3. Setup Bank Accounts
  await prisma.bankAccount.upsert({
    where: { id: 'bank-eleanor-default' },
    update: {},
    create: {
      id: 'bank-eleanor-default',
      userId: landlord.id,
      accountNumber: '0123456789',
      bankCode: '058',
      bankName: 'GTBank',
      accountName: 'Eleanor Sterling Properties',
      isDefault: true,
    },
  });

  // 4. Create Properties
  const propHighland = await prisma.property.create({
    data: {
      name: 'Highland Park Residences',
      address: '12 Admiralty Way, Lekki Phase 1',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '105102',
      type: PropertyType.RESIDENTIAL,
      description: 'Luxury modern apartments in Lekki Phase 1 with 24/7 power, security, and rooftop amenities.',
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
            amenities: ['Air Conditioning', '24/7 Power', 'Fitted Kitchen', 'Water Heater', 'Balcony'],
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

  const propHeights = await prisma.property.create({
    data: {
      name: 'Lekki Heights',
      address: 'Block 15, Flat 203, Lekki Phase 1',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '105102',
      type: PropertyType.RESIDENTIAL,
      description: 'Beautiful 3-bedroom apartment in the heart of Lekki Phase 1. Features modern finishes, spacious rooms, and excellent security.',
      isPublished: true,
      trustScore: 95.0,
      powerReliabilityScore: 88.0,
      floodRiskScore: 10.0,
      securityRating: 90.0,
      roadConditionScore: 85.0,
      waterSupplyType: WaterSupplyType.BOREHOLE,
      electricalSetup: ElectricalSetup.GENERATOR,
      managerId: manager.id,
      landlordId: landlord.id,
      units: {
        create: [
          {
            unitNumber: '203',
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1200,
            rentAmount: 850000.0,
            listedPaymentFrequency: PaymentFrequency.ANNUAL,
            depositAmount: 85000.0,
            status: UnitStatus.OCCUPIED,
            amenities: ['24/7 Power Supply', 'Borehole', 'Security/CCTV', 'Parking Space', 'Generator'],
          },
        ],
      },
    },
    include: { units: true },
  });

  const propPenthouse = await prisma.property.create({
    data: {
      name: 'Eko Atlantic Penthouse',
      address: 'Plot 4, Marina District, Eko Atlantic',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '101241',
      type: PropertyType.RESIDENTIAL,
      description: 'Ultra-exclusive luxury penthouse suite offering panoramic views of the ocean, custom marble finishes, and private pool.',
      isPublished: true,
      trustScore: 99.0,
      powerReliabilityScore: 99.0,
      floodRiskScore: 5.0,
      securityRating: 98.0,
      roadConditionScore: 95.0,
      waterSupplyType: WaterSupplyType.PUBLIC_GRID,
      electricalSetup: ElectricalSetup.PUBLIC_GRID,
      managerId: manager.id,
      landlordId: landlord.id,
      units: {
        create: [
          {
            unitNumber: 'PH1',
            bedrooms: 4,
            bathrooms: 4,
            squareFeet: 2800,
            rentAmount: 6000000.0,
            depositAmount: 600000.0,
            status: UnitStatus.VACANT,
            amenities: ['Swimming Pool', 'Private Elevator', 'Smart Automation', 'Gym', 'Sea View'],
          },
        ],
      },
    },
    include: { units: true },
  });

  const propYaba = await prisma.property.create({
    data: {
      name: 'Yaba Self-Contain Apartments',
      address: '22 Herbert Macaulay Way, Yaba',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '100252',
      type: PropertyType.RESIDENTIAL,
      description: 'Comfortable student and young professional self-contain units in the heart of Yaba tech corridor.',
      isPublished: true,
      trustScore: 84.0,
      powerReliabilityScore: 60.0,
      floodRiskScore: 25.0,
      securityRating: 75.0,
      roadConditionScore: 80.0,
      waterSupplyType: WaterSupplyType.BOREHOLE,
      electricalSetup: ElectricalSetup.COMBINED,
      managerId: manager.id,
      landlordId: landlord.id,
      units: {
        create: [
          {
            unitNumber: '1A',
            bedrooms: 1,
            bathrooms: 1,
            squareFeet: 450,
            rentAmount: 400000.0,
            depositAmount: 40000.0,
            status: UnitStatus.OCCUPIED,
            amenities: ['Security Gate', 'Parking', 'Borehole Water'],
          },
        ],
      },
    },
    include: { units: true },
  });

  const unitHighland4B = propHighland.units.find((u) => u.unitNumber === '4B')!;
  const unitHeights203 = propHeights.units.find((u) => u.unitNumber === '203')!;
  const unitYaba1A = propYaba.units.find((u) => u.unitNumber === '1A')!;

  // 5. Create Leases
  const leaseJordan = await prisma.lease.create({
    data: {
      unitId: unitHighland4B.id,
      tenantId: tenantJordan.id,
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

  const leaseAdewale = await prisma.lease.create({
    data: {
      unitId: unitHeights203.id,
      tenantId: tenantAdewale.id,
      startDate: new Date('2026-04-15'),
      endDate: new Date('2027-04-14'),
      rentAmount: 850000.0,
      paymentFrequency: PaymentFrequency.ANNUAL,
      deposit: 85000.0,
      gracePeriodDays: 5,
      status: LeaseStatus.ACTIVE,
    },
  });

  const leaseTunde = await prisma.lease.create({
    data: {
      unitId: unitYaba1A.id,
      tenantId: tenantTunde.id,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-09-30'),
      rentAmount: 400000.0,
      paymentFrequency: PaymentFrequency.ANNUAL,
      deposit: 40000.0,
      gracePeriodDays: 7,
      status: LeaseStatus.ACTIVE,
    },
  });

  // 6. Create Access Codes & Gate Logs
  const gateCodeJordan = await prisma.accessCode.create({
    data: {
      unitId: unitHighland4B.id,
      createdById: tenantJordan.id,
      code: '849201',
      guestName: 'Samuel Okoro',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: AccessCodeStatus.ACTIVE,
    },
  });

  const gateCodePermanent = await prisma.accessCode.create({
    data: {
      unitId: unitHighland4B.id,
      createdById: tenantJordan.id,
      code: '110992',
      guestName: 'Jordan Hayes (Permanent)',
      validFrom: new Date(),
      validUntil: null, // Permanent gate access
      status: AccessCodeStatus.ACTIVE,
    },
  });

  await prisma.accessLog.createMany({
    data: [
      {
        accessCodeId: gateCodeJordan.id,
        occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        action: 'GRANTED',
        deviceInfo: 'Verified visitor gate scan.',
      },
      {
        accessCodeId: gateCodeJordan.id,
        occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        action: 'DENIED',
        deviceInfo: 'Attempted scan outside authorized window.',
      },
    ],
  });

  // 7. Neighborhood Reports
  await prisma.neighbourhoodReport.createMany({
    data: [
      {
        propertyId: propHighland.id,
        security: {
          rating: 9.5,
          status: 'excellent',
          features: ['CCTV Surveillance', 'Armed Patrols', 'Gated Estate Entry'],
          crimeRate: '0.01%',
          notes: 'Secure residential community inside Admiralty enclave.',
        },
        electricity: {
          rating: 9.2,
          status: 'stable',
          powerAvailabilityHours: 23.5,
          gridType: 'EKEDC + Rooftop Generator Backup',
        },
        water: {
          rating: 9.0,
          status: 'good',
          source: 'Combined Estate Treatment Plant + Private Borehole',
        },
        roadNetwork: {
          rating: 9.0,
          status: 'fully paved',
          notes: 'Excellent street layout with standard side drainage.',
        },
        flooding: {
          rating: 8.5,
          status: 'low risk',
          drainageEfficiency: 'Excellent',
        },
      },
      {
        propertyId: propHeights.id,
        security: {
          rating: 9.0,
          status: 'good',
          features: ['CCTV Security', 'Manned Gatehouse'],
          notes: 'Standard secure apartment block inside Lekki Phase 1.',
        },
      },
    ],
  });

  // 8. Maintenance Request Board (Active, Completed, Rated)
  const reqSink = await prisma.maintenanceRequest.create({
    data: {
      unitId: unitHighland4B.id,
      tenantId: tenantJordan.id,
      vendorId: vendorApex.id,
      title: 'Kitchen Sink Leaking',
      description: 'Water leaking underneath the kitchen sink pipe junction.',
      categoryId: categories['Plumbing'],
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      costEstimate: 25000.0,
    },
  });

  const reqLights = await prisma.maintenanceRequest.create({
    data: {
      unitId: unitHeights203.id,
      tenantId: tenantAdewale.id,
      vendorId: vendorJohn.id,
      title: 'Flickering Lights in Living Room',
      description: 'Three LED spotlights are flickering continuously when switched on.',
      categoryId: categories['Electrical'],
      priority: MaintenancePriority.LOW,
      status: MaintenanceStatus.COMPLETED,
      costEstimate: 15000.0,
      finalCost: 15000.0,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      vendorNotes: 'Replaced faulty transformer/ballast module inside the false ceiling.',
    },
  });

  const reqAc = await prisma.maintenanceRequest.create({
    data: {
      unitId: unitYaba1A.id,
      tenantId: tenantTunde.id,
      vendorId: vendorAqua.id,
      title: 'AC not cooling',
      description: 'The split AC unit in the bedroom blows air but does not cool.',
      categoryId: categories['HVAC'],
      priority: MaintenancePriority.MEDIUM,
      status: MaintenanceStatus.COMPLETED,
      costEstimate: 20000.0,
      finalCost: 20000.0,
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      vendorNotes: 'Cleaned filters and recharged refrigerant gas.',
    },
  });

  // 9. Vendor Ratings
  await prisma.vendorRating.create({
    data: {
      maintenanceRequestId: reqLights.id,
      vendorId: vendorJohn.id,
      ratedById: tenantAdewale.id,
      rating: 5,
      comment: 'Excellent, fast repair. No issues since.',
    },
  });

  await prisma.vendorRating.create({
    data: {
      maintenanceRequestId: reqAc.id,
      vendorId: vendorAqua.id,
      ratedById: tenantTunde.id,
      rating: 4,
      comment: 'Good response, resolved the issue quickly.',
    },
  });

  // 10. Property Reviews (Verified Reviews)
  await prisma.propertyReview.create({
    data: {
      propertyId: propHeights.id,
      reviewerId: tenantAdewale.id,
      leaseId: leaseAdewale.id, // Verified lease
      rating: 5,
      comment: 'Lekki Heights is an excellent residence. Power is very stable and maintenance responses are immediate.',
    },
  });

  await prisma.propertyReview.create({
    data: {
      propertyId: propHighland.id,
      reviewerId: tenantJordan.id,
      leaseId: leaseJordan.id, // Verified lease
      rating: 4,
      comment: 'Great layout and high quality structure. Traffic gets a bit busy around Admiralty Way during rush hours.',
    },
  });

  // 11. Invoices & Payments (Rent, Utility, Service Charge)
  const invRentJordan = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-1001',
      leaseId: leaseJordan.id,
      type: InvoiceType.RENT,
      amount: 3500000.0,
      dueDate: new Date('2026-01-01'),
      status: InvoiceStatus.PAID,
      description: 'Annual Rent 2026 Invoice',
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invRentJordan.id,
      amount: 3500000.0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      provider: PaymentProvider.PAYSTACK,
      transactionRef: 'PSK_REF_202601019842',
      paidAt: new Date('2026-01-01'),
    },
  });

  const invUtilityAdewale = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-1002',
      leaseId: leaseAdewale.id,
      type: InvoiceType.UTILITY,
      amount: 45000.0,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
      status: InvoiceStatus.UNPAID,
      description: 'Water and electricity usage bill for June 2026',
    },
  });

  const invServiceTunde = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-1003',
      leaseId: leaseTunde.id,
      type: InvoiceType.ASSOCIATION_FEE,
      amount: 25000.0,
      dueDate: new Date('2026-02-15'),
      status: InvoiceStatus.PAID,
      description: 'Estate security and waste management association fee levy',
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invServiceTunde.id,
      amount: 25000.0,
      paymentMethod: PaymentMethod.DEBIT_CARD,
      provider: PaymentProvider.PAYSTACK,
      transactionRef: 'PSK_REF_SERVICE_TUNDE_22',
      paidAt: new Date('2026-02-14'),
    },
  });

  // 12. Notes & Timeline History
  await prisma.note.create({
    data: {
      authorId: manager.id,
      aboutUserId: tenantTunde.id,
      leaseId: leaseTunde.id,
      body: 'Tenant paid service charge early. Good compliance record.',
      createdAt: new Date(),
    },
  });

  console.log('🌱 Rich Proplity seed2 completed successfully!');
  console.log({
    admin: admin.email,
    manager: manager.email,
    landlord: landlord.email,
    tenants: [tenantJordan.email, tenantAdewale.email, tenantTunde.email],
    vendors: [vendorApex.email, vendorJohn.email, vendorAqua.email],
    properties: [propHighland.name, propHeights.name, propPenthouse.name, propYaba.name],
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed2 error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
