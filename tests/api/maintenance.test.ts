import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createMaintenanceCategory,
  createMaintenanceRequest,
  createMaintenanceSchedule,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('maintenance: categories', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lists only active categories, unauthenticated', async () => {
    await createMaintenanceCategory({ name: 'Plumbing', isActive: true });
    await createMaintenanceCategory({ name: 'Retired Category', isActive: false });

    const res = await apiFetch('/api/v1/maintenance/categories');
    expect(res.status).toBe(200);
    const names = res.body.data.map((c: any) => c.name);
    expect(names).toContain('Plumbing');
    expect(names).not.toContain('Retired Category');
  });

  it('rejects a non-admin creating a category', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/maintenance/categories', {
      method: 'POST',
      cookie,
      body: { name: 'Electrical' },
    });
    expect(res.status).toBe(403);
  });

  it('lets an admin create and then deactivate a category', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const created = await apiFetch('/api/v1/maintenance/categories', {
      method: 'POST',
      cookie,
      body: { name: 'HVAC' },
    });
    expect(created.status).toBe(201);

    const patched = await apiFetch('/api/v1/maintenance/categories', {
      method: 'PATCH',
      cookie,
      body: { id: created.body.data.id, isActive: false },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.isActive).toBe(false);
  });
});

describe('maintenance: requests, create', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a non-tenant caller', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/maintenance/requests', {
      method: 'POST',
      cookie,
      body: { unitId: 'whatever', title: 'x', description: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it('requires an ACTIVE lease on the unit for the requesting tenant', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);

    const res = await apiFetch('/api/v1/maintenance/requests', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, title: 'Broken window', description: 'Cracked glass' },
    });
    expect(res.status).toBe(403);
  });

  it('creates a request with a nullable category and defaults priority to MEDIUM', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);

    const res = await apiFetch('/api/v1/maintenance/requests', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, title: 'Broken window', description: 'Cracked glass' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.categoryId).toBeNull();
    expect(res.body.data.priority).toBe('MEDIUM');
    expect(res.body.data.status).toBe('SUBMITTED');
  });
});

describe('maintenance: requests, list scoping', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('scopes the list by role: tenant sees own, vendor sees assigned, manager sees their properties\', admin sees all', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const otherProperty = await createProperty({ managerId: otherManager.id });
    const unit = await createUnit(property.id);
    const otherUnit = await createUnit(otherProperty.id);

    const tenant = await createUser(Role.TENANT);
    const otherTenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);

    const mine = await createMaintenanceRequest(unit.id, tenant.id, { title: 'Mine', vendorId: vendor.id });
    await createMaintenanceRequest(otherUnit.id, otherTenant.id, { title: 'Not mine' });

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantRes = await apiFetch('/api/v1/maintenance/requests', { cookie: tenantCookie });
    expect(tenantRes.body.data.map((r: any) => r.title)).toEqual(['Mine']);

    const vendorCookie = await authCookie(vendor.id, vendor.role);
    const vendorRes = await apiFetch('/api/v1/maintenance/requests', { cookie: vendorCookie });
    expect(vendorRes.body.data.map((r: any) => r.id)).toEqual([mine.id]);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerRes = await apiFetch('/api/v1/maintenance/requests', { cookie: managerCookie });
    expect(managerRes.body.data.map((r: any) => r.title)).toEqual(['Mine']);

    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    const adminRes = await apiFetch('/api/v1/maintenance/requests', { cookie: adminCookie });
    expect(adminRes.body.data.length).toBe(2);
  });

  it('includes unit.property and tenant on every list row (regression: Phase 9.4 found this missing)', async () => {
    const admin = await createUser(Role.ADMIN);
    const property = await createProperty({ name: 'Include Check Property' });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT, { name: 'Include Check Tenant' });
    await createMaintenanceRequest(unit.id, tenant.id);

    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch('/api/v1/maintenance/requests', { cookie });
    const row = res.body.data.find((r: any) => r.unit.id === unit.id);
    expect(row.unit.property.name).toBe('Include Check Property');
    expect(row.tenant.name).toBe('Include Check Tenant');
  });
});

describe('maintenance: requests, [id] read access', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('allows the owning tenant, the assigned vendor, and the managing property owner; forbids everyone else', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const stranger = await createUser(Role.TENANT);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });

    for (const user of [manager, tenant, vendor]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, { cookie });
      expect(res.status).toBe(200);
    }

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, { cookie: strangerCookie });
    expect(forbidden.status).toBe(403);
  });
});

describe('maintenance: requests, [id] PATCH -- triage / cancel / progress', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lets the managing owner triage (category/priority/vendor/schedule), and forbids a tenant from triaging', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const category = await createMaintenanceCategory();
    const request = await createMaintenanceRequest(unit.id, tenant.id);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantTriage = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { vendorId: vendor.id },
    });
    expect(tenantTriage.status).toBe(403);

    const managerCookie = await authCookie(manager.id, manager.role);
    const triage = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { categoryId: category.id, priority: 'HIGH', vendorId: vendor.id },
    });
    expect(triage.status).toBe(200);
    expect(triage.body.data.categoryId).toBe(category.id);
    expect(triage.body.data.priority).toBe('HIGH');
    expect(triage.body.data.vendorId).toBe(vendor.id);
  });

  it('lets the managing owner or the owning tenant cancel, forbids anyone else', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);

    const byTenant = await createMaintenanceRequest(unit.id, tenant.id, { title: 'Cancel by tenant' });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantCancel = await apiFetch(`/api/v1/maintenance/requests/${byTenant.id}`, {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { status: 'CANCELLED' },
    });
    expect(tenantCancel.status).toBe(200);
    expect(tenantCancel.body.data.status).toBe('CANCELLED');

    const byManager = await createMaintenanceRequest(unit.id, tenant.id, { title: 'Cancel by manager' });
    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const strangerCancel = await apiFetch(`/api/v1/maintenance/requests/${byManager.id}`, {
      method: 'PATCH',
      cookie: strangerCookie,
      body: { status: 'CANCELLED' },
    });
    expect(strangerCancel.status).toBe(403);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerCancel = await apiFetch(`/api/v1/maintenance/requests/${byManager.id}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { status: 'CANCELLED' },
    });
    expect(managerCancel.status).toBe(200);
  });

  it('only the assigned vendor can move to IN_PROGRESS, and can attach vendorNotes at the same time', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const otherVendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });

    const otherVendorCookie = await authCookie(otherVendor.id, otherVendor.role);
    const forbidden = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: otherVendorCookie,
      body: { status: 'IN_PROGRESS' },
    });
    expect(forbidden.status).toBe(403);

    const vendorCookie = await authCookie(vendor.id, vendor.role);
    const started = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: { status: 'IN_PROGRESS', vendorNotes: 'On my way' },
    });
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');
    expect(started.body.data.vendorNotes).toBe('On my way');
  });

  it('requires completionProofUrl and finalCost to complete, and auto-creates a MAINTENANCE invoice', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'IN_PROGRESS',
      title: 'Fix the leak',
    });
    const vendorCookie = await authCookie(vendor.id, vendor.role);

    const missingFields = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: { status: 'COMPLETED' },
    });
    expect(missingFields.status).toBe(400);

    const completed = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: { status: 'COMPLETED', completionProofUrl: 'https://example.com/proof.jpg', finalCost: 15_000 },
    });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.completedAt).not.toBeNull();

    const invoice = await testPrisma.invoice.findFirst({ where: { maintenanceRequestId: request.id } });
    expect(invoice).not.toBeNull();
    expect(invoice?.type).toBe('MAINTENANCE');
    expect(invoice?.amount).toBe(15_000);
  });

  it('lets the assigned vendor leave a vendorNotes-only update with no status change', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'IN_PROGRESS',
    });
    const vendorCookie = await authCookie(vendor.id, vendor.role);

    const res = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: { vendorNotes: 'Waiting on a replacement part' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.vendorNotes).toBe('Waiting on a replacement part');
  });
});

describe('maintenance: rating', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('only the owning tenant can rate, only once COMPLETED, only with an assigned vendor, and only once', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const stranger = await createUser(Role.TENANT);

    const notCompleted = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tooEarly = await apiFetch(`/api/v1/maintenance/requests/${notCompleted.id}/rating`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { rating: 5 },
    });
    expect(tooEarly.status).toBe(409);

    const completed = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'COMPLETED',
    });

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const notOwner = await apiFetch(`/api/v1/maintenance/requests/${completed.id}/rating`, {
      method: 'POST',
      cookie: strangerCookie,
      body: { rating: 5 },
    });
    expect(notOwner.status).toBe(403);

    const first = await apiFetch(`/api/v1/maintenance/requests/${completed.id}/rating`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { rating: 4, comment: 'Good work' },
    });
    expect(first.status).toBe(201);

    const duplicate = await apiFetch(`/api/v1/maintenance/requests/${completed.id}/rating`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { rating: 2 },
    });
    expect(duplicate.status).toBe(409);
  });
});

describe('maintenance: schedules', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects TENANT/VENDOR callers entirely', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/maintenance/schedules', { cookie });
    expect(res.status).toBe(403);
  });

  it('scopes the list to the caller\'s own properties for MANAGER/LANDLORD, and everything for ADMIN', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const otherProperty = await createProperty({ managerId: otherManager.id });
    const unit = await createUnit(property.id);
    const otherUnit = await createUnit(otherProperty.id);
    const category = await createMaintenanceCategory();

    await createMaintenanceSchedule(unit.id, category.id);
    await createMaintenanceSchedule(otherUnit.id, category.id);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerRes = await apiFetch('/api/v1/maintenance/schedules', { cookie: managerCookie });
    expect(managerRes.body.data.length).toBe(1);

    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    const adminRes = await apiFetch('/api/v1/maintenance/schedules', { cookie: adminCookie });
    expect(adminRes.body.data.length).toBe(2);
  });

  it('gates creation through canManageProperty on the unit\'s own property', async () => {
    const owner = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: owner.id });
    const unit = await createUnit(property.id);
    const category = await createMaintenanceCategory();

    const intruderCookie = await authCookie(intruder.id, intruder.role);
    const forbidden = await apiFetch('/api/v1/maintenance/schedules', {
      method: 'POST',
      cookie: intruderCookie,
      body: { unitId: unit.id, categoryId: category.id, frequency: 'MONTHLY', nextDueDate: new Date().toISOString() },
    });
    expect(forbidden.status).toBe(403);

    const ownerCookie = await authCookie(owner.id, owner.role);
    const created = await apiFetch('/api/v1/maintenance/schedules', {
      method: 'POST',
      cookie: ownerCookie,
      body: { unitId: unit.id, categoryId: category.id, frequency: 'MONTHLY', nextDueDate: new Date().toISOString() },
    });
    expect(created.status).toBe(201);
  });
});
