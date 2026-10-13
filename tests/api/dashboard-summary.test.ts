import { beforeAll, describe, expect, it } from 'vitest';
import { InvoiceStatus, LeaseStatus, Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createInvoice,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

// ISS-049: the dashboards used to total only the first page (20) of invoices.
// These numbers are computed in the database, so they must stay right with far
// more rows than a page.
describe('GET /dashboard/summary (owner totals, past one page)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('totals 30 invoices correctly, scoped to the caller, with occupancy and pending', async () => {
    const manager = await createUser(Role.MANAGER);
    const other = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT, { name: 'Ada Tenant' });
    const property = await createProperty({ managerId: manager.id, name: 'Sunrise Court' });
    const occupied = await createUnit(property.id, { rentAmount: 1_000_000 });
    await createUnit(property.id, { rentAmount: 500_000 });
    await testPrisma.unit.update({ where: { id: occupied.id }, data: { status: 'OCCUPIED' } });
    const lease = await createLease(occupied.id, tenant.id, { status: LeaseStatus.ACTIVE });

    // 30 paid invoices of 100k each (30 payments), 1 half-paid, 1 unpaid.
    for (let i = 0; i < 30; i++) {
      const inv = await createInvoice({ leaseId: lease.id, amount: 100_000, status: 'PAID' });
      await testPrisma.payment.create({ data: { invoiceId: inv.id, amount: 100_000 } });
    }
    const half = await createInvoice({ leaseId: lease.id, amount: 200_000 });
    await testPrisma.payment.create({ data: { invoiceId: half.id, amount: 50_000 } });
    await createInvoice({ leaseId: lease.id, amount: 70_000 });
    await createInvoice({
      leaseId: lease.id,
      amount: 999_999,
      status: InvoiceStatus.CANCELLED,
    });

    // Another manager's data must not leak in.
    const otherProp = await createProperty({ managerId: other.id });
    const otherLease = await createLease(
      (await createUnit(otherProp.id)).id,
      (await createUser(Role.TENANT)).id,
    );
    const otherInv = await createInvoice({ leaseId: otherLease.id, amount: 123_456 });
    await testPrisma.payment.create({ data: { invoiceId: otherInv.id, amount: 123_456 } });

    const res = await apiFetch('/api/v1/dashboard/summary', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(200);
    const s = res.body.data;

    expect(s.money.collected).toBe(3_050_000); // 30 x 100k + 50k
    expect(s.money.pending).toBe(150_000 + 70_000); // 200k-50k + 70k, cancelled ignored
    expect(s.money.collectedThisMonth).toBe(3_050_000); // all paid just now
    expect(s.units).toMatchObject({ total: 2, occupied: 1, occupancyRate: 50 });
    expect(s.units.totalListedRent).toBe(1_500_000);
    expect(s.leases.active).toBe(1);
    expect(s.properties.count).toBe(1);
    expect(s.recentPayments).toHaveLength(5);
    expect(s.properties.rows[0]).toMatchObject({
      name: 'Sunrise Court',
      units: 2,
      occupied: 1,
      occupancy: 50,
      collected: 3_050_000,
      pending: 220_000,
    });
  });

  it('is available to landlords, and refused for tenants and vendors', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const ok = await apiFetch('/api/v1/dashboard/summary', {
      cookie: await authCookie(landlord.id, landlord.role),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.properties.count).toBe(0);
    expect(ok.body.data.money.pending).toBe(0);

    for (const role of [Role.TENANT, Role.VENDOR]) {
      const u = await createUser(role);
      const res = await apiFetch('/api/v1/dashboard/summary', {
        cookie: await authCookie(u.id, u.role),
      });
      expect(res.status).toBe(403);
    }
  });
});

describe('GET /admin/summary (platform totals)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('counts every user and payment, not just the first page', async () => {
    const admin = await createUser(Role.ADMIN);
    for (let i = 0; i < 25; i++) await createUser(Role.TENANT);
    await createUser(Role.VENDOR);
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ landlordId: landlord.id });
    await testPrisma.property.update({
      where: { id: property.id },
      data: { moderationStatus: 'PENDING_REVIEW' },
    });
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease((await createUnit(property.id)).id, tenant.id);
    for (let i = 0; i < 22; i++) {
      const inv = await createInvoice({ leaseId: lease.id, amount: 10_000, status: 'PAID' });
      await testPrisma.payment.create({ data: { invoiceId: inv.id, amount: 10_000 } });
    }

    const res = await apiFetch('/api/v1/admin/summary', {
      cookie: await authCookie(admin.id, admin.role),
    });
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.users.total).toBe(1 + 25 + 1 + 1 + 1);
    expect(s.users.byRole.TENANT).toBe(26);
    expect(s.users.byRole.VENDOR).toBe(1);
    expect(s.users.newThisWeek).toBe(s.users.total);
    expect(s.money.collected).toBe(220_000);
    expect(s.properties.total).toBe(1);
    expect(
      s.attentionItems.some((a: { title: string }) => a.title.startsWith('Property awaiting')),
    ).toBe(true);
  });

  it('is admin-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const res = await apiFetch('/api/v1/admin/summary', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /admin/reports (period charts, past one page)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const thisMonth = new Date().toISOString().slice(0, 7);

  it('totals more than a page of payments, users and requests, bucketed by month', async () => {
    const admin = await createUser(Role.ADMIN);
    for (let i = 0; i < 25; i++) await createUser(Role.TENANT);
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ landlordId: landlord.id });
    const unit = await createUnit(property.id, { rentAmount: 400_000 });
    await testPrisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } });
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    for (let i = 0; i < 55; i++) {
      const inv = await createInvoice({ leaseId: lease.id, amount: 10_000, status: 'PAID' });
      await testPrisma.payment.create({ data: { invoiceId: inv.id, amount: 10_000 } });
    }
    await createInvoice({ leaseId: lease.id, amount: 30_000 });

    const res = await apiFetch(`/api/v1/admin/reports?from=${thisMonth}&to=${thisMonth}`, {
      cookie: await authCookie(admin.id, admin.role),
    });
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.totals.collected).toBe(550_000);
    expect(r.totals.paymentCount).toBe(55);
    expect(r.totals.avgTransactionValue).toBe(10_000);
    expect(r.totals.pending).toBe(30_000);
    expect(r.totals.invoiceCount).toBe(56);
    expect(r.series.collected[thisMonth]).toBe(550_000);
    expect(r.series.newUsers[thisMonth].TENANT).toBe(26);
    expect(r.users.total).toBe(1 + 25 + 1 + 1);
    expect(r.users.byRole.TENANT).toBe(26);
    expect(r.recentPayments).toHaveLength(50);
    expect(r.revenueByType.reduce((s: number, t: { amount: number }) => s + t.amount, 0)).toBe(
      550_000,
    );
    expect(r.properties.total).toBe(1);
    expect(r.units.avgOccupancy).toBe(100);
    expect(r.units.avgRent).toBe(400_000);
  });

  it('rejects a missing, malformed or oversized range', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    for (const q of [
      '',
      '?from=2026-01',
      '?from=2026-13&to=2026-14',
      '?from=2026-05&to=2026-01',
      '?from=2020-01&to=2026-01',
    ]) {
      const res = await apiFetch(`/api/v1/admin/reports${q}`, { cookie });
      expect(res.status).toBe(400);
    }
  });

  it('is admin-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const res = await apiFetch(`/api/v1/admin/reports?from=${thisMonth}&to=${thisMonth}`, {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /dashboard/breakdown and /admin/breakdown (card pages, past one page)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('buckets owner leases, properties, payments and maintenance beyond 20 rows', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, name: 'Palm Court' });
    const empty = await createProperty({ managerId: manager.id, name: 'Empty Court' });
    expect(empty.id).toBeTruthy();
    const unit = await createUnit(property.id, { rentAmount: 100_000 });
    await testPrisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } });
    // 25 active leases: first has an overdue invoice, second a future-due one, rest are paid up.
    let first: { id: string } | null = null;
    let second: { id: string } | null = null;
    for (let i = 0; i < 25; i++) {
      const u = i === 0 ? unit : await createUnit(property.id);
      const lease = await createLease(u.id, (await createUser(Role.TENANT)).id, {
        status: LeaseStatus.ACTIVE,
      });
      if (i === 0) first = lease;
      if (i === 1) second = lease;
    }
    await createInvoice({
      leaseId: first!.id,
      amount: 50_000,
      dueDate: new Date(Date.now() - 3 * 86_400_000),
    });
    await createInvoice({
      leaseId: second!.id,
      amount: 60_000,
      dueDate: new Date(Date.now() + 5 * 86_400_000),
    });
    const paid = await createInvoice({ leaseId: first!.id, amount: 20_000, status: 'PAID' });
    for (let i = 0; i < 22; i++) {
      await testPrisma.payment.create({ data: { invoiceId: paid.id, amount: 1_000 } });
    }

    const res = await apiFetch('/api/v1/dashboard/breakdown', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(200);
    const b = res.body.data;
    expect(b.properties.count).toBe(2);
    expect(b.properties.vacant).toBe(1);
    expect(b.leases.active).toBe(25);
    expect(b.leases.overdue).toBe(1);
    expect(b.leases.due).toBe(1);
    expect(b.leases.paid).toBe(23);
    expect(b.leases.rentStatusByLease[first!.id]).toBe('overdue');
    expect(b.money.collected).toBe(22_000);
    expect(b.money.paymentCount).toBe(22);
    expect(b.money.pending).toBe(110_000);
    expect(b.money.trend).toHaveLength(6);
    expect(b.payments).toHaveLength(22);
    expect(b.money.byProperty[0].name).toBe('Palm Court');
  });

  it('is limited to managers and landlords; admin counts everything', async () => {
    const tenant = await createUser(Role.TENANT);
    const denied = await apiFetch('/api/v1/dashboard/breakdown', {
      cookie: await authCookie(tenant.id, tenant.role),
    });
    expect(denied.status).toBe(403);

    const admin = await createUser(Role.ADMIN);
    const res = await apiFetch('/api/v1/admin/breakdown', {
      cookie: await authCookie(admin.id, admin.role),
    });
    expect(res.status).toBe(200);
    const b = res.body.data;
    expect(b.users.tenant).toBe(26);
    expect(b.properties.total).toBe(2);
    expect(b.money.collected).toBe(22_000);
    expect(b.money.pending).toBe(110_000);

    const notAdmin = await apiFetch('/api/v1/admin/breakdown', {
      cookie: await authCookie(tenant.id, tenant.role),
    });
    expect(notAdmin.status).toBe(403);
  });
});
