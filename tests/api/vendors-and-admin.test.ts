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
    const res = await apiFetch<{
      data: {
        id: string;
        businessName: string;
        totalJobs: number;
        jobsDone: number;
        completionRate: number | null;
        rating: number | null;
      }[];
    }>('/api/v1/vendors', { cookie });
    expect(res.status).toBe(200);

    expect(res.body.data.find((v) => v.id === suspendedVendor.id)).toBeUndefined();

    const found = res.body.data.find((v) => v.id === vendor.id);
    expect(found?.businessName).toBe('Reliable Repairs'); // no VendorProfile -> falls back to name
    expect(found?.totalJobs).toBe(3);
    expect(found?.jobsDone).toBe(2);
    expect(found?.completionRate).toBe(67);
    expect(found?.rating).toBe(4);

    const freshVendor = res.body.data.find((v) => v.id === noJobsVendor.id);
    expect(freshVendor?.completionRate).toBeNull();
    expect(freshVendor?.rating).toBeNull();
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
    const res = await apiFetch<{
      data: { id: string; passwordHash?: string; propertiesCount: number }[];
    }>('/api/v1/admin/users', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data[0].passwordHash).toBeUndefined();

    const managerRow = res.body.data.find((u) => u.id === manager.id);
    expect(managerRow?.propertiesCount).toBe(2);
    const tenantRow = res.body.data.find((u) => u.id === tenant.id);
    expect(tenantRow?.propertiesCount).toBe(0);
  });

  it('filters by ?role=', async () => {
    const admin = await createUser(Role.ADMIN);
    await createUser(Role.VENDOR);
    await createUser(Role.TENANT);
    const cookie = await authCookie(admin.id, admin.role);

    const res = await apiFetch<{
      data: { role: string }[];
    }>('/api/v1/admin/users?role=VENDOR', { cookie });
    expect(res.body.data.every((u) => u.role === 'VENDOR')).toBe(true);
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

describe('admin: suspend, reactivate and change role (ISS-054)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const patch = (cookie: string, id: string, body: object) =>
    apiFetch(`/api/v1/admin/users/${id}`, { method: 'PATCH', cookie, body });

  it('suspends a user, locks them out at once, revokes sessions and audits it', async () => {
    const admin = await createUser(Role.ADMIN);
    const tenant = await createUser(Role.TENANT);
    const adminCookie = await authCookie(admin.id, admin.role);
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    await testPrisma.refreshToken.create({
      data: {
        userId: tenant.id,
        tokenHash: `h-${tenant.id}`,
        familyId: tenant.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    expect((await apiFetch('/api/v1/leases', { cookie: tenantCookie })).status).toBe(200);

    const res = await patch(adminCookie, tenant.id, {
      status: 'SUSPENDED',
      reason: 'Fraud report',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUSPENDED');

    // The still-valid access token stops working immediately.
    expect((await apiFetch('/api/v1/leases', { cookie: tenantCookie })).status).toBe(403);
    const token = await testPrisma.refreshToken.findUnique({
      where: { tokenHash: `h-${tenant.id}` },
    });
    expect(token?.revokedAt).not.toBeNull();
    const audit = await testPrisma.auditLog.findFirst({
      where: { entityId: tenant.id, action: 'USER_SUSPENDED' },
    });
    expect(audit?.actorId).toBe(admin.id);

    const back = await patch(adminCookie, tenant.id, { status: 'ACTIVE', reason: 'Resolved' });
    expect(back.status).toBe(200);
    expect((await apiFetch('/api/v1/leases', { cookie: tenantCookie })).status).toBe(200);
  });

  it('protects admins and the caller, and needs a reason', async () => {
    const admin = await createUser(Role.ADMIN);
    const other = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    expect((await patch(cookie, admin.id, { status: 'SUSPENDED', reason: 'oops' })).status).toBe(
      403,
    );
    expect((await patch(cookie, other.id, { status: 'SUSPENDED', reason: 'no' })).status).toBe(400);
    expect((await patch(cookie, other.id, { status: 'SUSPENDED', reason: 'testing' })).status).toBe(
      403,
    );
    const unverified = await createUser(Role.TENANT, { status: 'PENDING_VERIFICATION' });
    expect(
      (await patch(cookie, unverified.id, { status: 'ACTIVE', reason: 'by hand' })).status,
    ).toBe(409);
  });

  it('changes the role of someone with no records, but not someone who has some', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const fresh = await createUser(Role.TENANT);
    const ok = await patch(cookie, fresh.id, { role: 'LANDLORD', reason: 'Signed up wrong' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.role).toBe('LANDLORD');

    const manager = await createUser(Role.MANAGER);
    await createProperty({ managerId: manager.id });
    const blocked = await patch(cookie, manager.id, { role: 'TENANT', reason: 'Switching' });
    expect(blocked.status).toBe(409);
  });

  it('is admin-only, and the user list filters and pages in the database', async () => {
    const manager = await createUser(Role.MANAGER);
    const target = await createUser(Role.TENANT);
    expect(
      (
        await patch(await authCookie(manager.id, manager.role), target.id, {
          role: 'VENDOR',
          reason: 'abc',
        })
      ).status,
    ).toBe(403);

    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    await createUser(Role.TENANT, { name: 'Zed Searchable', status: 'SUSPENDED' });
    const byName = await apiFetch('/api/v1/admin/users?q=searchable', { cookie });
    expect(byName.body.data.map((u: { name: string }) => u.name)).toEqual(['Zed Searchable']);
    const suspended = await apiFetch('/api/v1/admin/users?status=SUSPENDED', { cookie });
    expect(suspended.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(suspended.body.data.every((u: { status: string }) => u.status === 'SUSPENDED')).toBe(
      true,
    );
    const paged = await apiFetch('/api/v1/admin/users?limit=2&page=2', { cookie });
    expect(paged.body.data).toHaveLength(2);
  });
});

describe('admin: audit log filters, paging and names (ISS-055)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('filters by action, entity, actor and date, pages, and names the subject', async () => {
    const admin = await createUser(Role.ADMIN, { name: 'Ada Admin' });
    const other = await createUser(Role.ADMIN, { name: 'Bola Other' });
    const tenant = await createUser(Role.TENANT, { name: 'Tunde Tenant' });
    const cookie = await authCookie(admin.id, admin.role);

    for (let i = 0; i < 30; i++) {
      await testPrisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'USER_SUSPENDED',
          entityType: 'User',
          entityId: tenant.id,
          metadata: { reason: `r${i}` },
        },
      });
    }
    await testPrisma.auditLog.create({
      data: {
        actorId: other.id,
        action: 'INVOICE_EDITED',
        entityType: 'Invoice',
        entityId: 'gone',
      },
    });
    await testPrisma.auditLog.create({
      data: {
        actorId: null,
        action: 'FILE_RETENTION_DELETED',
        entityType: 'StoredFile',
        entityId: 'f1',
        createdAt: new Date('2020-01-15T10:00:00Z'),
      },
    });

    const all = await apiFetch('/api/v1/admin/audit-logs?limit=10&facets=1', { cookie });
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(32);
    expect(all.body.data).toHaveLength(10);
    expect(all.body.facets.actions).toEqual(
      expect.arrayContaining(['USER_SUSPENDED', 'INVOICE_EDITED', 'FILE_RETENTION_DELETED']),
    );
    expect(all.body.facets.entityTypes).toEqual(
      expect.arrayContaining(['User', 'Invoice', 'StoredFile']),
    );

    const byAction = await apiFetch('/api/v1/admin/audit-logs?action=USER_SUSPENDED&limit=100', {
      cookie,
    });
    expect(byAction.body.meta.total).toBe(30);
    // The subject is named, not just an id.
    expect(byAction.body.data[0].entityLabel).toBe(`Tunde Tenant (${tenant.email})`);

    const byActor = await apiFetch('/api/v1/admin/audit-logs?actor=bola', { cookie });
    expect(byActor.body.data.map((l: { action: string }) => l.action)).toEqual(['INVOICE_EDITED']);
    // A subject that no longer exists has no label rather than an error.
    expect(byActor.body.data[0].entityLabel).toBeNull();

    const byDate = await apiFetch('/api/v1/admin/audit-logs?from=2020-01-15&to=2020-01-15', {
      cookie,
    });
    expect(byDate.body.data.map((l: { action: string }) => l.action)).toEqual([
      'FILE_RETENTION_DELETED',
    ]);

    const byEntity = await apiFetch('/api/v1/admin/audit-logs?entityType=Invoice', { cookie });
    expect(byEntity.body.meta.total).toBe(1);

    const page3 = await apiFetch('/api/v1/admin/audit-logs?limit=10&page=4', { cookie });
    expect(page3.body.data).toHaveLength(2);
  });

  it('is admin-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const res = await apiFetch('/api/v1/admin/audit-logs', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(403);
  });
});

describe('admin: switches for auto-pay and retention, and the retention periods (ADR-0015)', () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let adminCookie: string;
  const patch = (body: unknown, cookie = adminCookie) =>
    apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie, body });

  beforeAll(async () => {
    await resetDb();
    admin = await createUser(Role.ADMIN);
    adminCookie = await authCookie(admin.id, admin.role);
  });

  it('starts with both switches off and ADR-0012 periods, and says what the deployment allows', async () => {
    const res = await apiFetch('/api/v1/admin/settings', { cookie: adminCookie });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      autopayChargingEnabled: false,
      retentionEnabled: false,
      retentionAfterTenancyDays: 365,
      retentionAfterRejectionDays: 90,
    });
    // The test server runs with both deployment flags on (tests/setup/globalSetup.ts).
    expect(res.body.data.deploymentAllows).toEqual({ autopay: true, retention: true });
  });

  it('is for admins only', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    expect((await patch({ retentionEnabled: true }, cookie)).status).toBe(403);
    expect((await apiFetch('/api/v1/admin/settings', { cookie })).status).toBe(403);
  });

  it('refuses periods short enough to be a typo, or not whole days', async () => {
    for (const body of [
      { retentionAfterTenancyDays: 3 },
      { retentionAfterTenancyDays: 29 },
      { retentionAfterTenancyDays: 4000 },
      { retentionAfterRejectionDays: 6 },
      { retentionAfterRejectionDays: 12.5 },
      { retentionAfterRejectionDays: '90' },
    ]) {
      const res = await patch(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const after = await apiFetch('/api/v1/admin/settings', { cookie: adminCookie });
    expect(after.body.data.retentionAfterTenancyDays).toBe(365);
    expect(after.body.data.retentionAfterRejectionDays).toBe(90);
  });

  it('saves the switches and periods, answers with the new settings and logs who changed what', async () => {
    const res = await patch({
      autopayChargingEnabled: true,
      retentionEnabled: true,
      retentionAfterTenancyDays: 730,
      retentionAfterRejectionDays: 30,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      autopayChargingEnabled: true,
      retentionEnabled: true,
      retentionAfterTenancyDays: 730,
      retentionAfterRejectionDays: 30,
    });
    expect(res.body.data.deploymentAllows).toBeDefined();

    const logs = await testPrisma.auditLog.findMany({
      where: { action: 'SETTINGS_CHANGED', actorId: admin.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata).toEqual({
      changes: {
        autopayChargingEnabled: { from: false, to: true },
        retentionEnabled: { from: false, to: true },
        retentionAfterTenancyDays: { from: 365, to: 730 },
        retentionAfterRejectionDays: { from: 90, to: 30 },
      },
    });

    // Sending the same values again changes nothing, so it is not logged again.
    await patch({ retentionEnabled: true });
    expect(
      await testPrisma.auditLog.count({ where: { action: 'SETTINGS_CHANGED', actorId: admin.id } }),
    ).toBe(1);

    const off = await patch({ autopayChargingEnabled: false });
    expect(off.body.data.autopayChargingEnabled).toBe(false);
    expect(off.body.data.retentionEnabled).toBe(true);
  });
});
