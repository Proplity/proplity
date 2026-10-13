import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createMaintenanceRequest,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('vendor verification (ISS-043)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function pendingVendor() {
    const vendor = await createUser(Role.VENDOR, { name: 'Pending Pipes' });
    await testPrisma.vendorProfile.create({
      data: { userId: vendor.id, businessName: 'Pending Pipes Ltd' },
    });
    return vendor;
  }

  it('hides an unverified vendor from the list and refuses to assign them', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const job = await createMaintenanceRequest(unit.id, tenant.id);
    const vendor = await pendingVendor();
    const mCookie = await authCookie(manager.id, manager.role);

    const list = await apiFetch('/api/v1/vendors', { cookie: mCookie });
    expect(list.body.data.map((v: { id: string }) => v.id)).not.toContain(vendor.id);

    const assign = await apiFetch(`/api/v1/maintenance/requests/${job.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { vendorId: vendor.id },
    });
    expect(assign.status).toBe(409);
    expect(assign.body.code).toBe('VENDOR_NOT_VERIFIED');
  });

  it('lets only an admin decide, then lists and assigns a verified vendor', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const job = await createMaintenanceRequest(unit.id, tenant.id);
    const vendor = await pendingVendor();
    const aCookie = await authCookie(admin.id, admin.role);
    const mCookie = await authCookie(manager.id, manager.role);

    const denied = await apiFetch(`/api/v1/admin/vendors/${vendor.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'VERIFIED' },
    });
    expect(denied.status).toBe(403);

    const ok = await apiFetch(`/api/v1/admin/vendors/${vendor.id}`, {
      method: 'PATCH',
      cookie: aCookie,
      body: { status: 'VERIFIED' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.verificationStatus).toBe('VERIFIED');

    const audit = await testPrisma.auditLog.findMany({
      where: { action: 'VENDOR_VERIFIED', actorId: admin.id },
    });
    expect(audit).toHaveLength(1);
    const told = await testPrisma.notification.findMany({
      where: { recipientId: vendor.id, title: 'Your business is verified' },
    });
    expect(told).toHaveLength(1);

    const list = await apiFetch('/api/v1/vendors', { cookie: mCookie });
    expect(list.body.data.map((v: { id: string }) => v.id)).toContain(vendor.id);
    const assign = await apiFetch(`/api/v1/maintenance/requests/${job.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { vendorId: vendor.id },
    });
    expect(assign.status).toBe(200);
  });

  it('records a rejection with its reason and keeps the vendor hidden', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const vendor = await pendingVendor();
    const aCookie = await authCookie(admin.id, admin.role);

    const res = await apiFetch(`/api/v1/admin/vendors/${vendor.id}`, {
      method: 'PATCH',
      cookie: aCookie,
      body: { status: 'REJECTED', note: 'CAC number could not be confirmed' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verificationNote).toBe('CAC number could not be confirmed');

    const mCookie = await authCookie(manager.id, manager.role);
    const list = await apiFetch('/api/v1/vendors', { cookie: mCookie });
    expect(list.body.data.map((v: { id: string }) => v.id)).not.toContain(vendor.id);

    const unknown = await apiFetch(`/api/v1/admin/vendors/${manager.id}`, {
      method: 'PATCH',
      cookie: aCookie,
      body: { status: 'VERIFIED' },
    });
    expect(unknown.status).toBe(404);
  });
});
