import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('applications: submit, list scoping, review', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('POST is TENANT-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, details: { firstName: 'X' } },
    });
    expect(res.status).toBe(403);
  });

  it('a tenant can submit, and a second PENDING application for the same unit is rejected', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);

    const first = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        details: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.local' },
      },
    });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('PENDING');

    const dupe = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, details: { firstName: 'Ada' } },
    });
    expect(dupe.status).toBe(409);
  });

  it('GET scopes: tenant sees only their own, manager sees only applications on properties they manage', async () => {
    const managerA = await createUser(Role.MANAGER);
    const managerB = await createUser(Role.MANAGER);
    const propertyA = await createProperty({ managerId: managerA.id });
    const unitA = await createUnit(propertyA.id);
    const tenant1 = await createUser(Role.TENANT);
    const tenant2 = await createUser(Role.TENANT);

    const cookie1 = await authCookie(tenant1.id, tenant1.role);
    await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: cookie1,
      body: { unitId: unitA.id, details: { firstName: 'One' } },
    });
    const cookie2 = await authCookie(tenant2.id, tenant2.role);
    await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: cookie2,
      body: { unitId: unitA.id, details: { firstName: 'Two' } },
    });

    const tenant1View = await apiFetch('/api/v1/applications', { cookie: cookie1 });
    expect(tenant1View.body.data.length).toBe(1);
    expect(tenant1View.body.data[0].applicantId).toBe(tenant1.id);

    const managerAView = await apiFetch('/api/v1/applications', {
      cookie: await authCookie(managerA.id, managerA.role),
    });
    expect(managerAView.body.data.length).toBe(2);

    const managerBView = await apiFetch('/api/v1/applications', {
      cookie: await authCookie(managerB.id, managerB.role),
    });
    expect(managerBView.body.data.length).toBe(0);
  });

  it('PATCH (review) requires managing the property, and cannot re-review an already-decided application', async () => {
    const manager = await createUser(Role.MANAGER);
    const strangerManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const tenantCookie = await authCookie(tenant.id, tenant.role);

    const created = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: tenantCookie,
      body: { unitId: unit.id, details: { firstName: 'Reviewed' } },
    });
    const applicationId = created.body.data.id;

    const strangerAttempt = await apiFetch(`/api/v1/applications/${applicationId}`, {
      method: 'PATCH',
      cookie: await authCookie(strangerManager.id, strangerManager.role),
      body: { status: 'APPROVED' },
    });
    expect(strangerAttempt.status).toBe(403);

    const managerCookie = await authCookie(manager.id, manager.role);
    const approve = await apiFetch(`/api/v1/applications/${applicationId}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { status: 'APPROVED', reviewNotes: 'Looks good' },
    });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('APPROVED');
    expect(approve.body.data.reviewedById).toBe(manager.id);

    const reReview = await apiFetch(`/api/v1/applications/${applicationId}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { status: 'REJECTED' },
    });
    expect(reReview.status).toBe(409);
  });
});

describe('manager-codes: generate, toggle, redeem', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('generate/list is LANDLORD-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/manager-codes', { method: 'POST', cookie });
    expect(res.status).toBe(403);
  });

  it('a landlord generates a code in the LLD-XXXX-XX shape, and can toggle it inactive', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);

    const created = await apiFetch('/api/v1/manager-codes', { method: 'POST', cookie });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toMatch(/^LLD-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
    expect(created.body.data.status).toBe('ACTIVE');

    const toggled = await apiFetch(`/api/v1/manager-codes/${created.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'DEACTIVATED' },
    });
    expect(toggled.status).toBe(200);
    expect(toggled.body.data.status).toBe('DEACTIVATED');
  });

  it("a different landlord cannot toggle someone else's code", async () => {
    const owner = await createUser(Role.LANDLORD);
    const intruder = await createUser(Role.LANDLORD);
    const created = await apiFetch('/api/v1/manager-codes', {
      method: 'POST',
      cookie: await authCookie(owner.id, owner.role),
    });

    const res = await apiFetch(`/api/v1/manager-codes/${created.body.data.id}`, {
      method: 'PATCH',
      cookie: await authCookie(intruder.id, intruder.role),
      body: { status: 'DEACTIVATED' },
    });
    expect(res.status).toBe(403);
  });

  it('check is unauthenticated, case-insensitive, and never reveals a used/inactive code as valid', async () => {
    const landlord = await createUser(Role.LANDLORD);
    await createProperty({ landlordId: landlord.id });
    await createProperty({ landlordId: landlord.id });
    const created = await apiFetch('/api/v1/manager-codes', {
      method: 'POST',
      cookie: await authCookie(landlord.id, landlord.role),
    });
    const code = created.body.data.code;

    const missing = await apiFetch(`/api/v1/manager-codes/check?code=DOES-NOT-EXIST`);
    expect(missing.body.valid).toBe(false);

    const found = await apiFetch(`/api/v1/manager-codes/check?code=${code.toLowerCase()}`);
    expect(found.body.valid).toBe(true);
    expect(found.body.landlord.name).toBe(landlord.name);
    expect(found.body.propertiesManaged).toBe(2);

    // Deactivated codes must not check out as valid either.
    await apiFetch(`/api/v1/manager-codes/${created.body.data.id}`, {
      method: 'PATCH',
      cookie: await authCookie(landlord.id, landlord.role),
      body: { status: 'DEACTIVATED' },
    });
    const afterDeactivate = await apiFetch(`/api/v1/manager-codes/check?code=${code}`);
    expect(afterDeactivate.body.valid).toBe(false);
  });

  it('redeem is MANAGER-only, links exactly once, and rejects an inactive or already-used code', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const manager1 = await createUser(Role.MANAGER);
    const manager2 = await createUser(Role.MANAGER);
    const created = await apiFetch('/api/v1/manager-codes', {
      method: 'POST',
      cookie: await authCookie(landlord.id, landlord.role),
    });
    const code = created.body.data.code;

    const tenantAttempt = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie((await createUser(Role.TENANT)).id, Role.TENANT),
      body: { code },
    });
    expect(tenantAttempt.status).toBe(403);

    const redeemed = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie(manager1.id, manager1.role),
      body: { code },
    });
    expect(redeemed.status).toBe(200);
    expect(redeemed.body.data.linkedManagerId).toBe(manager1.id);

    const secondAttempt = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie(manager2.id, manager2.role),
      body: { code },
    });
    expect(secondAttempt.status).toBe(409);
    expect(secondAttempt.body.code).toBe('CODE_USED');
  });

  it('two managers redeeming the SAME code concurrently: exactly one wins', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const created = await apiFetch('/api/v1/manager-codes', {
      method: 'POST',
      cookie: await authCookie(landlord.id, landlord.role),
    });
    const code = created.body.data.code;

    const managerA = await createUser(Role.MANAGER);
    const managerB = await createUser(Role.MANAGER);
    const [cookieA, cookieB] = await Promise.all([
      authCookie(managerA.id, managerA.role),
      authCookie(managerB.id, managerB.role),
    ]);

    // Fired together, deliberately. The old implementation read the row,
    // saw linkedManagerId === null in BOTH requests, and let both write --
    // so both callers got a 200 and the loser was silently never linked.
    const [first, second] = await Promise.all([
      apiFetch('/api/v1/manager-codes/redeem', { method: 'POST', cookie: cookieA, body: { code } }),
      apiFetch('/api/v1/manager-codes/redeem', { method: 'POST', cookie: cookieB, body: { code } }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    // And the winner is the one actually recorded -- no lost update.
    const winner = first.status === 200 ? first : second;
    const row = await testPrisma.managerInviteCode.findUnique({ where: { code } });
    expect(row?.linkedManagerId).toBe(winner.body.data.linkedManagerId);
    expect([managerA.id, managerB.id]).toContain(row?.linkedManagerId);
  });

  it('rejects redeeming a DEACTIVATED code with CODE_INACTIVE, not CODE_USED', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const landlordCookie = await authCookie(landlord.id, landlord.role);
    const created = await apiFetch('/api/v1/manager-codes', {
      method: 'POST',
      cookie: landlordCookie,
    });
    await apiFetch(`/api/v1/manager-codes/${created.body.data.id}`, {
      method: 'PATCH',
      cookie: landlordCookie,
      body: { status: 'DEACTIVATED' },
    });

    const manager = await createUser(Role.MANAGER);
    const res = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie(manager.id, manager.role),
      body: { code: created.body.data.code },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CODE_INACTIVE');
  });
});

describe('ad campaigns: create/cancel per property', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('create requires managing the property, and a second active campaign is rejected while one is running', async () => {
    const manager = await createUser(Role.MANAGER);
    const strangerManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });

    const strangerAttempt = await apiFetch(`/api/v1/properties/${property.id}/ads`, {
      method: 'POST',
      cookie: await authCookie(strangerManager.id, strangerManager.role),
      body: { budget: 50_000, durationDays: 30 },
    });
    expect(strangerAttempt.status).toBe(403);

    const cookie = await authCookie(manager.id, manager.role);
    const created = await apiFetch(`/api/v1/properties/${property.id}/ads`, {
      method: 'POST',
      cookie,
      body: { budget: 50_000, durationDays: 30 },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('ACTIVE');
    expect(created.body.data.impressions).toBe(0);
    expect(created.body.data.clicks).toBe(0);

    const conflict = await apiFetch(`/api/v1/properties/${property.id}/ads`, {
      method: 'POST',
      cookie,
      body: { budget: 25_000, durationDays: 7 },
    });
    expect(conflict.status).toBe(409);

    const active = await apiFetch(`/api/v1/properties/${property.id}/ads`, { cookie });
    expect(active.body.data.id).toBe(created.body.data.id);
  });

  it('cancel soft-cancels (status: CANCELLED), never deletes the row, and frees the property up for a new campaign', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const created = await apiFetch(`/api/v1/properties/${property.id}/ads`, {
      method: 'POST',
      cookie,
      body: { budget: 50_000, durationDays: 30 },
    });
    const adId = created.body.data.id;

    const cancelled = await apiFetch(`/api/v1/properties/${property.id}/ads/${adId}`, {
      method: 'PATCH',
      cookie,
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const stillThere = await testPrisma.adCampaign.findUnique({ where: { id: adId } });
    expect(stillThere).not.toBeNull();

    const newOne = await apiFetch(`/api/v1/properties/${property.id}/ads`, {
      method: 'POST',
      cookie,
      body: { budget: 100_000, durationDays: 14 },
    });
    expect(newOne.status).toBe(201);
  });
});
