import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  createAccessCode,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

// Findings from the 2026-10-21 security sweep (ISS-136), each pinned by a test.

describe('a tenancy that ends takes the tenant’s gate codes with it (ISS-138)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { status: 'ACTIVE' });
    // A reusable code with no end date: the kind that never expires on its own.
    const code = await createAccessCode(unit.id, tenant.id, {
      code: 'GATE1234',
      singleUse: false,
      validUntil: null,
    });
    const managerCookie = await authCookie(manager.id, manager.role);
    const verify = () =>
      apiFetch<{ data: { granted: boolean; action: string } }>('/api/v1/access-codes/verify', {
        method: 'POST',
        cookie: managerCookie,
        body: { unitId: unit.id, code: 'GATE1234' },
      });
    const patchRent = (id: string, body: Record<string, unknown>) =>
      apiFetch(`/api/v1/rents/${id}`, { method: 'PATCH', cookie: managerCookie, body });
    return { manager, tenant, unit, rent, code, verify, patchRent, managerCookie };
  }

  it('revokes the codes when the rent is terminated or expires, and the gate refuses them', async () => {
    const { rent, code, verify, patchRent } = await setup();
    expect((await verify()).body.data.granted).toBe(true);

    expect((await patchRent(rent.id, { status: 'TERMINATED' })).status).toBe(200);
    const revoked = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(revoked?.status).toBe('REVOKED');
    const after = await verify();
    expect(after.body.data.granted).toBe(false);
    expect(after.body.data.action).toBe('REVOKED');
  });

  it('keeps the codes across a renewal for the same tenant', async () => {
    const { rent, code, patchRent } = await setup();
    const res = await patchRent(rent.id, {
      renew: { startDate: '2027-01-01', endDate: '2027-12-31', rentAmount: 1_000_000, deposit: 0 },
    });
    expect(res.status).toBe(201);
    const kept = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(kept?.status).toBe('ACTIVE');
  });

  it('refuses a code whose owner no longer holds an active rent on the unit, even if nothing revoked it', async () => {
    const { rent, code, verify } = await setup();
    // A rent ended some other way (a direct database change, an old record).
    await testPrisma.rent.update({ where: { id: rent.id }, data: { status: 'EXPIRED' } });
    const res = await verify();
    expect(res.body.data.granted).toBe(false);
    const row = await testPrisma.accessCode.findUnique({ where: { id: code.id } });
    expect(row?.status).toBe('REVOKED');
  });
});

describe('concurrent requests cannot double up a tenancy (ISS-139, ISS-140)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('activating several pending rents on one unit at once leaves exactly one active', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);
    const contenders = await Promise.all(Array.from({ length: 8 }, () => createUser(Role.TENANT)));

    // A race is a matter of timing, so try it on several units.
    for (let round = 0; round < 4; round++) {
      const unit = await createUnit(property.id);
      const rents = await Promise.all(
        contenders.map((t) => createRent(unit.id, t.id, { status: 'PENDING' })),
      );
      const results = await Promise.all(
        rents.map((l) =>
          apiFetch(`/api/v1/rents/${l.id}`, {
            method: 'PATCH',
            cookie,
            body: { status: 'ACTIVE' },
          }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(contenders.length - 1);
      expect(await testPrisma.rent.count({ where: { unitId: unit.id, status: 'ACTIVE' } })).toBe(1);
    }
  });

  it('starting a tenancy from one approved application twice at once makes one rent', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const application = await testPrisma.application.create({
      data: { unitId: unit.id, applicantId: tenant.id, status: 'APPROVED', details: {} },
    });
    const cookie = await authCookie(manager.id, manager.role);
    const body = {
      unitId: unit.id,
      applicationId: application.id,
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      rentAmount: 1_200_000,
      deposit: 0,
    };

    const results = await Promise.all(
      [1, 2, 3].map(() => apiFetch('/api/v1/rents', { method: 'POST', cookie, body })),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await testPrisma.rent.count({ where: { unitId: unit.id } })).toBe(1);
    expect(await testPrisma.invoice.count({ where: { rent: { unitId: unit.id } } })).toBe(1);
  });
});
