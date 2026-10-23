import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  seedPlans,
  setSystemSettings,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { spendCredits } from '../../lib/credits';

// Owner decision of 2026-10-23: a firm (for example Diya Fatimilehin & Co) has a managing partner and
// people who manage properties, each with their own login; the partner's plan covers all of them.

let n = 0;
async function makePlan(overrides: {
  usersIncluded?: number;
  unitsIncluded?: number;
  monthlyCredits?: number;
}) {
  const key = `team-plan-${++n}`;
  return testPrisma.plan.create({
    data: {
      key,
      name: key,
      monthlyPrice: 1000,
      yearlyPrice: 10_000,
      unitsIncluded: overrides.unitsIncluded ?? 50,
      usersIncluded: overrides.usersIncluded ?? 5,
      overagePerUnit: null,
      monthlyCredits: overrides.monthlyCredits ?? 0,
      sortOrder: 60,
    },
  });
}

/** A managing partner with a company, and the people already in it. */
async function company(memberCount = 1) {
  const partner = await createUser(Role.MANAGER);
  const org = await testPrisma.organisation.create({
    data: { name: 'Diya & Co', ownerId: partner.id },
  });
  await testPrisma.user.update({ where: { id: partner.id }, data: { organisationId: org.id } });
  const members = [];
  for (let i = 0; i < memberCount; i++) {
    members.push(await createUser(Role.MANAGER, { organisationId: org.id }));
  }
  const cookie = async (u: { id: string; role: Role }) => authCookie(u.id, u.role);
  return { partner, org, members, cookie };
}

const get = (cookie: string, path: string) => apiFetch(path, { cookie });

describe('starting a company and adding people', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: false,
      teamMemberAccess: 'ASSIGNED_ONLY',
    });
  });

  it('lets a manager start a company once, and nobody else', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const made = await apiFetch('/api/v1/team', {
      method: 'POST',
      cookie,
      body: { name: 'Diya & Co' },
    });
    expect(made.status).toBe(201);
    const again = await apiFetch('/api/v1/team', {
      method: 'POST',
      cookie,
      body: { name: 'Other' },
    });
    expect(again.status).toBe(409);

    const landlord = await createUser(Role.LANDLORD);
    expect(
      (
        await apiFetch('/api/v1/team', {
          method: 'POST',
          cookie: await authCookie(landlord.id, landlord.role),
          body: { name: 'X' },
        })
      ).status,
    ).toBe(403);

    const overview = await get(cookie, '/api/v1/team');
    expect(overview.body.data.organisation.name).toBe('Diya & Co');
    expect(overview.body.data.isPartner).toBe(true);
    expect(overview.body.data.members).toHaveLength(1);
  });

  it('adds a person with their own manager account and an email to set a password', async () => {
    const c = await company(0);
    const res = await apiFetch('/api/v1/team/members', {
      method: 'POST',
      cookie: await c.cookie(c.partner),
      body: { name: 'Bola Adeyemi', email: 'bola@diya.test' },
    });
    expect(res.status).toBe(201);
    const user = await testPrisma.user.findUnique({
      where: { email: 'bola@diya.test' },
      include: { verificationToken: true },
    });
    expect(user?.role).toBe('MANAGER');
    expect(user?.status).toBe('PENDING_VERIFICATION');
    expect(user?.organisationId).toBe(c.org.id);
    expect(user?.verificationToken).not.toBeNull();
    expect(
      await testPrisma.auditLog.count({ where: { action: 'TEAM_MEMBER_ADDED' } }),
    ).toBeGreaterThan(0);
  });

  it('refuses an email that already has an account, and anyone but the partner adding people', async () => {
    const c = await company(1);
    await createUser(Role.MANAGER, { email: 'taken@diya.test' });
    const taken = await apiFetch('/api/v1/team/members', {
      method: 'POST',
      cookie: await c.cookie(c.partner),
      body: { name: 'Taken', email: 'taken@diya.test' },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('EMAIL_IN_USE');

    const byMember = await apiFetch('/api/v1/team/members', {
      method: 'POST',
      cookie: await c.cookie(c.members[0]),
      body: { name: 'Sneaky', email: 'sneaky@diya.test' },
    });
    expect(byMember.status).toBe(403);
  });

  it('stops at the number of users the plan includes, when limits are on', async () => {
    await setSystemSettings({ id: 'global', enforcePlanLimits: true });
    const c = await company(0);
    const plan = await makePlan({ usersIncluded: 2 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const cookie = await c.cookie(c.partner);
    const add = (email: string) =>
      apiFetch('/api/v1/team/members', { method: 'POST', cookie, body: { name: 'Person', email } });
    expect((await add('one@diya.test')).status).toBe(201);
    const second = await add('two@diya.test');
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('PLAN_LIMIT');
    expect(await testPrisma.user.count({ where: { organisationId: c.org.id } })).toBe(2);
  });

  it('counts a burst of simultaneous invitations against the seats', async () => {
    await setSystemSettings({ id: 'global', enforcePlanLimits: true });
    const c = await company(0);
    const plan = await makePlan({ usersIncluded: 4 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const cookie = await c.cookie(c.partner);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        apiFetch('/api/v1/team/members', {
          method: 'POST',
          cookie,
          body: { name: `P${i}`, email: `burst${i}@diya.test` },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(await testPrisma.user.count({ where: { organisationId: c.org.id } })).toBe(4);
  }, 90_000);

  it('does not limit seats while limits are off', async () => {
    const c = await company(0);
    const cookie = await c.cookie(c.partner);
    for (const e of ['a', 'b', 'c']) {
      expect(
        (
          await apiFetch('/api/v1/team/members', {
            method: 'POST',
            cookie,
            body: { name: e, email: `${e}@free.test` },
          })
        ).status,
      ).toBe(201);
    }
  });
});

describe('what the partner and the team can see and do', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: false,
      teamMemberAccess: 'ASSIGNED_ONLY',
    });
  });

  it("shows the partner every member's properties, and a member only their own", async () => {
    const c = await company(2);
    const [bola, chi] = c.members;
    const mine = await createProperty({ managerId: c.partner.id });
    const bolas = await createProperty({ managerId: bola.id });
    const chis = await createProperty({ managerId: chi.id });
    const stranger = await createUser(Role.MANAGER);
    const others = await createProperty({ managerId: stranger.id });

    const ids = async (u: { id: string; role: Role }) =>
      (await get(await c.cookie(u), '/api/v1/properties?scope=mine')).body.data
        .map((p: { id: string }) => p.id)
        .sort();

    expect(await ids(c.partner)).toEqual([mine.id, bolas.id, chis.id].sort());
    expect(await ids(bola)).toEqual([bolas.id]);
    expect(await ids(stranger)).toEqual([others.id]);
  });

  it("lets members see all the company's properties when the admin chooses that", async () => {
    await setSystemSettings({ id: 'global', teamMemberAccess: 'ALL_COMPANY' });
    const c = await company(2);
    const [bola, chi] = c.members;
    const bolas = await createProperty({ managerId: bola.id });
    const chis = await createProperty({ managerId: chi.id });
    const res = await get(await c.cookie(bola), '/api/v1/properties?scope=mine');
    expect(res.body.data.map((p: { id: string }) => p.id).sort()).toEqual(
      [bolas.id, chis.id].sort(),
    );
  });

  it("lets the partner act on a member's property, and keeps strangers out", async () => {
    const c = await company(1);
    const property = await createProperty({ managerId: c.members[0].id });
    const stranger = await createUser(Role.MANAGER);
    const addUnit = async (u: { id: string; role: Role }) =>
      apiFetch(`/api/v1/properties/${property.id}/units`, {
        method: 'POST',
        cookie: await c.cookie(u),
        body: {
          unitNumber: `U-${Math.random().toString(36).slice(2, 6)}`,
          bedrooms: 1,
          bathrooms: 1,
          rentAmount: 400_000,
        },
      });
    expect((await addUnit(c.partner)).status).toBe(201);
    expect((await addUnit(c.members[0])).status).toBe(201);
    expect((await addUnit(stranger)).status).toBe(403);
  });

  it("lists the partner's view of rents across the team, not a member's view of the partner's", async () => {
    const c = await company(1);
    const mineP = await createProperty({ managerId: c.partner.id });
    const bolasP = await createProperty({ managerId: c.members[0].id });
    const tenant1 = await createUser(Role.TENANT);
    const tenant2 = await createUser(Role.TENANT);
    const r1 = await createRent((await createUnit(mineP.id)).id, tenant1.id);
    const r2 = await createRent((await createUnit(bolasP.id)).id, tenant2.id);

    const idsFor = async (u: { id: string; role: Role }) =>
      (await get(await c.cookie(u), '/api/v1/rents')).body.data
        .map((r: { id: string }) => r.id)
        .sort();
    expect(await idsFor(c.partner)).toEqual([r1.id, r2.id].sort());
    expect(await idsFor(c.members[0])).toEqual([r2.id]);
  });

  it("shows the partner a member's unpublished property page, and a stranger a 404", async () => {
    const c = await company(1);
    const property = await createProperty({ managerId: c.members[0].id, isPublished: false });
    await createUnit(property.id);
    const stranger = await createUser(Role.MANAGER);
    expect((await get(await c.cookie(c.partner), `/api/v1/properties/${property.id}`)).status).toBe(
      200,
    );
    expect(
      (await get(await authCookie(stranger.id, stranger.role), `/api/v1/properties/${property.id}`))
        .status,
    ).toBe(404);
  });

  it('lets the partner hand a property to someone on the team, and nobody else do it', async () => {
    const c = await company(1);
    const stranger = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: c.partner.id });
    const patch = async (u: { id: string; role: Role }, body: Record<string, unknown>) =>
      apiFetch(`/api/v1/properties/${property.id}`, {
        method: 'PATCH',
        cookie: await c.cookie(u),
        body,
      });

    expect((await patch(c.partner, { managerId: stranger.id })).status).toBe(403);
    const landlord = await createUser(Role.LANDLORD);
    expect((await patch(c.partner, { landlordId: landlord.id })).status).toBe(403);
    const handed = await patch(c.partner, { managerId: c.members[0].id });
    expect(handed.status).toBe(200);
    expect((await testPrisma.property.findUnique({ where: { id: property.id } }))?.managerId).toBe(
      c.members[0].id,
    );
    expect(
      await testPrisma.auditLog.count({
        where: { action: 'PROPERTY_TRANSFERRED', entityId: property.id },
      }),
    ).toBe(1);
    // The member cannot hand it on.
    expect((await patch(c.members[0], { managerId: c.partner.id })).status).toBe(403);
  });

  it('lets the partner create a property for a team member, but not for a stranger', async () => {
    const c = await company(1);
    const stranger = await createUser(Role.MANAGER);
    const create = async (managerId: string) =>
      apiFetch('/api/v1/properties', {
        method: 'POST',
        cookie: await c.cookie(c.partner),
        body: { name: 'New', address: '1 Road', city: 'Lagos', managerId },
      });
    expect((await create(c.members[0].id)).status).toBe(201);
    expect((await create(stranger.id)).status).toBe(403);
  });
});

describe('removing someone from the company', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });

  it('gives their properties back to the partner and ends their access', async () => {
    const c = await company(1);
    const bola = c.members[0];
    const p1 = await createProperty({ managerId: bola.id });
    const p2 = await createProperty({ managerId: bola.id });
    const res = await apiFetch(`/api/v1/team/members/${bola.id}`, {
      method: 'DELETE',
      cookie: await c.cookie(c.partner),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.propertiesReassigned).toBe(2);
    for (const p of [p1, p2]) {
      expect((await testPrisma.property.findUnique({ where: { id: p.id } }))?.managerId).toBe(
        c.partner.id,
      );
    }
    expect(
      (await testPrisma.user.findUnique({ where: { id: bola.id } }))?.organisationId,
    ).toBeNull();
    // Now alone: sees nothing of the firm's.
    const mine = await get(await c.cookie(bola), '/api/v1/properties?scope=mine');
    expect(mine.body.data).toHaveLength(0);
    expect(await testPrisma.auditLog.count({ where: { action: 'TEAM_MEMBER_REMOVED' } })).toBe(1);
  });

  it('refuses removing the partner, removing as a member, and removing someone from another company', async () => {
    const c = await company(1);
    const other = await company(1);
    const asPartner = await c.cookie(c.partner);
    expect(
      (
        await apiFetch(`/api/v1/team/members/${c.partner.id}`, {
          method: 'DELETE',
          cookie: asPartner,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apiFetch(`/api/v1/team/members/${c.partner.id}`, {
          method: 'DELETE',
          cookie: await c.cookie(c.members[0]),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await apiFetch(`/api/v1/team/members/${other.members[0].id}`, {
          method: 'DELETE',
          cookie: asPartner,
        })
      ).status,
    ).toBe(404);
  });
});

describe("the company is on the partner's plan", () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: true,
      unitBillingOwner: 'MANAGER_ELSE_LANDLORD',
      overageMode: 'HARD_STOP',
      teamMemberAccess: 'ASSIGNED_ONLY',
    });
  });

  const addUnit = (cookie: string, propertyId: string, unitNumber: string) =>
    apiFetch(`/api/v1/properties/${propertyId}/units`, {
      method: 'POST',
      cookie,
      body: { unitNumber, bedrooms: 1, bathrooms: 1, rentAmount: 400_000 },
    });

  it("counts every member's units against the partner's plan", async () => {
    const c = await company(1);
    const plan = await makePlan({ unitsIncluded: 3, usersIncluded: 5 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const mineP = await createProperty({ managerId: c.partner.id });
    const bolasP = await createProperty({ managerId: c.members[0].id });
    const partnerCookie = await c.cookie(c.partner);
    const bolaCookie = await c.cookie(c.members[0]);
    expect((await addUnit(partnerCookie, mineP.id, 'A1')).status).toBe(201);
    expect((await addUnit(bolaCookie, bolasP.id, 'B1')).status).toBe(201);
    expect((await addUnit(bolaCookie, bolasP.id, 'B2')).status).toBe(201);
    const over = await addUnit(bolaCookie, bolasP.id, 'B3');
    expect(over.status).toBe(403);
    expect(over.body.code).toBe('PLAN_LIMIT');
    expect(over.body.error).toContain("company's");
  });

  it("shows a member the partner's plan and usage, and keeps plan changes with the partner", async () => {
    const c = await company(1);
    const plan = await makePlan({ unitsIncluded: 10, usersIncluded: 5 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const me = await get(await c.cookie(c.members[0]), '/api/v1/subscriptions/me');
    expect(me.body.data.plan.key).toBe(plan.key);
    expect(me.body.data.usage.users).toBe(2);
    expect(me.body.data.usage.usersIncluded).toBe(5);
    expect(me.body.data.canChangePlan).toBe(false);
    expect(me.body.data.company.isPartner).toBe(false);

    const partnerMe = await get(await c.cookie(c.partner), '/api/v1/subscriptions/me');
    expect(partnerMe.body.data.canChangePlan).toBe(true);

    const checkout = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie: await c.cookie(c.members[0]),
      body: { planKey: 'medium' },
    });
    expect(checkout.status).toBe(403);
    expect(checkout.body.code).toBe('NOT_PARTNER');
  });

  it('shares one pool of credits across the company', async () => {
    const c = await company(1);
    const plan = await makePlan({ monthlyCredits: 5 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const memberCredits = await get(await c.cookie(c.members[0]), '/api/v1/credits/me');
    expect(memberCredits.body.data.balance).toBe(5);
    await spendCredits(c.members[0].id, 'rent_agreement');
    const partnerCredits = await get(await c.cookie(c.partner), '/api/v1/credits/me');
    expect(partnerCredits.body.data.balance).toBe(4);
    // Only one allowance for the whole company, not one per person.
    expect(
      await testPrisma.creditEntry.count({
        where: { reason: 'MONTHLY_ALLOWANCE', userId: { in: [c.partner.id, c.members[0].id] } },
      }),
    ).toBe(1);
  });

  it("puts credits an admin grants to a member into the company's pool", async () => {
    const c = await company(1);
    const admin = await createUser(Role.ADMIN);
    const res = await apiFetch('/api/v1/admin/credits', {
      method: 'POST',
      cookie: await authCookie(admin.id, admin.role),
      body: { email: c.members[0].email, amount: 7 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.creditedTo).toBe(c.partner.id);
    const partnerCredits = await get(await c.cookie(c.partner), '/api/v1/credits/me');
    expect(partnerCredits.body.data.balance).toBeGreaterThanOrEqual(7);
  });

  it('refuses to move the company to a plan with fewer users than it has', async () => {
    const c = await company(2);
    const big = await makePlan({ unitsIncluded: 50, usersIncluded: 5 });
    const tiny = await makePlan({ unitsIncluded: 50, usersIncluded: 2 });
    await testPrisma.subscription.create({
      data: {
        userId: c.partner.id,
        planId: big.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    await setSystemSettings({ id: 'global', downgradeRule: 'BLOCK' });
    const res = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie: await c.cookie(c.partner),
      body: { planKey: tiny.key },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOWNGRADE_BLOCKED');
  });
});

describe('the team access setting', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('is changed by an admin, with the allowed values only', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const patch = (value: string) =>
      apiFetch('/api/v1/admin/settings', {
        method: 'PATCH',
        cookie,
        body: { teamMemberAccess: value },
      });
    expect((await patch('ALL_COMPANY')).body.data.teamMemberAccess).toBe('ALL_COMPANY');
    expect((await patch('EVERYONE')).status).toBe(400);
    const manager = await createUser(Role.MANAGER);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await authCookie(manager.id, manager.role),
          body: { teamMemberAccess: 'ASSIGNED_ONLY' },
        })
      ).status,
    ).toBe(403);
  });
});
