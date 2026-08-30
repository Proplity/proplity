import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createAccessCode,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('access-codes: list (GET ?unitId=)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires unitId, 404s for an unknown unit', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);

    const missing = await apiFetch('/api/v1/access-codes', { cookie });
    expect(missing.status).toBe(400);

    const unknown = await apiFetch('/api/v1/access-codes?unitId=does-not-exist', { cookie });
    expect(unknown.status).toBe(404);
  });

  it("allows the managing owner and the unit's active tenant; forbids an unrelated tenant", async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const stranger = await createUser(Role.TENANT);

    for (const user of [manager, tenant]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/access-codes?unitId=${unit.id}`, { cookie });
      expect(res.status).toBe(200);
    }

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch(`/api/v1/access-codes?unitId=${unit.id}`, {
      cookie: strangerCookie,
    });
    expect(forbidden.status).toBe(403);
  });
});

describe('access-codes: create (POST) -- TENANT only', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a non-tenant caller', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/access-codes', {
      method: 'POST',
      cookie,
      body: { unitId: 'x', code: '1234', validFrom: new Date().toISOString() },
    });
    expect(res.status).toBe(403);
  });

  it('requires an ACTIVE lease on the unit', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);

    const res = await apiFetch('/api/v1/access-codes', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: '1234', validFrom: new Date().toISOString() },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a duplicate ACTIVE code for the same unit, but allows the same code on a different unit', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const otherUnit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const otherTenant = await createUser(Role.TENANT);
    await createLease(otherUnit.id, otherTenant.id);

    const cookie = await authCookie(tenant.id, tenant.role);
    const first = await apiFetch('/api/v1/access-codes', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: '5678', validFrom: new Date().toISOString() },
    });
    expect(first.status).toBe(201);

    const conflict = await apiFetch('/api/v1/access-codes', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: '5678', validFrom: new Date().toISOString() },
    });
    expect(conflict.status).toBe(409);

    const otherCookie = await authCookie(otherTenant.id, otherTenant.role);
    const otherUnitOk = await apiFetch('/api/v1/access-codes', {
      method: 'POST',
      cookie: otherCookie,
      body: { unitId: otherUnit.id, code: '5678', validFrom: new Date().toISOString() },
    });
    expect(otherUnitOk.status).toBe(201);
  });
});

describe('access-codes: [id] GET / DELETE (rule 1 -- soft-revoke only)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('allows the creator and the managing owner to view; forbids a stranger', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const stranger = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id);

    for (const user of [manager, tenant]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/access-codes/${code.id}`, { cookie });
      expect(res.status).toBe(200);
    }

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch(`/api/v1/access-codes/${code.id}`, { cookie: strangerCookie });
    expect(forbidden.status).toBe(403);
  });

  it('DELETE soft-revokes (status REVOKED, revokedAt set) and never deletes the row or its AccessLog history', async () => {
    const admin = await createUser(Role.ADMIN);
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const code = await createAccessCode(unit.id, tenant.id);

    // Give the code a real audit-trail row first, via the actual verify
    // endpoint (not a raw fixture insert), so the assertion below is about
    // real, route-produced data surviving the revoke.
    const adminCookie = await authCookie(admin.id, admin.role);
    await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie: adminCookie,
      body: { unitId: unit.id, code: code.code },
    });
    const logCountBefore = await testPrisma.accessLog.count({ where: { accessCodeId: code.id } });
    expect(logCountBefore).toBeGreaterThan(0);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch(`/api/v1/access-codes/${code.id}`, {
      method: 'DELETE',
      cookie: tenantCookie,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REVOKED');
    expect(res.body.data.revokedAt).not.toBeNull();

    const stillThere = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(stillThere).not.toBeNull();

    const logCountAfter = await testPrisma.accessLog.count({ where: { accessCodeId: code.id } });
    expect(logCountAfter).toBe(logCountBefore);
  });
});

describe('access-codes: verify (gate-side, ADMIN/MANAGER only)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a non-staff caller', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: 'x', code: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it("forbids a MANAGER from verifying a code on a property they don't manage, without consuming it", async () => {
    const owner = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: owner.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const code = await createAccessCode(unit.id, tenant.id);

    const stranger = await createUser(Role.MANAGER);
    const cookie = await authCookie(stranger.id, stranger.role);

    const logsBefore = await testPrisma.accessLog.count({ where: { accessCodeId: code.id } });
    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.status).toBe(403);

    // The two side effects that made this more than an information leak: a
    // single-use code must not be burned, and nothing may be written to the
    // tenant's access audit trail by a manager with no claim on the unit.
    const after = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(after?.status).toBe('ACTIVE');
    const logsAfter = await testPrisma.accessLog.count({ where: { accessCodeId: code.id } });
    expect(logsAfter).toBe(logsBefore);
  });

  it("still allows the property's own MANAGER to verify", async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const code = await createAccessCode(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.granted).toBe(true);
  });

  it('404s a unit that does not exist', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: 'no-such-unit', code: 'abcd' },
    });
    expect(res.status).toBe(404);
  });

  it("rejects a code shorter than the create route's own min(4) floor", async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: 'ab' },
    });
    expect(res.status).toBe(400);
  });

  it('reports NOT_FOUND for a code that does not exist, logging nothing (no accessCodeId to attach to)', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const logCountBefore = await testPrisma.accessLog.count();
    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: 'never-existed' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ granted: false, reason: 'NOT_FOUND' });
    const logCountAfter = await testPrisma.accessLog.count();
    expect(logCountAfter).toBe(logCountBefore);
  });

  it('grants a currently-valid ACTIVE code and logs GRANTED', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, { guestName: 'A Guest' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.granted).toBe(true);
    expect(res.body.data.action).toBe('GRANTED');
    expect(res.body.data.guestName).toBe('A Guest');

    const log = await testPrisma.accessLog.findUnique({ where: { id: res.body.data.logId } });
    expect(log?.action).toBe('GRANTED');
  });

  it('denies a REVOKED code and logs REVOKED', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, { status: 'REVOKED' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.body.data.granted).toBe(false);
    expect(res.body.data.action).toBe('REVOKED');
  });

  it('denies a code past its validUntil and logs EXPIRED_ATTEMPT', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, {
      validFrom: new Date(Date.now() - 2 * 86400000),
      validUntil: new Date(Date.now() - 86400000),
    });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.body.data.granted).toBe(false);
    expect(res.body.data.action).toBe('EXPIRED_ATTEMPT');
  });

  it('denies a code whose validFrom is still in the future, logging DENIED', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, {
      validFrom: new Date(Date.now() + 86400000),
    });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(res.body.data.granted).toBe(false);
    expect(res.body.data.action).toBe('DENIED');
  });

  it('a single-use code (the default) auto-transitions to USED on its first grant, then is denied on reuse', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, { singleUse: true });
    const cookie = await authCookie(manager.id, manager.role);

    const first = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(first.body.data.granted).toBe(true);
    expect(first.body.data.action).toBe('GRANTED');

    const refetched = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(refetched?.status).toBe('USED');

    const second = await apiFetch('/api/v1/access-codes/verify', {
      method: 'POST',
      cookie,
      body: { unitId: unit.id, code: code.code },
    });
    expect(second.body.data.granted).toBe(false);
    expect(second.body.data.action).toBe('DENIED');
  });

  it('a reusable (singleUse: false) code stays ACTIVE and can be granted repeatedly', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const code = await createAccessCode(unit.id, tenant.id, { singleUse: false });
    const cookie = await authCookie(manager.id, manager.role);

    for (let i = 0; i < 2; i++) {
      const res = await apiFetch('/api/v1/access-codes/verify', {
        method: 'POST',
        cookie,
        body: { unitId: unit.id, code: code.code },
      });
      expect(res.body.data.granted).toBe(true);
      expect(res.body.data.action).toBe('GRANTED');
    }

    const refetched = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(refetched?.status).toBe('ACTIVE');
  });
});
