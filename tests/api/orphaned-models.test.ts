import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('announcements (property-scoped)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a non-managing MANAGER from posting, and a stranger TENANT from reading', async () => {
    const manager = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const stranger = await createUser(Role.TENANT);

    const intruderCookie = await authCookie(intruder.id, intruder.role);
    const postAttempt = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      method: 'POST',
      cookie: intruderCookie,
      body: { title: 'x', body: 'y' },
    });
    expect(postAttempt.status).toBe(403);

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const readAttempt = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      cookie: strangerCookie,
    });
    expect(readAttempt.status).toBe(403);
  });

  it('the managing owner can post; a tenant of the property can read; pinned sorts first', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const managerCookie = await authCookie(manager.id, manager.role);

    await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      method: 'POST',
      cookie: managerCookie,
      body: { title: 'Regular', body: 'A regular notice' },
    });
    const pinned = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      method: 'POST',
      cookie: managerCookie,
      body: { title: 'Pinned', body: 'An important notice', isPinned: true },
    });
    expect(pinned.status).toBe(201);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const list = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      cookie: tenantCookie,
    });
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(2);
    expect(list.body.data[0].title).toBe('Pinned');
  });

  it('lets the managing owner edit and delete their own announcement', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);
    const created = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      method: 'POST',
      cookie,
      body: { title: 'Original', body: 'Text' },
    });

    const edited = await apiFetch(
      `/api/v1/properties/${property.id}/announcements/${created.body.data.id}`,
      {
        method: 'PATCH',
        cookie,
        body: { title: 'Edited' },
      },
    );
    expect(edited.status).toBe(200);
    expect(edited.body.data.title).toBe('Edited');

    const deleted = await apiFetch(
      `/api/v1/properties/${property.id}/announcements/${created.body.data.id}`,
      {
        method: 'DELETE',
        cookie,
      },
    );
    expect(deleted.status).toBe(200);
    const gone = await testPrisma.announcement.findUnique({ where: { id: created.body.data.id } });
    expect(gone).toBeNull();
  });
});

describe('violations (unit-scoped)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("the managing owner can report a violation; the unit's own tenant can see it; a stranger tenant cannot", async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const stranger = await createUser(Role.TENANT);
    const managerCookie = await authCookie(manager.id, manager.role);

    const created = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/violations`,
      {
        method: 'POST',
        cookie: managerCookie,
        body: { description: 'Loud party after hours', severity: 'MODERATE' },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('OPEN');

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantRead = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/violations`,
      {
        cookie: tenantCookie,
      },
    );
    expect(tenantRead.status).toBe(200);
    expect(tenantRead.body.data.length).toBe(1);

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const strangerRead = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/violations`,
      {
        cookie: strangerCookie,
      },
    );
    expect(strangerRead.status).toBe(403);
  });

  it('the managing owner can resolve a violation, stamping resolvedAt', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);
    const created = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/violations`,
      {
        method: 'POST',
        cookie,
        body: { description: 'Unauthorized pet' },
      },
    );

    const resolved = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/violations/${created.body.data.id}`,
      { method: 'PATCH', cookie, body: { status: 'RESOLVED', resolutionNote: 'Pet removed' } },
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('RESOLVED');
    expect(resolved.body.data.resolvedAt).not.toBeNull();
  });
});

describe('condition reports (unit-scoped)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('the managing owner can file a report; aiFlags is never populated (no AI integration exists)', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/condition-reports`,
      {
        method: 'POST',
        cookie,
        body: { rooms: { livingRoom: { condition: 'good' }, kitchen: { condition: 'fair' } } },
      },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.aiFlags).toBeNull();
    expect(res.body.data.rooms.livingRoom.condition).toBe('good');
  });

  it('a TENANT cannot file a report', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);

    const res = await apiFetch(
      `/api/v1/properties/${property.id}/units/${unit.id}/condition-reports`,
      {
        method: 'POST',
        cookie,
        body: { rooms: {} },
      },
    );
    expect(res.status).toBe(403);
  });
});

describe('equipment (property-wide or unit-specific)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('creates property-wide equipment when unitId is omitted, and unit-specific when provided', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const generator = await apiFetch(`/api/v1/properties/${property.id}/equipment`, {
      method: 'POST',
      cookie,
      body: { type: 'GENERATOR' },
    });
    expect(generator.status).toBe(201);
    expect(generator.body.data.propertyId).toBe(property.id);
    expect(generator.body.data.unitId).toBeNull();

    const hvac = await apiFetch(`/api/v1/properties/${property.id}/equipment`, {
      method: 'POST',
      cookie,
      body: { type: 'HVAC', unitId: unit.id, serialNumber: 'HV-001' },
    });
    expect(hvac.status).toBe(201);
    expect(hvac.body.data.unitId).toBe(unit.id);

    const list = await apiFetch(`/api/v1/properties/${property.id}/equipment`, { cookie });
    expect(list.body.data.length).toBe(2);
  });

  it('rejects a unitId that belongs to a different property', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const otherProperty = await createProperty();
    const otherUnit = await createUnit(otherProperty.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}/equipment`, {
      method: 'POST',
      cookie,
      body: { type: 'HVAC', unitId: otherUnit.id },
    });
    expect(res.status).toBe(400);
  });

  it('lets the managing owner delete equipment', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);
    const created = await apiFetch(`/api/v1/properties/${property.id}/equipment`, {
      method: 'POST',
      cookie,
      body: { type: 'ELEVATOR' },
    });

    const deleted = await apiFetch(
      `/api/v1/properties/${property.id}/equipment/${created.body.data.id}`,
      {
        method: 'DELETE',
        cookie,
      },
    );
    expect(deleted.status).toBe(200);
  });
});

describe('bank accounts (self-service, no payout automation)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a TENANT outright', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: {
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
        accountName: 'Test User',
      },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a malformed (non-10-digit) accountNumber', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const res = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: { accountNumber: '123', bankCode: '058', bankName: 'GTBank', accountName: 'Test User' },
    });
    expect(res.status).toBe(400);
  });

  it('the first account created is automatically the default; adding isDefault:true moves it', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);

    const first = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: {
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
        accountName: 'First',
      },
    });
    expect(first.body.data.isDefault).toBe(true);

    const second = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: {
        accountNumber: '0987654321',
        bankCode: '011',
        bankName: 'First Bank',
        accountName: 'Second',
        isDefault: true,
      },
    });
    expect(second.body.data.isDefault).toBe(true);

    const refetchedFirst = await testPrisma.bankAccount.findUnique({
      where: { id: first.body.data.id },
    });
    expect(refetchedFirst?.isDefault).toBe(false);

    const list = await apiFetch('/api/v1/bank-accounts', { cookie });
    expect(list.body.data.length).toBe(2);
  });

  it("only ever returns the caller's own accounts, and only they can delete/set-default them", async () => {
    const landlordA = await createUser(Role.LANDLORD);
    const landlordB = await createUser(Role.LANDLORD);
    const cookieA = await authCookie(landlordA.id, landlordA.role);
    const cookieB = await authCookie(landlordB.id, landlordB.role);

    const accountA = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie: cookieA,
      body: {
        accountNumber: '1111111111',
        bankCode: '058',
        bankName: 'GTBank',
        accountName: 'Owner A',
      },
    });

    const listB = await apiFetch('/api/v1/bank-accounts', { cookie: cookieB });
    expect(listB.body.data.length).toBe(0);

    const deleteAttempt = await apiFetch(`/api/v1/bank-accounts/${accountA.body.data.id}`, {
      method: 'DELETE',
      cookie: cookieB,
    });
    expect(deleteAttempt.status).toBe(404);
  });

  it('deleting the default account promotes the next most recent one', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);

    const first = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: {
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
        accountName: 'First',
      },
    });
    const second = await apiFetch('/api/v1/bank-accounts', {
      method: 'POST',
      cookie,
      body: {
        accountNumber: '0987654321',
        bankCode: '011',
        bankName: 'First Bank',
        accountName: 'Second',
      },
    });

    await apiFetch(`/api/v1/bank-accounts/${first.body.data.id}`, { method: 'DELETE', cookie });

    const refetchedSecond = await testPrisma.bankAccount.findUnique({
      where: { id: second.body.data.id },
    });
    expect(refetchedSecond?.isDefault).toBe(true);
  });
});
