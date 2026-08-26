import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('lease e-signature (POST /leases/[id]/sign)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a stranger tenant and a non-managing manager', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const intruder = await createUser(Role.MANAGER);
    const lease = await createLease(unit.id, tenant.id, { status: 'PENDING' });

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const strangerAttempt = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie: strangerCookie,
      body: { fullName: 'Stranger Person' },
    });
    expect(strangerAttempt.status).toBe(403);

    const intruderCookie = await authCookie(intruder.id, intruder.role);
    const intruderAttempt = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie: intruderCookie,
      body: { fullName: 'Intruder Manager' },
    });
    expect(intruderAttempt.status).toBe(403);
  });

  it('the owning tenant can sign; a second attempt by the same person 409s', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'PENDING' });
    const cookie = await authCookie(tenant.id, tenant.role);

    const first = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie,
      body: { fullName: 'John Tenant' },
    });
    expect(first.status).toBe(201);
    expect(first.body.data.signerRole).toBe('TENANT');
    expect(first.body.data.fullNameTyped).toBe('John Tenant');
    expect(first.body.data.ipAddress).not.toBeNull();

    const second = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie,
      body: { fullName: 'John Tenant' },
    });
    expect(second.status).toBe(409);
  });

  it('agreementSignedAt is only set once both a tenant-side and a landlord-side signature exist', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'PENDING' });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const managerCookie = await authCookie(manager.id, manager.role);

    await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { fullName: 'John Tenant' },
    });

    const afterTenantOnly = await testPrisma.lease.findUnique({ where: { id: lease.id } });
    expect(afterTenantOnly?.agreementSignedAt).toBeNull();

    const managerSign = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie: managerCookie,
      body: { fullName: 'Jane Manager' },
    });
    expect(managerSign.status).toBe(201);

    const afterBoth = await testPrisma.lease.findUnique({ where: { id: lease.id } });
    expect(afterBoth?.agreementSignedAt).not.toBeNull();

    const detail = await apiFetch(`/api/v1/leases/${lease.id}`, { cookie: tenantCookie });
    expect(detail.body.data.signatures.length).toBe(2);
    expect(detail.body.data.agreementSignedAt).not.toBeNull();
  });

  it('rejects a malformed body (empty fullName)', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: 'PENDING' });
    const cookie = await authCookie(tenant.id, tenant.role);

    const res = await apiFetch(`/api/v1/leases/${lease.id}/sign`, {
      method: 'POST',
      cookie,
      body: { fullName: '' },
    });
    expect(res.status).toBe(400);
  });
});
