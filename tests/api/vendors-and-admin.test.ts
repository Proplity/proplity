import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createMaintenanceRequest,
  createAccessCode,
  createLease,
  createInvoice,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('vendors: list (reputation computed at query time -- rule 8)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects TENANT/VENDOR callers', async () => {
    const vendor = await createUser(Role.VENDOR);
    const cookie = await authCookie(vendor.id, vendor.role);
    const res = await apiFetch('/api/v1/vendors', { cookie });
    expect(res.status).toBe(403);
  });

  it('only lists ACTIVE vendor users, and computes completionRate/rating from real rows, not a cached column', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);

    const vendor = await createUser(Role.VENDOR, { name: 'Reliable Repairs' });
    const suspendedVendor = await createUser(Role.VENDOR, { status: 'SUSPENDED' });

    // 2 completed jobs out of 3 assigned -> completionRate 67; one rated job.
    const done1 = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'COMPLETED',
    });
    await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'COMPLETED',
    });
    await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'IN_PROGRESS',
    });
    await testPrisma.vendorRating.create({
      data: {
        maintenanceRequestId: done1.id,
        vendorId: vendor.id,
        ratedById: tenant.id,
        rating: 4,
      },
    });

    const noJobsVendor = await createUser(Role.VENDOR, { name: 'Brand New Vendor' });

    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/vendors', { cookie });
    expect(res.status).toBe(200);

    expect(res.body.data.find((v: any) => v.id === suspendedVendor.id)).toBeUndefined();

    const found = res.body.data.find((v: any) => v.id === vendor.id);
    expect(found.businessName).toBe('Reliable Repairs'); // no VendorProfile -> falls back to name
    expect(found.totalJobs).toBe(3);
    expect(found.jobsDone).toBe(2);
    expect(found.completionRate).toBe(67);
    expect(found.rating).toBe(4);

    const freshVendor = res.body.data.find((v: any) => v.id === noJobsVendor.id);
    expect(freshVendor.completionRate).toBeNull();
    expect(freshVendor.rating).toBeNull();
  });
});

describe('admin/users: list (ADMIN only)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a non-admin caller', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/admin/users', { cookie });
    expect(res.status).toBe(403);
  });

  it('lists every user, excludes passwordHash, and computes propertiesCount from managed+owned properties', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    await createProperty({ managerId: manager.id });
    await createProperty({ managerId: manager.id });
    const tenant = await createUser(Role.TENANT);

    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch('/api/v1/admin/users', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data[0].passwordHash).toBeUndefined();

    const managerRow = res.body.data.find((u: any) => u.id === manager.id);
    expect(managerRow.propertiesCount).toBe(2);
    const tenantRow = res.body.data.find((u: any) => u.id === tenant.id);
    expect(tenantRow.propertiesCount).toBe(0);
  });

  it('filters by ?role=', async () => {
    const admin = await createUser(Role.ADMIN);
    await createUser(Role.VENDOR);
    await createUser(Role.TENANT);
    const cookie = await authCookie(admin.id, admin.role);

    const res = await apiFetch('/api/v1/admin/users?role=VENDOR', { cookie });
    expect(res.body.data.every((u: any) => u.role === 'VENDOR')).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('cron: POST /cron/[job] (CRON_SECRET guard)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';

  it('rejects a request with no secret header', async () => {
    const res = await apiFetch('/api/v1/cron/access-code-expiry-janitor', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await apiFetch('/api/v1/cron/access-code-expiry-janitor', {
      method: 'POST',
      headers: { 'x-cron-secret': 'not-the-real-secret' },
    });
    expect(res.status).toBe(401);
  });

  it('404s an unknown job name, listing the real known jobs', async () => {
    const res = await apiFetch('/api/v1/cron/not-a-real-job', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(404);
    expect(res.body.knownJobs).toContain('access-code-expiry-janitor');
  });

  it('dispatches a real job with the correct secret, and running it again is a no-op (idempotent)', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, {
      validFrom: new Date(Date.now() - 2 * 86400000),
      validUntil: new Date(Date.now() - 86400000),
      status: 'ACTIVE',
    });

    const first = await apiFetch('/api/v1/cron/access-code-expiry-janitor', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(first.status).toBe(200);
    expect(first.body.result.expired).toBeGreaterThanOrEqual(1);

    const updated = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(updated?.status).toBe('EXPIRED');

    const second = await apiFetch('/api/v1/cron/access-code-expiry-janitor', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(second.status).toBe(200);
    expect(second.body.result.expired).toBe(0);
  });

  it('payment-reliability-scorer treats the chronologically-first payment as "the" payment, not insertion order', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });

    const dueDate = new Date(Date.now() - 10 * 86400000);
    const invoice = await createInvoice({ leaseId: lease.id, dueDate, status: 'PAID' });

    // Inserted deliberately out of chronological order: the LATE payment
    // first, the genuinely-on-time one second. Without an explicit
    // orderBy on the payments relation, payments[0] would be whichever the
    // DB happens to return first -- this proves the scorer reads the real
    // chronologically-first payment instead.
    await testPrisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 50_000,
        paidAt: new Date(dueDate.getTime() + 2 * 86400000),
      },
    });
    await testPrisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 50_000,
        paidAt: new Date(dueDate.getTime() - 1 * 86400000),
      },
    });

    const res = await apiFetch('/api/v1/cron/payment-reliability-scorer', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);

    const updated = await testPrisma.lease.findUnique({ where: { id: lease.id } });
    // The chronologically-first payment (paidAt before dueDate) was on time,
    // so this lease's only invoice counts as on-time -> EXCELLENT/LOW, not
    // FAIR/MEDIUM-or-worse as a late-counted misread would produce.
    expect(updated?.paymentReliability).toBe('EXCELLENT');
    expect(updated?.riskScore).toBe('LOW');
  });

  it('overdue-flagger respects Lease.gracePeriodDays -- not overdue, no reminder, no late fee, while still within grace', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, {
      gracePeriodDays: 10,
      lateFeePercentage: 5,
    });
    // Due 3 days ago -- past dueDate, but well within a 10-day grace period.
    const invoice = await createInvoice({
      leaseId: lease.id,
      type: 'RENT',
      amount: 100_000,
      dueDate: new Date(Date.now() - 3 * 86400000),
      status: 'UNPAID',
    });

    const res = await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.flagged).toBe(0);
    expect(res.body.result.lateFeesCreated).toBe(0);

    const stillUnpaid = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(stillUnpaid?.status).toBe('UNPAID');

    const lateFee = await testPrisma.invoice.findFirst({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    expect(lateFee).toBeNull();
  });

  it('overdue-flagger flags past-grace RENT invoices, sends one reminder, and creates a correctly-computed late fee -- idempotently', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, {
      gracePeriodDays: 2,
      lateFeePercentage: 5,
    });
    // Due 5 days ago, 2-day grace -- 3 days genuinely overdue.
    const invoice = await createInvoice({
      leaseId: lease.id,
      type: 'RENT',
      amount: 200_000,
      dueDate: new Date(Date.now() - 5 * 86400000),
      status: 'UNPAID',
    });

    const first = await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(first.status).toBe(200);
    expect(first.body.result.flagged).toBe(1);
    expect(first.body.result.remindersSent).toBe(1);
    expect(first.body.result.lateFeesCreated).toBe(1);

    const flagged = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(flagged?.status).toBe('OVERDUE');

    const reminder = await testPrisma.notice.findFirst({
      where: { invoiceId: invoice.id, type: 'PAYMENT_REMINDER' },
    });
    expect(reminder).not.toBeNull();

    const lateFee = await testPrisma.invoice.findFirst({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    expect(lateFee).not.toBeNull();
    expect(lateFee?.amount).toBe(10_000); // 5% of 200,000

    // Running again must not double-send the reminder or double-charge the fee.
    const second = await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(second.status).toBe(200);
    expect(second.body.result.remindersSent).toBe(0);
    expect(second.body.result.lateFeesCreated).toBe(0);

    const reminderCount = await testPrisma.notice.count({
      where: { invoiceId: invoice.id, type: 'PAYMENT_REMINDER' },
    });
    expect(reminderCount).toBe(1);
    const lateFeeCount = await testPrisma.invoice.count({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    expect(lateFeeCount).toBe(1);

    // The late fee invoice itself must never compound into a second late fee.
    const lateFeeInvoice = await testPrisma.invoice.findFirst({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    const lateFeeOfLateFee = await testPrisma.invoice.findFirst({
      where: {
        type: 'LATE_FEE',
        description: { contains: `[late-fee-for:${lateFeeInvoice!.id}]` },
      },
    });
    expect(lateFeeOfLateFee).toBeNull();
  });

  it('overdue-flagger never charges a late fee on a non-RENT invoice, even when lease-tied and past grace', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, {
      gracePeriodDays: 0,
      lateFeePercentage: 5,
    });
    const invoice = await createInvoice({
      leaseId: lease.id,
      type: 'SECURITY_DEPOSIT',
      amount: 500_000,
      dueDate: new Date(Date.now() - 86400000),
      status: 'UNPAID',
    });

    const res = await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);

    const flagged = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(flagged?.status).toBe('OVERDUE');

    const lateFee = await testPrisma.invoice.findFirst({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    expect(lateFee).toBeNull();
  });

  it('overdue-flagger uses the exact flat amount for a FIXED-type lease, ignoring lateFeePercentage entirely', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    // lateFeePercentage is set too, to prove FIXED mode ignores it rather
    // than stacking both -- landlord/manager picks exactly one mode.
    const lease = await createLease(unit.id, tenant.id, {
      gracePeriodDays: 0,
      lateFeeType: 'FIXED',
      lateFeeFlatAmount: 15_000,
      lateFeePercentage: 50,
    });
    const invoice = await createInvoice({
      leaseId: lease.id,
      type: 'RENT',
      amount: 200_000,
      dueDate: new Date(Date.now() - 86400000),
      status: 'UNPAID',
    });

    const res = await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.lateFeesCreated).toBe(1);

    const lateFee = await testPrisma.invoice.findFirst({
      where: { type: 'LATE_FEE', leaseId: lease.id },
    });
    expect(lateFee).not.toBeNull();
    expect(lateFee?.amount).toBe(15_000);
    expect(lateFee?.description).toContain(`[late-fee-for:${invoice.id}]`);
  });
});
