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

// Owner decisions of 2026-10-23: a manager or landlord can put a building they already manage into
// Proplity from a spreadsheet, without listing it. Those properties are kept for management only,
// the tenants get a waiting account, and the invitation emails go out later within the daily limit.

const HEADER =
  'propertyName,address,city,unitNumber,rentAmount,paymentFrequency,serviceCharge,tenantName,tenantEmail,startDate,endDate,deposit,nextRentDue';

const day = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

let n = 0;
const email = (label: string) => `${label}-${++n}-${Date.now()}@import.test`;

function fileOf(...lines: string[]) {
  return new File([[HEADER, ...lines].join('\n')], 'portfolio.csv', { type: 'text/csv' });
}

async function send(
  user: { id: string; role: Role },
  file: File,
  opts: { preview?: boolean; confirmOverage?: boolean } = {},
) {
  const form = new FormData();
  form.append('file', file);
  if (opts.preview) form.append('preview', 'true');
  if (opts.confirmOverage) form.append('confirmOverage', 'true');
  return apiFetch('/api/v1/properties/import', {
    method: 'POST',
    cookie: await authCookie(user.id, user.role),
    body: form,
  });
}

const counts = async () => ({
  properties: await testPrisma.property.count(),
  units: await testPrisma.unit.count(),
  rents: await testPrisma.rent.count(),
  users: await testPrisma.user.count(),
});

describe('importing properties, units and tenants from a file', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: false,
      inviteTenantsToManagementOnly: true,
      tenantInvitesPerDay: 10,
    });
  });

  it('shows what a file would do and saves nothing', async () => {
    const manager = await createUser(Role.MANAGER);
    const before = await counts();
    const res = await send(
      manager,
      fileOf(
        `Preview Court,1 Way,Lagos,1A,2500000,,,Ada,${email('ada')},${day(-30)},${day(335)},0,PAID`,
        'Preview Court,1 Way,Lagos,1B,3000000,,,,,,,,',
      ),
      { preview: true },
    );
    expect(res.status).toBe(200);
    const preview = res.body.data;
    expect(preview.canImport).toBe(true);
    expect(preview.issues).toEqual([]);
    expect(preview.summary).toMatchObject({
      properties: 1,
      newProperties: 1,
      units: 2,
      tenancies: 1,
      activeTenancies: 1,
      newTenantAccounts: 1,
    });
    expect(preview.invitations).toMatchObject({ toSend: 1, dailyLimit: 10, remainingToday: 10 });
    expect(await counts()).toEqual(before);
  });

  it('creates management-only properties, vacant and let units, waiting tenants and the first invoice', async () => {
    const manager = await createUser(Role.MANAGER);
    const ada = email('ada');
    const bola = email('bola');
    const res = await send(
      manager,
      fileOf(
        // Running monthly tenancy, next rent due soon, with a service charge.
        `Import Court,2 Way,Lagos,1A,250000,monthly,15000,Ada Okafor,${ada},${day(-60)},${day(305)},250000,${day(5)}`,
        // Not started yet: first invoice on the start date.
        `Import Court,2 Way,Lagos,1B,3200000,,,Bola Ade,${bola},${day(20)},${day(385)},100000,`,
        // Vacant.
        'Import Court,2 Way,Lagos,1C,2000000,,,,,,,,',
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ units: 3, tenancies: 2, newTenantAccounts: 2 });

    const property = await testPrisma.property.findFirstOrThrow({
      where: { name: 'Import Court' },
      include: { units: true },
    });
    expect(property.managementOnly).toBe(true);
    expect(property.isPublished).toBe(false);
    expect(property.managerId).toBe(manager.id);
    expect(property.createdById).toBe(manager.id);
    expect(property.listingHash).toBeNull();
    expect(property.units).toHaveLength(3);
    // No admin has to approve units of a property nobody can see.
    expect(property.units.every((u) => !u.amenities.includes('approval:pending'))).toBe(true);

    const adaUser = await testPrisma.user.findUniqueOrThrow({
      where: { email: ada },
      include: { verificationToken: true },
    });
    expect(adaUser.role).toBe('TENANT');
    expect(adaUser.status).toBe('PENDING_VERIFICATION');
    // Created, not invited: nothing was emailed and no invitation counts against the day yet.
    expect(adaUser.verificationToken).toBeNull();
    expect(
      await testPrisma.auditLog.count({ where: { action: 'TENANT_INVITED', actorId: manager.id } }),
    ).toBe(0);

    const adaRent = await testPrisma.rent.findFirstOrThrow({
      where: { tenantId: adaUser.id },
      include: { unit: true, invoices: true },
    });
    expect(adaRent.status).toBe('ACTIVE');
    expect(adaRent.unit.status).toBe('OCCUPIED');
    expect(adaRent.paymentFrequency).toBe('MONTHLY');
    // The first invoice is the next one due, not the start date billed over again.
    const rentInvoice = adaRent.invoices.find((i) => i.type === 'RENT')!;
    expect(rentInvoice.dueDate.toISOString().slice(0, 10)).toBe(day(5));
    expect(rentInvoice.amount).toBe(250_000);
    expect(adaRent.invoices.find((i) => i.type === 'SERVICE_CHARGE')?.amount).toBe(15_000);

    const bolaRent = await testPrisma.rent.findFirstOrThrow({
      where: { tenant: { email: bola } },
      include: { unit: true, invoices: true },
    });
    expect(bolaRent.status).toBe('PENDING');
    expect(bolaRent.unit.status).toBe('VACANT');
    expect(bolaRent.invoices[0].dueDate.toISOString().slice(0, 10)).toBe(day(20));

    expect(property.units.find((u) => u.unitNumber === '1C')?.status).toBe('VACANT');
    expect(await testPrisma.auditLog.count({ where: { action: 'PORTFOLIO_IMPORTED' } })).toBe(1);
  });

  it('bills nothing for a tenancy whose whole term is already paid', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = email('paid');
    const res = await send(
      manager,
      fileOf(
        `Paid Court,3 Way,Lagos,1A,3000000,annual,,Chidi,${tenant},${day(-90)},${day(275)},,PAID`,
      ),
    );
    expect(res.status).toBe(201);
    const rent = await testPrisma.rent.findFirstOrThrow({
      where: { tenant: { email: tenant } },
      include: { invoices: true },
    });
    expect(rent.status).toBe('ACTIVE');
    expect(rent.invoices).toHaveLength(0);
  });

  it('links a tenant who already has an account and tells them in the app', async () => {
    const manager = await createUser(Role.MANAGER);
    const existing = await createUser(Role.TENANT, { email: email('known') });
    const before = await testPrisma.user.count();
    const res = await send(
      manager,
      fileOf(
        `Linked Court,4 Way,Lagos,1A,1000000,,,Known Person,${existing.email.toUpperCase()},${day(10)},${day(375)},,`,
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ newTenantAccounts: 0, linkedTenantAccounts: 1 });
    expect(await testPrisma.user.count()).toBe(before);
    expect(await testPrisma.rent.count({ where: { tenantId: existing.id } })).toBe(1);
    const notes = await testPrisma.notification.findMany({ where: { recipientId: existing.id } });
    expect(notes.some((x) => x.title === 'A rent was added for you')).toBe(true);
  });

  it('saves nothing when any row has a problem, and lists every problem', async () => {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD, { email: email('owner') });
    const before = await counts();
    const res = await send(
      manager,
      fileOf(
        'Bad Court,5 Way,Lagos,1A,2500000,,,,,,,,',
        'Bad Court,5 Way,Lagos,1B,lots,,,,,,,,',
        `Bad Court,5 Way,Lagos,1C,1000000,,,Owner,${landlord.email},${day(10)},${day(375)},,`,
      ),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IMPORT_HAS_ERRORS');
    expect(res.body.issues.map((i: { row: number }) => i.row)).toEqual([3, 4]);
    expect(res.body.issues[1].error).toMatch(/landlord account/);
    expect(await counts()).toEqual(before);
  });

  it('refuses a file with missing columns or no rows', async () => {
    const manager = await createUser(Role.MANAGER);
    const noColumns = await send(
      manager,
      new File(['propertyName,city\nX,Lagos'], 'x.csv', { type: 'text/csv' }),
    );
    expect(noColumns.status).toBe(400);
    expect(noColumns.body.error).toMatch(/missing these columns/);
    const empty = await send(manager, new File([HEADER], 'x.csv', { type: 'text/csv' }));
    expect(empty.status).toBe(400);
  });

  it('adds new units to a property that already exists and refuses units it already has', async () => {
    const manager = await createUser(Role.MANAGER);
    const first = await send(
      manager,
      fileOf(
        'Growing Court,6 Way,Lagos,1A,1000000,,,,,,,,',
        'Growing Court,6 Way,Lagos,1B,1000000,,,,,,,,',
      ),
    );
    expect(first.status).toBe(201);

    const again = await send(manager, fileOf('Growing Court,6 Way,Lagos,1A,1000000,,,,,,,,'));
    expect(again.status).toBe(422);
    expect(again.body.issues[0].error).toMatch(/already exists/);

    const more = await send(manager, fileOf('growing court,6 way,lagos,1C,1000000,,,,,,,,'));
    expect(more.status).toBe(201);
    expect(more.body.data.summary).toMatchObject({ newProperties: 0, existingProperties: 1 });
    expect(await testPrisma.property.count({ where: { name: 'Growing Court' } })).toBe(1);
    expect(await testPrisma.unit.count({ where: { property: { name: 'Growing Court' } } })).toBe(3);
  });

  it('does not touch another manager’s property of the same name', async () => {
    const mine = await createUser(Role.MANAGER);
    const theirs = await createUser(Role.MANAGER);
    const theirProperty = await createProperty({ managerId: theirs.id, name: 'Shared Name' });
    await testPrisma.property.update({
      where: { id: theirProperty.id },
      data: { address: '7 Way', city: 'Lagos' },
    });
    await createUnit(theirProperty.id, { unitNumber: '1A' });
    const res = await send(mine, fileOf('Shared Name,7 Way,Lagos,1A,1000000,,,,,,,,'));
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ newProperties: 1, existingProperties: 0 });
    expect(await testPrisma.property.count({ where: { name: 'Shared Name' } })).toBe(2);
  });

  it('counts the units against the plan and saves none of them when they do not fit', async () => {
    await setSystemSettings({ id: 'global', enforcePlanLimits: true });
    const manager = await createUser(Role.MANAGER);
    const plan = await testPrisma.plan.create({
      data: {
        key: `import-plan-${Date.now()}`,
        name: 'Two units',
        monthlyPrice: 1000,
        yearlyPrice: 10_000,
        unitsIncluded: 2,
        usersIncluded: 1,
        overagePerUnit: null,
        monthlyCredits: 0,
        sortOrder: 70,
      },
    });
    await testPrisma.subscription.create({
      data: {
        userId: manager.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      },
    });
    const file = () =>
      fileOf(
        'Limit Court,8 Way,Lagos,1A,1000000,,,,,,,,',
        'Limit Court,8 Way,Lagos,1B,1000000,,,,,,,,',
        'Limit Court,8 Way,Lagos,1C,1000000,,,,,,,,',
      );

    const preview = await send(manager, file(), { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.data.capacity).toMatchObject({ blocking: true, code: 'PLAN_LIMIT' });
    expect(preview.body.data.canImport).toBe(false);

    const res = await send(manager, file());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT');
    expect(await testPrisma.unit.count({ where: { property: { name: 'Limit Court' } } })).toBe(0);
    expect(await testPrisma.property.count({ where: { name: 'Limit Court' } })).toBe(0);
  });

  it('lets only one of two identical uploads at the same moment through', async () => {
    const manager = await createUser(Role.MANAGER);
    const rows = [
      'Race Court,9 Way,Lagos,1A,1000000,,,,,,,,',
      'Race Court,9 Way,Lagos,1B,1000000,,,,,,,,',
    ];
    const results = await Promise.all([
      send(manager, fileOf(...rows)),
      send(manager, fileOf(...rows)),
      send(manager, fileOf(...rows)),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 422)).toHaveLength(2);
    expect(await testPrisma.property.count({ where: { name: 'Race Court' } })).toBe(1);
    expect(await testPrisma.unit.count({ where: { property: { name: 'Race Court' } } })).toBe(2);
  }, 90_000);

  it('does not create new tenant accounts when an admin has switched invitations off, but still links existing ones', async () => {
    await setSystemSettings({ id: 'global', inviteTenantsToManagementOnly: false });
    const manager = await createUser(Role.MANAGER);
    const known = await createUser(Role.TENANT, { email: email('known') });
    const res = await send(
      manager,
      fileOf(
        `Closed Court,10 Way,Lagos,1A,1000000,,,New Person,${email('new')},${day(10)},${day(375)},,`,
        `Closed Court,10 Way,Lagos,1B,1000000,,,Known,${known.email},${day(10)},${day(375)},,`,
      ),
    );
    expect(res.status).toBe(422);
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].row).toBe(2);

    const onlyKnown = await send(
      manager,
      fileOf(
        `Closed Court,10 Way,Lagos,1B,1000000,,,Known,${known.email},${day(10)},${day(375)},,`,
      ),
    );
    expect(onlyKnown.status).toBe(201);
  });

  it('is for managers and landlords only', async () => {
    const file = () => fileOf('Roles Court,11 Way,Lagos,1A,1000000,,,,,,,,');
    for (const role of [Role.TENANT, Role.VENDOR, Role.ADMIN]) {
      const user = await createUser(role);
      expect((await send(user, file())).status).toBe(403);
    }
    const form = new FormData();
    form.append('file', file());
    const anonymous = await apiFetch('/api/v1/properties/import', { method: 'POST', body: form });
    expect(anonymous.status).toBe(401);
    expect(await testPrisma.property.count({ where: { name: 'Roles Court' } })).toBe(0);

    const landlord = await createUser(Role.LANDLORD);
    const ok = await send(landlord, file());
    expect(ok.status).toBe(201);
    const made = await testPrisma.property.findFirstOrThrow({ where: { name: 'Roles Court' } });
    expect(made.landlordId).toBe(landlord.id);
    expect(made.managerId).toBeNull();
  });

  it('puts the whole company’s plan behind a partner’s import and shows it to their team', async () => {
    const partner = await createUser(Role.MANAGER);
    const org = await testPrisma.organisation.create({
      data: { name: 'Firm & Co', ownerId: partner.id },
    });
    await testPrisma.user.update({ where: { id: partner.id }, data: { organisationId: org.id } });
    const member = await createUser(Role.MANAGER, { organisationId: org.id });
    const res = await send(partner, fileOf('Firm Court,12 Way,Lagos,1A,1000000,,,,,,,,'));
    expect(res.status).toBe(201);
    const list = await apiFetch('/api/v1/properties?scope=mine', {
      cookie: await authCookie(partner.id, partner.role),
    });
    expect(list.body.data.some((p: { name: string }) => p.name === 'Firm Court')).toBe(true);
    // The member's own scope is their own properties only (the default setting).
    const theirs = await apiFetch('/api/v1/properties?scope=mine', {
      cookie: await authCookie(member.id, member.role),
    });
    expect(theirs.body.data.some((p: { name: string }) => p.name === 'Firm Court')).toBe(false);
  });
});

describe('inviting the tenants a file created', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
  });
  beforeEach(async () => {
    await setSystemSettings({
      id: 'global',
      enforcePlanLimits: false,
      inviteTenantsToManagementOnly: true,
      tenantInvitesPerDay: 10,
    });
  });

  /** A manager with a management-only property and `count` tenants waiting for an invitation. */
  async function withWaitingTenants(count: number) {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, managementOnly: true });
    const rents = [];
    for (let i = 0; i < count; i++) {
      const tenant = await createUser(Role.TENANT, {
        email: email('waiting'),
        status: 'PENDING_VERIFICATION',
      });
      const unit = await createUnit(property.id);
      rents.push(await createRent(unit.id, tenant.id, { status: 'ACTIVE' }));
    }
    return { manager, property, rents };
  }

  it('sends the waiting invitations a day’s limit allows and says how many are left', async () => {
    await setSystemSettings({ id: 'global', tenantInvitesPerDay: 2 });
    const { manager, rents } = await withWaitingTenants(3);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/rents/invitations', { method: 'POST', cookie });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      sent: 2,
      stillWaiting: 1,
      limitReached: true,
      dailyLimit: 2,
    });
    const tenantIds = rents.map((r) => r.tenantId);
    expect(await testPrisma.verificationToken.count({ where: { userId: { in: tenantIds } } })).toBe(
      2,
    );
    expect(
      await testPrisma.auditLog.count({
        where: { action: 'TENANT_INVITED', actorId: manager.id },
      }),
    ).toBe(2);

    const list = await apiFetch('/api/v1/rents', { cookie });
    const states = rents.map(
      (r) => list.body.data.find((x: { id: string }) => x.id === r.id).invitation,
    );
    expect(states.filter((s: string) => s === 'INVITED')).toHaveLength(2);
    expect(states.filter((s: string) => s === 'NOT_SENT')).toHaveLength(1);
    // The account status and token never reach the screen.
    expect(JSON.stringify(list.body)).not.toContain('verificationToken');
    expect(JSON.stringify(list.body)).not.toContain('tokenHash');

    // A second press the same day sends nothing more.
    const again = await apiFetch('/api/v1/rents/invitations', { method: 'POST', cookie });
    expect(again.body.data).toMatchObject({ sent: 0, stillWaiting: 1, limitReached: true });
  });

  it('sends one invitation, sends it again with a fresh link, and counts each against the day', async () => {
    const { manager, rents } = await withWaitingTenants(1);
    const cookie = await authCookie(manager.id, manager.role);
    const first = await apiFetch(`/api/v1/rents/${rents[0].id}/invite`, { method: 'POST', cookie });
    expect(first.status).toBe(200);
    const userId = rents[0].tenantId;
    const token1 = await testPrisma.verificationToken.findFirstOrThrow({ where: { userId } });
    const second = await apiFetch(`/api/v1/rents/${rents[0].id}/invite`, {
      method: 'POST',
      cookie,
    });
    expect(second.status).toBe(200);
    const token2 = await testPrisma.verificationToken.findFirstOrThrow({ where: { userId } });
    expect(token2.tokenHash).not.toBe(token1.tokenHash);
    expect(await testPrisma.verificationToken.count({ where: { userId } })).toBe(1);
    expect(
      await testPrisma.auditLog.count({ where: { action: 'TENANT_INVITED', actorId: manager.id } }),
    ).toBe(2);
  });

  it('stops a single invitation at the daily limit', async () => {
    await setSystemSettings({ id: 'global', tenantInvitesPerDay: 1 });
    const { manager, rents } = await withWaitingTenants(2);
    const cookie = await authCookie(manager.id, manager.role);
    expect(
      (await apiFetch(`/api/v1/rents/${rents[0].id}/invite`, { method: 'POST', cookie })).status,
    ).toBe(200);
    const over = await apiFetch(`/api/v1/rents/${rents[1].id}/invite`, { method: 'POST', cookie });
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('INVITE_LIMIT');
  });

  it('refuses a tenant who has already joined, and a manager who does not look after the property', async () => {
    const { manager, property } = await withWaitingTenants(0);
    const joined = await createUser(Role.TENANT);
    const rent = await createRent((await createUnit(property.id)).id, joined.id, {
      status: 'ACTIVE',
    });
    const cookie = await authCookie(manager.id, manager.role);
    const done = await apiFetch(`/api/v1/rents/${rent.id}/invite`, { method: 'POST', cookie });
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('ALREADY_JOINED');

    const waiting = await createUser(Role.TENANT, {
      email: email('w'),
      status: 'PENDING_VERIFICATION',
    });
    const waitingRent = await createRent((await createUnit(property.id)).id, waiting.id);
    const stranger = await createUser(Role.MANAGER);
    const denied = await apiFetch(`/api/v1/rents/${waitingRent.id}/invite`, {
      method: 'POST',
      cookie: await authCookie(stranger.id, stranger.role),
    });
    expect(denied.status).toBe(403);
    const tenantTries = await apiFetch(`/api/v1/rents/${waitingRent.id}/invite`, {
      method: 'POST',
      cookie: await authCookie(waiting.id, waiting.role),
    });
    expect(tenantTries.status).toBe(403);
  });

  it('follows the admin switch for properties kept for management only; admins are never held back', async () => {
    await setSystemSettings({ id: 'global', inviteTenantsToManagementOnly: false });
    const { manager, rents } = await withWaitingTenants(1);
    const cookie = await authCookie(manager.id, manager.role);
    const blocked = await apiFetch(`/api/v1/rents/${rents[0].id}/invite`, {
      method: 'POST',
      cookie,
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('INVITES_NOT_ALLOWED');

    const bulk = await apiFetch('/api/v1/rents/invitations', { method: 'POST', cookie });
    expect(bulk.body.data).toMatchObject({ sent: 0, notAllowed: 1 });

    const admin = await createUser(Role.ADMIN);
    const byAdmin = await apiFetch(`/api/v1/rents/${rents[0].id}/invite`, {
      method: 'POST',
      cookie: await authCookie(admin.id, admin.role),
    });
    expect(byAdmin.status).toBe(200);
  });

  it('lets a manager add a new tenant by email to a property kept for management only without an approved listing', async () => {
    const manager = await createUser(Role.MANAGER);
    const hidden = await createProperty({ managerId: manager.id, managementOnly: true });
    const listed = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);
    const body = (unitId: string, tenantEmail: string) => ({
      unitId,
      tenantEmail,
      tenantName: 'New Tenant',
      startDate: day(5),
      endDate: day(370),
      rentAmount: 1_000_000,
      deposit: 0,
    });

    const hiddenUnit = await createUnit(hidden.id);
    const ok = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie,
      body: body(hiddenUnit.id, email('hidden')),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.tenantInvited).toBe(true);

    // A normal listing still needs an admin's approval first.
    const listedUnit = await createUnit(listed.id);
    const refused = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie,
      body: body(listedUnit.id, email('listed')),
    });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('LISTING_NOT_APPROVED');
  });
});

describe('properties kept for management only', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('can be added by hand without going to the admins, and stays out of duplicate matching', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const made = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: {
        name: 'Private Block',
        address: '99 Quiet Road',
        city: 'Lagos',
        managementOnly: true,
      },
    });
    expect(made.status).toBe(201);
    expect(made.body.data.managementOnly).toBe(true);
    expect(made.body.data.listingHash).toBeNull();
    expect(await testPrisma.notification.count({ where: { recipientId: admin.id } })).toBe(0);

    // Another person listing the same address is not told about the private property.
    const other = await createUser(Role.MANAGER);
    const listing = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie: await authCookie(other.id, other.role),
      body: { name: 'Public Block', address: '99 Quiet Road', city: 'Lagos' },
    });
    expect(listing.status).toBe(201);
    expect(listing.body.possibleDuplicates).toBe(0);
    expect(listing.body.data.moderationNotes ?? '').not.toContain('Private Block');
  });

  it('cannot be published, and is not in any public list', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, managementOnly: true });
    await testPrisma.property.update({
      where: { id: property.id },
      data: { moderationStatus: 'APPROVED' },
    });
    await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);
    const publish = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { isPublished: true },
    });
    expect(publish.status).toBe(409);
    expect(publish.body.code).toBe('MANAGEMENT_ONLY');

    const publicList = await apiFetch('/api/v1/properties');
    expect(publicList.body.data.some((p: { id: string }) => p.id === property.id)).toBe(false);
  });

  it('can be listed publicly, which sends it for review, and taken off the market again', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, managementOnly: true });
    const cookie = await authCookie(manager.id, manager.role);

    const mixed = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managementOnly: false, name: 'Renamed' },
    });
    expect(mixed.status).toBe(400);

    const listed = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managementOnly: false },
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data.managementOnly).toBe(false);
    expect(listed.body.data.listingHash).not.toBeNull();
    expect(
      (await testPrisma.notification.findMany({ where: { recipientId: admin.id } })).some(
        (x) => x.title === 'Listing awaiting review',
      ),
    ).toBe(true);

    await testPrisma.property.update({
      where: { id: property.id },
      data: { moderationStatus: 'APPROVED', isPublished: true },
    });
    const hidden = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managementOnly: true },
    });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.managementOnly).toBe(true);
    expect(hidden.body.data.isPublished).toBe(false);

    const stranger = await createUser(Role.MANAGER);
    const denied = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie: await authCookie(stranger.id, stranger.role),
      body: { managementOnly: false },
    });
    expect(denied.status).toBe(403);
  });

  it('are not waiting for an admin: left out of the review count and the attention list', async () => {
    await resetDb();
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    await createProperty({ managerId: manager.id, managementOnly: true });
    const cookie = await authCookie(admin.id, admin.role);

    const attention = await apiFetch('/api/v1/dashboard/attention', { cookie });
    expect(attention.body.data.map((r: { id: string }) => r.id)).not.toContain('admin-listings');
    const summary = await apiFetch('/api/v1/admin/summary', { cookie });
    expect(
      summary.body.data.attentionItems.some((a: { title: string }) =>
        a.title.startsWith('Property awaiting'),
      ),
    ).toBe(false);

    await createProperty({ managerId: manager.id });
    const attentionAfter = await apiFetch('/api/v1/dashboard/attention', { cookie });
    expect(attentionAfter.body.data.map((r: { id: string }) => r.id)).toContain('admin-listings');
    const after = await apiFetch('/api/v1/admin/summary', { cookie });
    expect(
      after.body.data.attentionItems.some((a: { title: string }) =>
        a.title.startsWith('Property awaiting'),
      ),
    ).toBe(true);
  });
});
