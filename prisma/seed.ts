import {
  PrismaClient,
  Role,
  UserStatus,
  PropertyType,
  UnitStatus,
  LeaseStatus,
  MaintenancePriority,
  MaintenanceStatus,
  InvoiceType,
  InvoiceStatus,
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

async function main() {
  console.log('🌱 Starting Proplity seed...');

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
    },
  });

  // 2. Create Demo Property & Units
  const property = await prisma.property.create({
    data: {
      name: 'Highland Park Residences',
      address: '742 Evergreen Terrace',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      type: PropertyType.RESIDENTIAL,
      description: 'Luxury modern apartments in downtown Austin with rooftop amenities.',
      managerId: manager.id,
      landlordId: landlord.id,
      units: {
        create: [
          {
            unitNumber: '4B',
            bedrooms: 2,
            bathrooms: 2,
            squareFeet: 1100,
            rentAmount: 2400.0,
            depositAmount: 2400.0,
            status: UnitStatus.OCCUPIED,
          },
          {
            unitNumber: '2A',
            bedrooms: 1,
            bathrooms: 1,
            squareFeet: 750,
            rentAmount: 1850.0,
            depositAmount: 1850.0,
            status: UnitStatus.VACANT,
          },
        ],
      },
    },
    include: { units: true },
  });

  const occupiedUnit = property.units.find((u) => u.unitNumber === '4B')!;

  // 3. Create Lease
  const lease = await prisma.lease.create({
    data: {
      unitId: occupiedUnit.id,
      tenantId: tenant.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: 2400.0,
      deposit: 2400.0,
      status: LeaseStatus.ACTIVE,
    },
  });

  // 4. Create Maintenance Request
  await prisma.maintenanceRequest.create({
    data: {
      unitId: occupiedUnit.id,
      tenantId: tenant.id,
      vendorId: vendor.id,
      title: 'Kitchen Sink Leaking',
      description: 'Water leaking underneath the kitchen sink pipe junction.',
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      costEstimate: 180.0,
    },
  });

  // 5. Create Monthly Rent Invoice
  await prisma.invoice.create({
    data: {
      leaseId: lease.id,
      type: InvoiceType.RENT,
      amount: 2400.0,
      dueDate: new Date('2026-09-01'),
      status: InvoiceStatus.UNPAID,
      description: 'September 2026 Monthly Rent Invoice',
    },
  });

  console.log('✅ Seed completed successfully!');
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
