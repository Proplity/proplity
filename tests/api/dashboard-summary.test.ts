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
