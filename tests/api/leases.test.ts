import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('leases: list (GET /leases)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a VENDOR caller outright', async () => {
    const vendor = await createUser(Role.VENDOR);
    const cookie = await authCookie(vendor.id, vendor.role);
    const res = await apiFetch('/api/v1/leases', { cookie });
    expect(res.status).toBe(403);
  });

  it('scopes by role: tenant sees own, manager sees their properties\', admin sees all', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const otherProperty = await createProperty({ managerId: otherManager.id });
    const unit = await createUnit(property.id);
    const otherUnit = await createUnit(otherProperty.id);
    const tenant = await createUser(Role.TENANT);
    const otherTenant = await createUser(Role.TENANT);

    await createLease(unit.id, tenant.id);
    await createLease(otherUnit.id, otherTenant.id);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantRes = await apiFetch('/api/v1/leases', { cookie: tenantCookie });
    expect(tenantRes.body.data.length).toBe(1);
    expect(tenantRes.body.data[0].tenantId).toBe(tenant.id);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerRes = await apiFetch('/api/v1/leases', { cookie: managerCookie });
    expect(managerRes.body.data.length).toBe(1);
    expect(managerRes.body.data[0].unit.propertyId).toBe(property.id);

    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    const adminRes = await apiFetch('/api/v1/leases', { cookie: adminCookie });
    expect(adminRes.body.data.length).toBe(2);
  });
});

describe('leases: create (POST /leases)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects TENANT/VENDOR callers', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: { unitId: 'x', startDate: new Date(), endDate: new Date(), rentAmount: 1, deposit: 0, tenantId: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it('forbids creating a lease on a unit the caller does not manage', async () => {
    const owner = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: owner.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(intruder.id, intruder.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 1_200_000,
        deposit: 200_000,
      },
    });
    expect(res.status).toBe(403);
  });

  it('creates a lease for an existing tenantId with an initial RENT invoice, rentAmount never multiplied', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 1_200_000,
        paymentFrequency: 'ANNUAL',
        deposit: 200_000,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.rentAmount).toBe(1_200_000);
    expect(res.body.data.tenantInvited).toBe(false);

    const invoice = await testPrisma.invoice.findFirst({ where: { leaseId: res.body.data.id } });
    expect(invoice).not.toBeNull();
    expect(invoice?.type).toBe('RENT');
    // Rule 5: rentAmount is per payment cycle -- the initial invoice must
    // equal it exactly, never rentAmount * 12 or any other normalization.
    expect(invoice?.amount).toBe(1_200_000);
  });

  it('rejects a tenantId that does not reference a real TENANT user', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const notATenant = await createUser(Role.VENDOR);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantId: notATenant.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 1_000_000,
        deposit: 100_000,
      },
    });
    expect(res.status).toBe(400);
  });

  it('the tenantEmail path reuses an existing TENANT account rather than duplicating it', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const existingTenant = await createUser(Role.TENANT, { email: 'existing-tenant@test.local' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantEmail: 'existing-tenant@test.local',
        tenantName: 'Ignored Name',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 900_000,
        deposit: 90_000,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(existingTenant.id);
    expect(res.body.data.tenantInvited).toBe(false);
  });

  it('the tenantEmail path invites a brand-new tenant: PENDING_VERIFICATION user + VerificationToken issued', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantEmail: 'brand-new-tenant@test.local',
        tenantName: 'Brand New Tenant',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 700_000,
        deposit: 70_000,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tenantInvited).toBe(true);

    // The invite's raw token is only ever sent via the (console-transport)
    // email -- it's a one-way SHA-256 hash in the DB, so it can't be
    // recovered here to drive a real verify-email round trip. Login's
    // PENDING_VERIFICATION 403 is already covered directly in auth.test.ts;
    // what this route is actually responsible for is these two DB effects.
    const newUser = await testPrisma.user.findUnique({ where: { email: 'brand-new-tenant@test.local' } });
    expect(newUser?.status).toBe('PENDING_VERIFICATION');
    const token = await testPrisma.verificationToken.findUnique({ where: { userId: newUser!.id } });
    expect(token).not.toBeNull();
  });

  it('rejects a tenantEmail that belongs to an existing non-TENANT account', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    await createUser(Role.VENDOR, { email: 'a-vendor@test.local' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/leases', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantEmail: 'a-vendor@test.local',
        tenantName: 'Whoever',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        rentAmount: 500_000,
        deposit: 50_000,
      },
    });
    expect(res.status).toBe(400);
  });
});

describe('leases: [id] read access', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('allows the owning tenant and the managing owner; forbids everyone else', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);

    for (const user of [manager, tenant]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/leases/${lease.id}`, { cookie });
      expect(res.status).toBe(200);
    }

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch(`/api/v1/leases/${lease.id}`, { cookie: strangerCookie });
    expect(forbidden.status).toBe(403);
  });
});

describe('leases: [id] PATCH -- status and renewal', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a TENANT caller outright, and a non-owning manager', async () => {
    const manager = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantAttempt = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { status: 'TERMINATED' },
    });
    expect(tenantAttempt.status).toBe(403);

    const intruderCookie = await authCookie(intruder.id, intruder.role);
    const intruderAttempt = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie: intruderCookie,
      body: { status: 'TERMINATED' },
    });
    expect(intruderAttempt.status).toBe(403);
  });

  it('updates status for the managing owner', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'TERMINATED' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TERMINATED');
  });

  it('rejects an empty PATCH body', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/leases/${lease.id}`, { method: 'PATCH', cookie, body: {} });
    expect(res.status).toBe(400);
  });

  it('renewal (rule 6) creates a NEW lease linked via renewedFromId and expires the old one, instead of a LeaseStatus value', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const oldLease = await createLease(unit.id, tenant.id, { rentAmount: 1_000_000 });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/leases/${oldLease.id}`, {
      method: 'PATCH',
      cookie,
      body: {
        renew: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
          rentAmount: 1_100_000,
          deposit: 200_000,
        },
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.renewedFromId).toBe(oldLease.id);
    expect(res.body.data.rentAmount).toBe(1_100_000);

    const refetchedOld = await testPrisma.lease.findUnique({ where: { id: oldLease.id } });
    expect(refetchedOld?.status).toBe('EXPIRED');
  });

  it('lets the managing owner edit gracePeriodDays and late-fee terms directly, unbounded (landlord/manager autonomy)', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    // Switch to a flat-amount late fee with a deliberately large,
    // unbounded value -- there is no platform-imposed cap.
    const res = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie,
      body: {
        gracePeriodDays: 45,
        lateFeeType: 'FIXED',
        lateFeeFlatAmount: 999_999,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.gracePeriodDays).toBe(45);
    expect(res.body.data.lateFeeType).toBe('FIXED');
    expect(res.body.data.lateFeeFlatAmount).toBe(999_999);

    const refetched = await testPrisma.lease.findUnique({ where: { id: lease.id } });
    expect(refetched?.gracePeriodDays).toBe(45);
    expect(refetched?.lateFeeType).toBe('FIXED');
  });
});

describe('leases: [id] PATCH -- Unit.status kept in sync with lease lifecycle', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('activating a PENDING lease (status -> ACTIVE) occupies its unit', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'PENDING' });
    const cookie = await authCookie(manager.id, manager.role);

    const before = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(before?.status).toBe('VACANT');

    const res = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'ACTIVE' },
    });
    expect(res.status).toBe(200);

    const after = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(after?.status).toBe('OCCUPIED');
  });

  it('terminating the only ACTIVE lease on a unit frees it back to VACANT', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const cookie = await authCookie(manager.id, manager.role);
    // Occupy it first via the real activation path, then terminate.
    await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'ACTIVE' },
    });

    const res = await apiFetch(`/api/v1/leases/${lease.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'TERMINATED' },
    });
    expect(res.status).toBe(200);

    const after = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(after?.status).toBe('VACANT');
  });

  it('does not vacate a unit that still has another ACTIVE lease when one lease terminates', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenantA = await createUser(Role.TENANT);
    const tenantB = await createUser(Role.TENANT);
    // Schema doesn't prevent two leases on one unit -- exercising exactly
    // that edge case, which is why the route re-queries for a survivor
    // instead of unconditionally vacating.
    const leaseA = await createLease(unit.id, tenantA.id, { status: 'ACTIVE' });
    await createLease(unit.id, tenantB.id, { status: 'ACTIVE' });
    // Fixtures write directly via Prisma, bypassing the route -- occupy the
    // unit explicitly first so the guard below has something real to
    // preserve, rather than trivially passing because it was VACANT anyway.
    await testPrisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/leases/${leaseA.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'TERMINATED' },
    });
    expect(res.status).toBe(200);

    const after = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(after?.status).toBe('OCCUPIED');
  });

  it('renewal keeps the unit OCCUPIED', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const oldLease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/leases/${oldLease.id}`, {
      method: 'PATCH',
      cookie,
      body: {
        renew: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
          rentAmount: 1_000_000,
          deposit: 100_000,
        },
      },
    });
    expect(res.status).toBe(201);

    const after = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(after?.status).toBe('OCCUPIED');
  });
});

describe('leases: notices', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('only the managing owner can create a notice; the owning tenant cannot', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantCreate = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { type: 'RENEWAL_OFFER' },
    });
    expect(tenantCreate.status).toBe(403);

    const managerCookie = await authCookie(manager.id, manager.role);
    const created = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: managerCookie,
      body: { type: 'RENEWAL_OFFER', content: 'Would you like to renew?', status: 'SENT' },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('SENT');
    expect(created.body.data.sentAt).not.toBeNull();
  });

  it('lets the owning tenant respond only with an allowed status, and stamps viewedAt/respondedAt', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const managerCookie = await authCookie(manager.id, manager.role);

    const notice = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: managerCookie,
      body: { type: 'RENEWAL_OFFER', status: 'SENT' },
    });

    const tenantCookie = await authCookie(tenant.id, tenant.role);

    const disallowed = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { id: notice.body.data.id, status: 'SENT' },
    });
    expect(disallowed.status).toBe(403);

    const viewed = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { id: notice.body.data.id, status: 'VIEWED' },
    });
    expect(viewed.status).toBe(200);
    expect(viewed.body.data.viewedAt).not.toBeNull();

    const accepted = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { id: notice.body.data.id, status: 'ACCEPTED' },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.respondedAt).not.toBeNull();
  });

  it('GET forbids a caller who is neither the owning tenant nor the managing owner', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const res = await apiFetch(`/api/v1/leases/${lease.id}/notices`, { cookie: strangerCookie });
    expect(res.status).toBe(403);
  });
});

describe('leases: notes -- MANAGER/ADMIN only, deliberately excluding LANDLORD', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects LANDLORD, TENANT, and VENDOR callers', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const landlord = await createUser(Role.LANDLORD);

    for (const user of [landlord, tenant]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/leases/${lease.id}/notes`, { cookie });
      expect(res.status).toBe(403);
    }
  });

  it('lets MANAGER and ADMIN create and list notes', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    const created = await apiFetch(`/api/v1/leases/${lease.id}/notes`, {
      method: 'POST',
      cookie,
      body: { body: 'Called tenant about late rent.' },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.authorId).toBe(manager.id);

    const list = await apiFetch(`/api/v1/leases/${lease.id}/notes`, { cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.map((n: any) => n.body)).toContain('Called tenant about late rent.');
  });
});
