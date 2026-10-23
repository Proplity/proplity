import crypto from 'crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  seedPlans,
  setSystemSettings,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { CreditError, spendCredits } from '../../lib/credits';

// Owner decisions of 2026-10-23: plans, limits and credits are edited by an admin, and each rule
// is an admin setting.

let n = 0;
const planKey = () => `plan-${++n}-${Math.random().toString(36).slice(2, 6)}`;

async function makePlan(
  overrides: Partial<{
    monthlyPrice: number;
    yearlyPrice: number | null;
    unitsIncluded: number;
    overagePerUnit: number | null;
    monthlyCredits: number;
    isActive: boolean;
    isDefault: boolean;
  }> = {},
) {
  const key = planKey();
  return testPrisma.plan.create({
    data: {
      key,
      name: key,
      monthlyPrice: overrides.monthlyPrice ?? 1000,
      yearlyPrice: overrides.yearlyPrice === undefined ? 10_000 : overrides.yearlyPrice,
      unitsIncluded: overrides.unitsIncluded ?? 1,
      overagePerUnit: overrides.overagePerUnit === undefined ? 100 : overrides.overagePerUnit,
      monthlyCredits: overrides.monthlyCredits ?? 0,
      isActive: overrides.isActive ?? true,
      isDefault: overrides.isDefault ?? false,
      sortOrder: 50,
    },
  });
}

async function subscribe(userId: string, planId: string, extra: Record<string, unknown> = {}) {
  return testPrisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      ...extra,
    },
    update: { planId, status: 'ACTIVE', ...extra },
  });
}

const addUnit = (cookie: string, propertyId: string, unitNumber: string, extra = {}) =>
  apiFetch(`/api/v1/properties/${propertyId}/units`, {
    method: 'POST',
    cookie,
    body: { unitNumber, bedrooms: 1, bathrooms: 1, rentAmount: 500_000, ...extra },
  });

describe('plans: the public list and the admin editor', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('shows the three starting plans to anyone, free one first', async () => {
    const res = await apiFetch<{ data: { key: string; isDefault: boolean }[] }>('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.key)).toEqual(['small', 'medium', 'large']);
    expect(res.body.data[0].isDefault).toBe(true);
  });

  it('lets only an admin change plans, and records who did', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const list = await apiFetch<{ data: { id: string; key: string }[] }>('/api/v1/admin/plans', {
      cookie: await authCookie(admin.id, admin.role),
    });
    const medium = list.body.data.find((p) => p.key === 'medium')!;

    const asManager = await apiFetch(`/api/v1/admin/plans/${medium.id}`, {
      method: 'PATCH',
      cookie: await authCookie(manager.id, manager.role),
      body: { monthlyPrice: 1 },
    });
    expect(asManager.status).toBe(403);

    const asAdmin = await apiFetch(`/api/v1/admin/plans/${medium.id}`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { monthlyPrice: 35_000, unitsIncluded: 60 },
    });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.monthlyPrice).toBe(35_000);
    const log = await testPrisma.auditLog.findFirst({
      where: { action: 'PLAN_UPDATED', actorId: admin.id },
    });
    expect(JSON.stringify(log?.metadata)).toContain('monthlyPrice');
    // The public list now shows the new numbers.
    const pub = await apiFetch<{ data: { key: string; unitsIncluded: number }[] }>('/api/v1/plans');
    expect(pub.body.data.find((p) => p.key === 'medium')?.unitsIncluded).toBe(60);
  });

  it('creates a plan, refuses a changed key, bad numbers and a priced default', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const created = await apiFetch('/api/v1/admin/plans', {
      method: 'POST',
      cookie,
      body: { key: 'agency', name: 'Agency', monthlyPrice: 80_000, unitsIncluded: 300 },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect(
      (await apiFetch(`/api/v1/admin/plans/${id}`, { method: 'PATCH', cookie, body: { key: 'x' } }))
        .status,
    ).toBe(400);
    expect(
      (
        await apiFetch(`/api/v1/admin/plans/${id}`, {
          method: 'PATCH',
          cookie,
          body: { monthlyPrice: -5 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apiFetch('/api/v1/admin/plans', {
          method: 'POST',
          cookie,
          body: { key: 'Bad Key', name: 'x', monthlyPrice: 0, unitsIncluded: 1 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apiFetch(`/api/v1/admin/plans/${id}`, {
          method: 'PATCH',
          cookie,
          body: { isDefault: true },
        })
      ).status,
    ).toBe(400);
  });

  it('keeps exactly one default and never lets it be deleted, switched off or unset', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const plans = (
      await apiFetch<{ data: { id: string; key: string; isDefault: boolean }[] }>(
        '/api/v1/admin/plans',
        { cookie },
      )
    ).body.data;
    const small = plans.find((p) => p.key === 'small')!;
    expect(
      (await apiFetch(`/api/v1/admin/plans/${small.id}`, { method: 'DELETE', cookie })).status,
    ).toBe(409);
    expect(
      (
        await apiFetch(`/api/v1/admin/plans/${small.id}`, {
          method: 'PATCH',
          cookie,
          body: { isActive: false },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apiFetch(`/api/v1/admin/plans/${small.id}`, {
          method: 'PATCH',
          cookie,
          body: { isDefault: false },
        })
      ).status,
    ).toBe(400);

    // Another free plan can take over the default.
    const trial = await apiFetch('/api/v1/admin/plans', {
      method: 'POST',
      cookie,
      body: { key: 'trial', name: 'Trial', monthlyPrice: 0, unitsIncluded: 5, isDefault: true },
    });
    expect(trial.status).toBe(201);
    expect(await testPrisma.plan.count({ where: { isDefault: true } })).toBe(1);
    expect((await testPrisma.plan.findUnique({ where: { key: 'small' } }))?.isDefault).toBe(false);
  });

  it('will not delete a plan accounts are on, and a switched-off plan stays with its subscribers', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const owner = await createUser(Role.LANDLORD);
    const plan = await makePlan();
    await subscribe(owner.id, plan.id);

    const del = await apiFetch(`/api/v1/admin/plans/${plan.id}`, { method: 'DELETE', cookie });
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('PLAN_IN_USE');

    await apiFetch(`/api/v1/admin/plans/${plan.id}`, {
      method: 'PATCH',
      cookie,
      body: { isActive: false },
    });
    const pub = await apiFetch<{ data: { key: string }[] }>('/api/v1/plans');
    expect(pub.body.data.some((p) => p.key === plan.key)).toBe(false);
    const me = await apiFetch('/api/v1/subscriptions/me', {
      cookie: await authCookie(owner.id, owner.role),
    });
    expect(me.body.data.plan.key).toBe(plan.key);

    const buy = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie: await authCookie(owner.id, owner.role),
      body: { planKey: plan.key },
    });
    expect(buy.status).toBe(404);
  });
});

describe('credits and the paid-services catalogue', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });

  it('adds the monthly allowance once a month, not on every look', async () => {
    const plan = await makePlan({ monthlyCredits: 12 });
    const manager = await createUser(Role.MANAGER);
    await subscribe(manager.id, plan.id);
    const cookie = await authCookie(manager.id, manager.role);
    const first = await apiFetch('/api/v1/credits/me', { cookie });
    expect(first.body.data.balance).toBe(12);
    const again = await apiFetch('/api/v1/credits/me', { cookie });
    expect(again.body.data.balance).toBe(12);
    expect(
      await testPrisma.creditEntry.count({
        where: { userId: manager.id, reason: 'MONTHLY_ALLOWANCE' },
      }),
    ).toBe(1);
  });

  it('gives a plan with no monthly credits a balance of 0', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const res = await apiFetch('/api/v1/credits/me', {
      cookie: await authCookie(landlord.id, landlord.role),
    });
    expect(res.body.data.balance).toBe(0);
  });

  it('lets an admin grant credits, or take some back but never below 0', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER, { email: 'credit-me@test.local' });
    const cookie = await authCookie(admin.id, admin.role);
    const grant = (amount: number) =>
      apiFetch('/api/v1/admin/credits', {
        method: 'POST',
        cookie,
        body: { email: 'credit-me@test.local', amount, note: 'goodwill' },
      });
    const ok = await grant(10);
    expect(ok.status).toBe(200);
    expect(ok.body.data.balance).toBe(10);
    expect((await grant(-4)).body.data.balance).toBe(6);
    expect((await grant(-7)).status).toBe(400);
    expect((await grant(0)).status).toBe(400);
    expect(
      (
        await apiFetch('/api/v1/admin/credits', {
          method: 'POST',
          cookie: await authCookie(manager.id, manager.role),
          body: { email: 'credit-me@test.local', amount: 5 },
        })
      ).status,
    ).toBe(403);
    const unknown = await apiFetch('/api/v1/admin/credits', {
      method: 'POST',
      cookie,
      body: { email: 'nobody@test.local', amount: 5 },
    });
    expect(unknown.status).toBe(404);
    expect(await testPrisma.auditLog.count({ where: { action: 'CREDITS_GRANTED' } })).toBe(2);
  });

  it('spends credits at the price the admin set, and refuses when there are too few', async () => {
    const manager = await createUser(Role.MANAGER);
    await testPrisma.creditEntry.create({
      data: { userId: manager.id, delta: 3, reason: 'ADMIN_GRANT' },
    });
    const entry = await spendCredits(manager.id, 'rent_agreement');
    expect(entry.delta).toBe(-1);
    await testPrisma.paidService.update({
      where: { key: 'rent_agreement' },
      data: { creditCost: 5 },
    });
    await expect(spendCredits(manager.id, 'rent_agreement')).rejects.toBeInstanceOf(CreditError);
    await expect(spendCredits(manager.id, 'no-such-service')).rejects.toMatchObject({
      code: 'UNKNOWN_SERVICE',
    });
    await testPrisma.paidService.update({
      where: { key: 'rent_agreement' },
      data: { creditCost: 1, isActive: false },
    });
    await expect(spendCredits(manager.id, 'rent_agreement')).rejects.toMatchObject({
      code: 'UNKNOWN_SERVICE',
    });
  });

  it('does not let two spends at once use the same credit', async () => {
    const manager = await createUser(Role.MANAGER);
    await testPrisma.paidService.update({
      where: { key: 'rent_agreement' },
      data: { isActive: true },
    });
    await testPrisma.creditEntry.create({
      data: { userId: manager.id, delta: 1, reason: 'ADMIN_GRANT' },
    });
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map(() => spendCredits(manager.id, 'rent_agreement')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const sum = await testPrisma.creditEntry.aggregate({
      where: { userId: manager.id },
      _sum: { delta: true },
    });
    expect(sum._sum.delta).toBe(0);
  });

  it('lists the catalogue for managers with only what is switched on, and lets an admin add to it', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const adminCookie = await authCookie(admin.id, admin.role);
    const created = await apiFetch('/api/v1/admin/services', {
      method: 'POST',
      cookie: adminCookie,
      body: { key: 'id_check', name: 'Tenant ID check', creditCost: 2 },
    });
    expect(created.status).toBe(201);
    await apiFetch(`/api/v1/admin/services/${created.body.data.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { isActive: false },
    });
    const list = await apiFetch<{ data: { key: string }[] }>('/api/v1/services', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(list.body.data.map((s) => s.key)).toContain('rent_agreement');
    expect(list.body.data.map((s) => s.key)).not.toContain('id_check');
    const tenant = await createUser(Role.TENANT);
    expect(
      (await apiFetch('/api/v1/services', { cookie: await authCookie(tenant.id, tenant.role) }))
        .status,
    ).toBe(403);
  });
});

describe('unit limits follow the plan and the admin rules', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: true,
      unitBillingOwner: 'MANAGER_ELSE_LANDLORD',
      overageMode: 'ALLOW_AND_BILL',
      downgradeRule: 'BLOCK',
      downgradeGraceDays: 30,
    });
  });

  async function setup(plan?: { id: string }) {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, createdById: manager.id });
    if (plan) await subscribe(manager.id, plan.id);
    return { manager, property, cookie: await authCookie(manager.id, manager.role) };
  }

  it('does not limit anything while limits are switched off', async () => {
    await setSystemSettings({ id: 'global', enforcePlanLimits: false });
    const s = await setup();
    for (const u of ['A1', 'A2', 'A3', 'A4']) {
      expect((await addUnit(s.cookie, s.property.id, u)).status).toBe(201);
    }
  });

  it('stops a free account at its included units and says which plan it is', async () => {
    await seedPlans();
    const s = await setup();
    expect((await addUnit(s.cookie, s.property.id, 'A1')).status).toBe(201);
    expect((await addUnit(s.cookie, s.property.id, 'A2')).status).toBe(201);
    const third = await addUnit(s.cookie, s.property.id, 'A3');
    expect(third.status).toBe(403);
    expect(third.body.code).toBe('PLAN_LIMIT');
    expect(third.body.error).toContain('Small');
    expect(await testPrisma.unit.count({ where: { propertyId: s.property.id } })).toBe(2);
  });

  it('lets a plan with an overage price go over and shows the extra on the usage meter', async () => {
    const plan = await makePlan({ unitsIncluded: 1, overagePerUnit: 150 });
    const s = await setup(plan);
    expect((await addUnit(s.cookie, s.property.id, 'A1')).status).toBe(201);
    expect((await addUnit(s.cookie, s.property.id, 'A2')).status).toBe(201);
    expect((await addUnit(s.cookie, s.property.id, 'A3')).status).toBe(201);
    const me = await apiFetch('/api/v1/subscriptions/me', { cookie: s.cookie });
    expect(me.body.data.usage).toMatchObject({
      units: 3,
      unitsIncluded: 1,
      extraUnits: 2,
      overageMonthly: 300,
    });
  });

  it('stops at the included units when the rule is to stop', async () => {
    await setSystemSettings({ id: 'global', overageMode: 'HARD_STOP' });
    const plan = await makePlan({ unitsIncluded: 1, overagePerUnit: 150 });
    const s = await setup(plan);
    expect((await addUnit(s.cookie, s.property.id, 'A1')).status).toBe(201);
    const second = await addUnit(s.cookie, s.property.id, 'A2');
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('PLAN_LIMIT');
  });

  it('asks for confirmation each time when that is the rule, with the cost', async () => {
    await setSystemSettings({ id: 'global', overageMode: 'CONFIRM_EACH_TIME' });
    const plan = await makePlan({ unitsIncluded: 1, overagePerUnit: 150 });
    const s = await setup(plan);
    expect((await addUnit(s.cookie, s.property.id, 'A1')).status).toBe(201);
    const asked = await addUnit(s.cookie, s.property.id, 'A2');
    expect(asked.status).toBe(409);
    expect(asked.body.code).toBe('OVERAGE_NEEDS_CONFIRMATION');
    expect(asked.body.monthlyCost).toBe(150);
    expect(asked.body.extraUnits).toBe(1);
    expect(await testPrisma.unit.count({ where: { propertyId: s.property.id } })).toBe(1);
    expect((await addUnit(s.cookie, s.property.id, 'A2', { confirmOverage: true })).status).toBe(
      201,
    );
  });

  it('does not limit an admin, and does not limit during a grace period', async () => {
    await seedPlans();
    const s = await setup();
    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    for (const u of ['A1', 'A2', 'A3']) {
      expect((await addUnit(adminCookie, s.property.id, u)).status).toBe(201);
    }
    // Now over the free plan: refused, until a grace period is open.
    expect((await addUnit(s.cookie, s.property.id, 'B1')).status).toBe(403);
    const plans = await seedPlans();
    await subscribe(s.manager.id, plans.small.id, {
      graceEndsAt: new Date(Date.now() + 5 * 86_400_000),
    });
    expect((await addUnit(s.cookie, s.property.id, 'B1')).status).toBe(201);
    await testPrisma.subscription.update({
      where: { userId: s.manager.id },
      data: { graceEndsAt: new Date(Date.now() - 1000) },
    });
    expect((await addUnit(s.cookie, s.property.id, 'B2')).status).toBe(403);
  });

  it('counts a burst of simultaneous additions against the limit', async () => {
    const plan = await makePlan({ unitsIncluded: 3, overagePerUnit: null });
    const s = await setup(plan);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => addUnit(s.cookie, s.property.id, `Z${i}`)),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 403)).toHaveLength(5);
    expect(await testPrisma.unit.count({ where: { propertyId: s.property.id } })).toBe(3);
  });

  it('puts a lapsed paid plan back on the default plan', async () => {
    const plan = await makePlan({ unitsIncluded: 10 });
    const s = await setup();
    await subscribe(s.manager.id, plan.id, { currentPeriodEnd: new Date(Date.now() - 1000) });
    const me = await apiFetch('/api/v1/subscriptions/me', { cookie: s.cookie });
    expect(me.body.data.lapsed).toBe(true);
    expect(me.body.data.plan.key).toBe('small');
  });

  describe('whose plan the units count against', () => {
    it('counts a managed property against the manager, not the landlord, by default', async () => {
      await seedPlans();
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
      await createUnit(property.id);
      await createUnit(property.id);
      const managerMe = await apiFetch('/api/v1/subscriptions/me', {
        cookie: await authCookie(manager.id, manager.role),
      });
      const landlordMe = await apiFetch('/api/v1/subscriptions/me', {
        cookie: await authCookie(landlord.id, landlord.role),
      });
      expect(managerMe.body.data.usage.units).toBe(2);
      expect(landlordMe.body.data.usage.units).toBe(0);
    });

    it('counts a property with no manager against the landlord', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const property = await createProperty({ landlordId: landlord.id });
      await createUnit(property.id);
      const me = await apiFetch('/api/v1/subscriptions/me', {
        cookie: await authCookie(landlord.id, landlord.role),
      });
      expect(me.body.data.usage.units).toBe(1);
    });

    it('counts against whoever added the property when that is the rule', async () => {
      await setSystemSettings({ id: 'global', unitBillingOwner: 'CREATOR' });
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const property = await createProperty({
        managerId: manager.id,
        landlordId: landlord.id,
        createdById: landlord.id,
      });
      await createUnit(property.id);
      const landlordMe = await apiFetch('/api/v1/subscriptions/me', {
        cookie: await authCookie(landlord.id, landlord.role),
      });
      const managerMe = await apiFetch('/api/v1/subscriptions/me', {
        cookie: await authCookie(manager.id, manager.role),
      });
      expect(landlordMe.body.data.usage.units).toBe(1);
      expect(managerMe.body.data.usage.units).toBe(0);
    });

    it('records who added a property', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const res = await apiFetch('/api/v1/properties', {
        method: 'POST',
        cookie: await authCookie(landlord.id, landlord.role),
        body: { name: 'Mine', address: '1 Road', city: 'Lagos' },
      });
      expect(res.status).toBe(201);
      const row = await testPrisma.property.findUnique({ where: { id: res.body.data.id } });
      expect(row?.createdById).toBe(landlord.id);
    });

    it('holds both accounts to their plans when the rule is both', async () => {
      await setSystemSettings({ id: 'global', unitBillingOwner: 'BOTH', overageMode: 'HARD_STOP' });
      const plans = await seedPlans();
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const big = await makePlan({ unitsIncluded: 100, overagePerUnit: null });
      await subscribe(manager.id, big.id);
      const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
      await subscribe(landlord.id, plans.small.id);
      await createUnit(property.id);
      await createUnit(property.id);
      // The manager has room, the landlord is full at 2.
      const res = await addUnit(await authCookie(manager.id, manager.role), property.id, 'N3');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLAN_LIMIT');
    });
  });

  describe('importing units from a file', () => {
    const importFile = (
      cookie: string,
      propertyId: string,
      rows: string[],
      extra?: [string, string],
    ) => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([`unitNumber,rentAmount\n${rows.map((r) => `${r},400000`).join('\n')}\n`], {
          type: 'text/csv',
        }),
        'units.csv',
      );
      if (extra) form.append(extra[0], extra[1]);
      return apiFetch(`/api/v1/properties/${propertyId}/units/import`, {
        method: 'POST',
        cookie,
        body: form,
      });
    };

    it('adds the whole file or none of it when the file would pass the limit', async () => {
      await seedPlans();
      const s = await setup();
      const tooMany = await importFile(s.cookie, s.property.id, ['U1', 'U2', 'U3']);
      expect(tooMany.status).toBe(403);
      expect(tooMany.body.code).toBe('PLAN_LIMIT');
      expect(await testPrisma.unit.count({ where: { propertyId: s.property.id } })).toBe(0);

      const fits = await importFile(s.cookie, s.property.id, ['U1', 'U2']);
      expect(fits.status).toBe(201);
      expect(fits.body.data.created).toBe(2);
      const more = await importFile(s.cookie, s.property.id, ['U3']);
      expect(more.status).toBe(403);
    }, 90_000); // the import route is compiled on first use, which is slow on a busy machine

    it('still reports bad and duplicate rows without counting them', async () => {
      const plan = await makePlan({ unitsIncluded: 3, overagePerUnit: null });
      const s = await setup(plan);
      await createUnit(s.property.id, { unitNumber: 'U1' });
      const res = await importFile(s.cookie, s.property.id, ['U1', 'U2', 'U2', 'U3']);
      expect(res.status).toBe(201);
      expect(res.body.data.created).toBe(2);
      expect(res.body.data.errors).toHaveLength(2);
    });
  });
});

describe('checkout works out the price and applies the downgrade rule', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: true,
      unitBillingOwner: 'MANAGER_ELSE_LANDLORD',
      downgradeRule: 'BLOCK',
      downgradeGraceDays: 30,
    });
  });

  const checkout = (cookie: string, planKey: string, billingCycle?: 'monthly' | 'yearly') =>
    apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { planKey, ...(billingCycle ? { billingCycle } : {}) },
    });

  async function ownerWithUnits(count: number) {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    for (let i = 0; i < count; i++) await createUnit(property.id);
    return { manager, cookie: await authCookie(manager.id, manager.role) };
  }

  it('adds the extra units to the plan price, by the month or the year', async () => {
    const plan = await makePlan({
      monthlyPrice: 1000,
      yearlyPrice: 10_000,
      unitsIncluded: 2,
      overagePerUnit: 100,
    });
    const o = await ownerWithUnits(5);
    const monthly = await checkout(o.cookie, plan.key, 'monthly');
    expect(monthly.status).toBe(201);
    expect(monthly.body.data.amount).toBe(1000 + 3 * 100);
    expect(monthly.body.data.breakdown).toMatchObject({ base: 1000, overage: 300, extraUnits: 3 });
    const yearly = await checkout(o.cookie, plan.key, 'yearly');
    expect(yearly.body.data.amount).toBe(10_000 + 3 * 100 * 12);
  });

  it('refuses a yearly payment on a plan with no yearly price', async () => {
    const plan = await makePlan({ yearlyPrice: null });
    const o = await ownerWithUnits(0);
    expect((await checkout(o.cookie, plan.key, 'yearly')).status).toBe(400);
  });

  const payInvoice = async (invoiceId: string, amount: number) => {
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: `sub-ref-${invoiceId}`,
        amount: amount * 100,
        channel: 'card',
        paid_at: new Date().toISOString(),
        metadata: { invoiceId },
      },
    });
    const signature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');
    return apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      rawBody,
    });
  };

  it('blocks a move to a plan with fewer units than they have, when that is the rule', async () => {
    const big = await makePlan({ unitsIncluded: 10, overagePerUnit: null });
    const small = await makePlan({ unitsIncluded: 1, overagePerUnit: null, monthlyPrice: 500 });
    const o = await ownerWithUnits(3);
    await subscribe(o.manager.id, big.id);
    const res = await checkout(o.cookie, small.key);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOWNGRADE_BLOCKED');
    expect(res.body.error).toContain('2 unit(s) over its 1');
    expect(await testPrisma.invoice.count({ where: { userId: o.manager.id } })).toBe(0);
  });

  it('lets the move through when limits are switched off', async () => {
    await setSystemSettings({ id: 'global', enforcePlanLimits: false });
    const big = await makePlan({ unitsIncluded: 10, overagePerUnit: null });
    const small = await makePlan({ unitsIncluded: 1, overagePerUnit: null, monthlyPrice: 500 });
    const o = await ownerWithUnits(3);
    await subscribe(o.manager.id, big.id);
    expect((await checkout(o.cookie, small.key)).status).toBe(201);
  });

  it('opens a grace period after the payment when that is the rule', async () => {
    await setSystemSettings({
      id: 'global',
      downgradeRule: 'GRACE_PERIOD',
      downgradeGraceDays: 14,
    });
    const big = await makePlan({ unitsIncluded: 10, overagePerUnit: null });
    const small = await makePlan({ unitsIncluded: 1, overagePerUnit: null, monthlyPrice: 500 });
    const o = await ownerWithUnits(3);
    await subscribe(o.manager.id, big.id);
    const res = await checkout(o.cookie, small.key);
    expect(res.status).toBe(201);
    expect((await payInvoice(res.body.data.invoiceId, res.body.data.amount)).status).toBe(200);
    const row = await testPrisma.subscription.findUnique({ where: { userId: o.manager.id } });
    expect(row?.planId).toBe(small.id);
    const days = (row!.graceEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13);
    expect(days).toBeLessThan(15);
  });

  it('moves them at once and bills the extra units when that is the rule', async () => {
    await setSystemSettings({ id: 'global', downgradeRule: 'ALLOW_AND_BILL' });
    const big = await makePlan({ unitsIncluded: 10, overagePerUnit: null });
    const small = await makePlan({ unitsIncluded: 1, overagePerUnit: 100, monthlyPrice: 500 });
    const o = await ownerWithUnits(3);
    await subscribe(o.manager.id, big.id);
    const res = await checkout(o.cookie, small.key);
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(500 + 2 * 100);
    await payInvoice(res.body.data.invoiceId, res.body.data.amount);
    const row = await testPrisma.subscription.findUnique({ where: { userId: o.manager.id } });
    expect(row?.planId).toBe(small.id);
    expect(row?.graceEndsAt).toBeNull();
  });

  it('refuses to schedule a switch to the free plan while they hold more than it includes', async () => {
    await seedPlans();
    const big = await makePlan({ unitsIncluded: 10, overagePerUnit: null });
    const o = await ownerWithUnits(4);
    await subscribe(o.manager.id, big.id);
    const res = await checkout(o.cookie, 'small');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOWNGRADE_BLOCKED');
  });
});

describe('plan and billing settings', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });

  it('starts with the owner-chosen defaults', async () => {
    const admin = await createUser(Role.ADMIN);
    const res = await apiFetch('/api/v1/admin/settings', {
      cookie: await authCookie(admin.id, admin.role),
    });
    expect(res.body.data).toMatchObject({
      enforcePlanLimits: false,
      unitBillingOwner: 'MANAGER_ELSE_LANDLORD',
      overageMode: 'ALLOW_AND_BILL',
      downgradeRule: 'BLOCK',
      downgradeGraceDays: 30,
    });
  });

  it('lets an admin change each one, refuses bad values and everyone else, and records it', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const patch = (body: Record<string, unknown>) =>
      apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie, body });
    const ok = await patch({
      enforcePlanLimits: true,
      unitBillingOwner: 'BOTH',
      overageMode: 'CONFIRM_EACH_TIME',
      downgradeRule: 'GRACE_PERIOD',
      downgradeGraceDays: 45,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      enforcePlanLimits: true,
      unitBillingOwner: 'BOTH',
      overageMode: 'CONFIRM_EACH_TIME',
      downgradeRule: 'GRACE_PERIOD',
      downgradeGraceDays: 45,
    });
    expect((await patch({ unitBillingOwner: 'EVERYONE' })).status).toBe(400);
    expect((await patch({ overageMode: 'NEVER' })).status).toBe(400);
    expect((await patch({ downgradeGraceDays: 0 })).status).toBe(400);
    expect((await patch({ downgradeGraceDays: 400 })).status).toBe(400);
    const manager = await createUser(Role.MANAGER);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await authCookie(manager.id, manager.role),
          body: { enforcePlanLimits: false },
        })
      ).status,
    ).toBe(403);
    const log = await testPrisma.auditLog.findFirst({
      where: { action: 'SETTINGS_CHANGED', actorId: admin.id },
    });
    expect(JSON.stringify(log?.metadata)).toContain('overageMode');
  });
});
