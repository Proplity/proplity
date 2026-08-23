import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createMaintenanceRequest,
  createAccessCode,
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
    await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id, status: 'COMPLETED' });
    await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id, status: 'IN_PROGRESS' });
    await testPrisma.vendorRating.create({
      data: { maintenanceRequestId: done1.id, vendorId: vendor.id, ratedById: tenant.id, rating: 4 },
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
});
