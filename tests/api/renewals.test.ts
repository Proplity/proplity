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
import { ensureDefaultAgreementData } from '../../lib/agreements';

// Owner request of 2026-10-25: renewing a rent with a new agreement, reminders as a rent ends or an
// agreement waits, and renewals prepared automatically -- each switched on and off by the admin.

const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';
const DAY = 24 * 60 * 60 * 1000;
let templateId = '';
let n = 0;

async function world(over: { endsInDays?: number; autoRenew?: boolean; percent?: number } = {}) {
  const manager = await createUser(Role.MANAGER, { name: 'Bola Adeyemi' });
  const landlord = await createUser(Role.LANDLORD, { name: 'Mr Bello' });
  const tenant = await createUser(Role.TENANT, { name: 'Ada Okafor' });
  const property = await createProperty({
    managerId: manager.id,
    landlordId: landlord.id,
    name: `Renewal Court ${++n}`,
  });
  const unit = await createUnit(property.id, { unitNumber: `R${n}` });
  const endsInDays = over.endsInDays ?? 20;
  const rent = await createRent(unit.id, tenant.id, {
    status: 'ACTIVE',
    rentAmount: 2_000_000,
    paymentFrequency: 'ANNUAL',
    startDate: new Date(Date.now() + (endsInDays - 364) * DAY),
    endDate: new Date(Date.now() + endsInDays * DAY),
    deposit: 200_000,
  });
  await testPrisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } });
  if (over.autoRenew || over.percent !== undefined) {
    await testPrisma.rent.update({
      where: { id: rent.id },
      data: { autoRenew: !!over.autoRenew, autoRenewIncreasePercent: over.percent ?? 0 },
    });
  }
  return {
    manager,
    landlord,
    tenant,
    property,
    unit,
    rent,
    m: await authCookie(manager.id, manager.role),
    t: await authCookie(tenant.id, tenant.role),
  };
}
type World = Awaited<ReturnType<typeof world>>;

const renew = (w: World, cookie: string, body: unknown = {}, rentId = w.rent.id) =>
  apiFetch(`/api/v1/rents/${rentId}/renew`, { method: 'POST', cookie, body });
const cron = (job: string) =>
  apiFetch(`/api/v1/cron/${job}`, { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET } });
const sign = (rentId: string, cookie: string, fullName: string) =>
  apiFetch(`/api/v1/rents/${rentId}/sign`, { method: 'POST', cookie, body: { fullName } });
const titlesFor = async (userId: string) =>
  (await testPrisma.notification.findMany({ where: { recipientId: userId } })).map((x) => x.title);
const balance = async (userId: string) =>
  (await testPrisma.creditEntry.aggregate({ where: { userId }, _sum: { delta: true } }))._sum
    .delta ?? 0;

/** A made agreement for the rent, optionally sent. */
async function agreementFor(w: World, rentId: string, cookie = w.m, send = false) {
  const made = await apiFetch(`/api/v1/rents/${rentId}/agreement`, {
    method: 'POST',
    cookie,
    body: { source: 'GENERATED', templateId },
  });
  expect(made.status).toBe(201);
  if (send) {
    const sent = await apiFetch(`/api/v1/rents/${rentId}/agreement/issue`, {
      method: 'POST',
      cookie,
      body: {},
    });
    expect(sent.status).toBe(200);
  }
  return testPrisma.rentAgreement.findFirstOrThrow({
    where: { rentId, status: { not: 'VOID' } },
  });
}

/** Rents and agreements from earlier tests would be counted by the daily jobs; put them away. */
async function clearTheDecks() {
  await testPrisma.rent.updateMany({ data: { status: 'TERMINATED' } });
  await testPrisma.rentAgreement.updateMany({ data: { status: 'VOID' } });
}

beforeAll(async () => {
  await resetDb();
  await seedPlans();
  await ensureDefaultAgreementData();
  templateId = (
    await testPrisma.agreementTemplate.findFirstOrThrow({ where: { key: 'lagos-residential' } })
  ).id;
});

beforeEach(async () => {
  await setSystemSettings({
    id: 'global',
    agreementTemplatesNeedApproval: false,
    rentActivationRule: 'INDEPENDENT',
    chargeForAgreements: false,
    witnessesMustSign: false,
    agreementRenewalEnabled: true,
    agreementRemindersEnabled: true,
    renewalReminderDays: [90, 60, 30],
    agreementUnsignedReminderDays: 3,
    autoRenewalEnabled: false,
    autoRenewalDaysBefore: 60,
  });
  await testPrisma.jurisdiction.updateMany({
    where: { key: 'lagos' },
    data: { advanceRentMaxMonths: 12, advanceRentMode: 'WARN' },
  });
});

describe('renewing a rent with a new agreement', () => {
  it('makes the next rent: pending, a day after this one, the same length and rent, with its first invoice', async () => {
    const w = await world();
    const res = await renew(w, w.m);
    expect(res.status).toBe(201);
    const next = await testPrisma.rent.findUniqueOrThrow({ where: { id: res.body.data.rent.id } });
    expect(next).toMatchObject({
      status: 'PENDING',
      renewedFromId: w.rent.id,
      rentAmount: 2_000_000,
      deposit: 200_000,
      tenantId: w.tenant.id,
      unitId: w.unit.id,
    });
    expect(next.startDate.getTime()).toBe(w.rent.endDate.getTime() + DAY);
    // 364 days between the dates is a twelve month term, so the next one is twelve months too.
    expect(next.endDate.getUTCFullYear() - next.startDate.getUTCFullYear()).toBe(1);
    // The running rent carries on until the new one starts.
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'ACTIVE',
    );
    const invoices = await testPrisma.invoice.findMany({ where: { rentId: next.id } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ type: 'RENT', amount: 2_000_000 });
    expect(await titlesFor(w.tenant.id)).toContain('Your rent is being renewed');
  });

  it('applies the increase and the length asked for, and an amount typed wins over the increase', async () => {
    const w = await world();
    const res = await renew(w, w.m, { increasePercent: 10, termMonths: 6 });
    expect(res.status).toBe(201);
    const next = await testPrisma.rent.findUniqueOrThrow({ where: { id: res.body.data.rent.id } });
    expect(next.rentAmount).toBe(2_200_000);
    expect(next.endDate.getTime()).toBeLessThan(next.startDate.getTime() + 190 * DAY);
    expect(next.endDate.getTime()).toBeGreaterThan(next.startDate.getTime() + 170 * DAY);

    const w2 = await world();
    const typed = await renew(w2, w2.m, { increasePercent: 10, rentAmount: 2_500_000 });
    expect(
      (await testPrisma.rent.findUniqueOrThrow({ where: { id: typed.body.data.rent.id } }))
        .rentAmount,
    ).toBe(2_500_000);
  });

  it('is for the property team only, and refuses unknown fields and bad dates', async () => {
    const w = await world();
    expect((await renew(w, w.t)).status).toBe(403);
    const other = await createUser(Role.MANAGER);
    expect((await renew(w, await authCookie(other.id, other.role))).status).toBe(403);
    expect((await renew(w, w.m, { status: 'ACTIVE' })).status).toBe(400);
    expect(
      (await renew(w, w.m, { startDate: new Date(Date.now() - 30 * DAY).toISOString() })).body.code,
    ).toBe('STARTS_TOO_EARLY');
    const backwards = await renew(w, w.m, {
      startDate: new Date(w.rent.endDate.getTime() + 10 * DAY).toISOString(),
      endDate: new Date(w.rent.endDate.getTime() + 5 * DAY).toISOString(),
    });
    expect(backwards.body.code).toBe('BAD_DATES');
    expect(await testPrisma.rent.count({ where: { renewedFromId: w.rent.id } })).toBe(0);
  });

  it('refuses a rent that is not running, and a second renewal of the same rent', async () => {
    const w = await world();
    await testPrisma.rent.update({ where: { id: w.rent.id }, data: { status: 'TERMINATED' } });
    expect((await renew(w, w.m)).body.code).toBe('NOT_ACTIVE');
    await testPrisma.rent.update({ where: { id: w.rent.id }, data: { status: 'ACTIVE' } });
    expect((await renew(w, w.m)).status).toBe(201);
    const again = await renew(w, w.m);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_RENEWED');
  });

  it('lets only one of two simultaneous renewals through', async () => {
    const w = await world();
    const results = await Promise.all([renew(w, w.m), renew(w, w.m)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await testPrisma.rent.count({ where: { renewedFromId: w.rent.id } })).toBe(1);
  });

  it('is refused while the admin has renewing with a new agreement switched off', async () => {
    await setSystemSettings({ id: 'global', agreementRenewalEnabled: false });
    const w = await world();
    const res = await renew(w, w.m);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('RENEWAL_OFF');
    const read = await apiFetch(`/api/v1/rents/${w.rent.id}`, { cookie: w.m });
    expect(read.body.data.renewal).toMatchObject({ enabled: false, autoEnabled: false });
  });

  it('stops a renewal a tenancy rule blocks', async () => {
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMaxMonths: 6, advanceRentMode: 'BLOCK' },
    });
    const w = await world();
    const res = await renew(w, w.m);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('TENANCY_RULE');
    expect(await testPrisma.rent.count({ where: { renewedFromId: w.rent.id } })).toBe(0);
  });
});

describe('the agreement prepared for a renewal', () => {
  it('is a draft copied from the last one, and is left out when not asked for', async () => {
    const w = await world();
    const before = await agreementFor(w, w.rent.id);
    const res = await renew(w, w.m);
    expect(res.status).toBe(201);
    expect(res.body.data.agreement.drafted).toBe(true);
    const draft = await testPrisma.rentAgreement.findUniqueOrThrow({
      where: { id: res.body.data.agreement.agreementId },
    });
    expect(draft).toMatchObject({
      rentId: res.body.data.rent.id,
      status: 'DRAFT',
      source: 'GENERATED',
      templateKey: before.templateKey,
    });

    const w2 = await world();
    await agreementFor(w2, w2.rent.id);
    const none = await renew(w2, w2.m, { copyAgreement: false });
    expect(none.body.data.agreement).toMatchObject({ drafted: false });
    expect(
      await testPrisma.rentAgreement.count({ where: { rentId: none.body.data.rent.id } }),
    ).toBe(0);
  });

  it('says why when there is nothing to copy, and the renewal still stands', async () => {
    const w = await world();
    const res = await renew(w, w.m);
    expect(res.status).toBe(201);
    expect(res.body.data.agreement.drafted).toBe(false);
    expect(res.body.data.agreement.reason).toMatch(/no agreement/i);
  });

  it('takes the credits to make it, and the renewal stands when there are none', async () => {
    const w = await world();
    await agreementFor(w, w.rent.id);
    await setSystemSettings({ id: 'global', chargeForAgreements: true });
    const poor = await renew(w, w.m);
    expect(poor.status).toBe(201);
    expect(poor.body.data.agreement.drafted).toBe(false);
    expect(
      await testPrisma.rentAgreement.count({ where: { rentId: poor.body.data.rent.id } }),
    ).toBe(0);

    const w2 = await world();
    await setSystemSettings({ id: 'global', chargeForAgreements: false });
    await agreementFor(w2, w2.rent.id);
    await setSystemSettings({ id: 'global', chargeForAgreements: true });
    await testPrisma.creditEntry.create({
      data: { userId: w2.manager.id, delta: 3, reason: 'ADMIN_GRANT' },
    });
    const paid = await renew(w2, w2.m);
    expect(paid.body.data.agreement.drafted).toBe(true);
    expect(await balance(w2.manager.id)).toBe(2);
  });
});

describe('when a renewal starts', () => {
  async function signedRenewal(w: World) {
    await agreementFor(w, w.rent.id);
    const res = await renew(w, w.m);
    const id = res.body.data.rent.id as string;
    const issued = await apiFetch(`/api/v1/rents/${id}/agreement/issue`, {
      method: 'POST',
      cookie: w.m,
      body: {},
    });
    expect(issued.status).toBe(200);
    return id;
  }

  it('waits for the start date even when signed, then takes the unit over and ends the old rent', async () => {
    await setSystemSettings({ id: 'global', rentActivationRule: 'AFTER_BOTH_SIGN' });
    const w = await world({ endsInDays: 20 });
    const id = await signedRenewal(w);
    expect((await sign(id, w.t, 'Ada Okafor')).status).toBe(201);
    expect((await sign(id, w.m, 'Bola Adeyemi')).status).toBe(201);
    // Signed, but the new term has not begun: it is not running yet.
    const waiting = await testPrisma.rent.findUniqueOrThrow({ where: { id } });
    expect(waiting.agreementSignedAt).not.toBeNull();
    expect(waiting.status).toBe('PENDING');
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'ACTIVE',
    );
    expect((await cron('renewals')).body.result.handedOver).toBe(0);

    // The day arrives.
    await testPrisma.rent.update({
      where: { id },
      data: { startDate: new Date(Date.now() - DAY) },
    });
    const run = await cron('renewals');
    expect(run.status).toBe(200);
    expect(run.body.result.handedOver).toBe(1);
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'EXPIRED',
    );
    expect((await testPrisma.unit.findUniqueOrThrow({ where: { id: w.unit.id } })).status).toBe(
      'OCCUPIED',
    );
    expect(await titlesFor(w.tenant.id)).toContain('Your renewed rent has started');
    // Once only.
    expect((await cron('renewals')).body.result.handedOver).toBe(0);
  });

  it('does not start a renewal nobody has signed', async () => {
    const w = await world();
    const res = await renew(w, w.m, { copyAgreement: false });
    await testPrisma.rent.update({
      where: { id: res.body.data.rent.id },
      data: { startDate: new Date(Date.now() - DAY) },
    });
    expect((await cron('renewals')).body.result.handedOver).toBe(0);
    expect(
      (await testPrisma.rent.findUniqueOrThrow({ where: { id: res.body.data.rent.id } })).status,
    ).toBe('PENDING');
  });

  it('can be started by hand, which ends the old rent in the same step', async () => {
    const w = await world();
    const res = await renew(w, w.m, { copyAgreement: false });
    const id = res.body.data.rent.id as string;
    const started = await apiFetch(`/api/v1/rents/${id}`, {
      method: 'PATCH',
      cookie: w.m,
      body: { status: 'ACTIVE' },
    });
    expect(started.status).toBe(200);
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'EXPIRED',
    );
    expect(await testPrisma.rent.count({ where: { unitId: w.unit.id, status: 'ACTIVE' } })).toBe(1);
  });
});

describe('reminders as a rent comes to an end', () => {
  beforeEach(clearTheDecks);
  const run = () =>
    apiFetch<{ result: { rentsEnding: number } }>('/api/v1/cron/reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
  const endIn = (rentId: string, days: number) =>
    testPrisma.rent.update({
      where: { id: rentId },
      data: { endDate: new Date(Date.now() + days * DAY) },
    });

  it('tells each side once at every step of the admin’s ladder, however often the job runs', async () => {
    const w = await world({ endsInDays: 100 });
    expect((await run()).body.result.rentsEnding).toBe(0);
    await endIn(w.rent.id, 80);
    expect((await run()).body.result.rentsEnding).toBe(1);
    expect((await run()).body.result.rentsEnding).toBe(0);
    await endIn(w.rent.id, 50);
    expect((await run()).body.result.rentsEnding).toBe(1);
    await endIn(w.rent.id, 20);
    expect((await run()).body.result.rentsEnding).toBe(1);
    expect((await run()).body.result.rentsEnding).toBe(0);
    expect(await testPrisma.rentReminderLog.count({ where: { rentId: w.rent.id } })).toBe(3);
    expect((await titlesFor(w.tenant.id)).filter((t) => t.startsWith('Rent ending'))).toHaveLength(
      3,
    );
    expect((await titlesFor(w.manager.id)).filter((t) => t.startsWith('Rent ending'))).toHaveLength(
      3,
    );
  });

  it('follows a ladder the admin changes, and stops when the admin switches reminders off', async () => {
    await setSystemSettings({ id: 'global', renewalReminderDays: [14] });
    const w = await world({ endsInDays: 20 });
    expect((await run()).body.result.rentsEnding).toBe(0);
    await endIn(w.rent.id, 10);
    expect((await run()).body.result.rentsEnding).toBe(1);

    await setSystemSettings({ id: 'global', agreementRemindersEnabled: false });
    const w2 = await world({ endsInDays: 5 });
    expect((await run()).body.result.rentsEnding).toBe(0);
    expect(await titlesFor(w2.tenant.id)).toEqual([]);
  });

  it('tells the team once about a rent still running past its end, unless it was renewed', async () => {
    const late = await world({ endsInDays: -5 });
    const renewed = await world({ endsInDays: -5 });
    await testPrisma.rent.create({
      data: {
        unitId: renewed.unit.id,
        tenantId: renewed.tenant.id,
        startDate: new Date(Date.now() - 4 * DAY),
        endDate: new Date(Date.now() + 360 * DAY),
        rentAmount: 1,
        deposit: 0,
        status: 'PENDING',
        renewedFromId: renewed.rent.id,
      },
    });
    const first = await cron('renewals');
    expect(first.body.result.endedStillActive).toBeGreaterThanOrEqual(1);
    expect((await titlesFor(late.manager.id)).some((t) => t.startsWith('Rent ended'))).toBe(true);
    expect((await titlesFor(renewed.manager.id)).some((t) => t.startsWith('Rent ended'))).toBe(
      false,
    );
    expect((await cron('renewals')).body.result.endedStillActive).toBe(0);
  });
});

describe('reminders for an agreement nobody has signed', () => {
  beforeEach(clearTheDecks);
  async function waiting(daysAgo: number) {
    const w = await world();
    await testPrisma.rent.update({ where: { id: w.rent.id }, data: { status: 'PENDING' } });
    const agreement = await agreementFor(w, w.rent.id, w.m, true);
    await testPrisma.rentAgreement.update({
      where: { id: agreement.id },
      data: { issuedAt: new Date(Date.now() - daysAgo * DAY) },
    });
    return w;
  }

  it('reminds the tenant and the team every few days, a round at a time', async () => {
    const w = await waiting(4);
    const first = await cron('renewals');
    expect(first.body.result.unsignedReminders).toBe(2);
    expect(await titlesFor(w.tenant.id)).toContain('Your rent agreement is waiting for you');
    expect(await titlesFor(w.manager.id)).toContain(
      'A rent agreement is waiting for your signature',
    );
    expect((await cron('renewals')).body.result.unsignedReminders).toBe(0);

    // Three days on it is the second round.
    const agreement = await testPrisma.rentAgreement.findFirstOrThrow({
      where: { rentId: w.rent.id },
    });
    await testPrisma.rentAgreement.update({
      where: { id: agreement.id },
      data: { issuedAt: new Date(Date.now() - 7 * DAY) },
    });
    expect((await cron('renewals')).body.result.unsignedReminders).toBe(2);
  });

  it('stops reminding the side that has signed', async () => {
    const w = await waiting(4);
    expect((await sign(w.rent.id, w.t, 'Ada Okafor')).status).toBe(201);
    const run = await cron('renewals');
    expect(run.body.result.unsignedReminders).toBe(1);
    expect(await titlesFor(w.tenant.id)).not.toContain('Your rent agreement is waiting for you');
  });

  it('is not sent before the days are up, when set to 0, or when reminders are off', async () => {
    await waiting(2);
    expect((await cron('renewals')).body.result.unsignedReminders).toBe(0);

    await waiting(4);
    await setSystemSettings({ id: 'global', agreementUnsignedReminderDays: 0 });
    expect((await cron('renewals')).body.result.unsignedReminders).toBe(0);

    await setSystemSettings({
      id: 'global',
      agreementUnsignedReminderDays: 3,
      agreementRemindersEnabled: false,
    });
    expect((await cron('renewals')).body.result.unsignedReminders).toBe(0);
  });
});

describe('renewing automatically', () => {
  beforeEach(async () => {
    await clearTheDecks();
    await setSystemSettings({ id: 'global', autoRenewalEnabled: true, autoRenewalDaysBefore: 60 });
  });

  it('prepares the renewal inside the window, with the chosen increase, and tells the team once', async () => {
    const w = await world({ endsInDays: 40, autoRenew: true, percent: 5 });
    await agreementFor(w, w.rent.id);
    const run = await cron('renewals');
    expect(run.status).toBe(200);
    expect(run.body.result.prepared).toBe(1);
    const next = await testPrisma.rent.findFirstOrThrow({ where: { renewedFromId: w.rent.id } });
    expect(next).toMatchObject({ status: 'PENDING', rentAmount: 2_100_000, autoRenew: true });
    // A draft agreement is ready; nothing has been sent to the tenant.
    const draft = await testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: next.id } });
    expect(draft.status).toBe('DRAFT');
    expect(await titlesFor(w.manager.id)).toContain('Renewal prepared');
    expect(await titlesFor(w.tenant.id)).not.toContain('Your rent is being renewed');
    // The renewed rent is not renewed again, and the old one is not renewed twice.
    expect((await cron('renewals')).body.result.prepared).toBe(0);
    expect(await testPrisma.rent.count({ where: { renewedFromId: w.rent.id } })).toBe(1);
  });

  it('leaves alone a rent outside the window, one not marked, and everything while the admin has it off', async () => {
    const far = await world({ endsInDays: 120, autoRenew: true });
    const unmarked = await world({ endsInDays: 40 });
    const off = await world({ endsInDays: 30, autoRenew: true });
    await setSystemSettings({ id: 'global', autoRenewalEnabled: false });
    expect((await cron('renewals')).body.result.prepared).toBe(0);
    await setSystemSettings({ id: 'global', autoRenewalEnabled: true });
    expect((await cron('renewals')).body.result.prepared).toBe(1);
    expect(await testPrisma.rent.count({ where: { renewedFromId: far.rent.id } })).toBe(0);
    expect(await testPrisma.rent.count({ where: { renewedFromId: unmarked.rent.id } })).toBe(0);
    expect(await testPrisma.rent.count({ where: { renewedFromId: off.rent.id } })).toBe(1);
  });

  it('says so once when it cannot prepare a renewal', async () => {
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMaxMonths: 6, advanceRentMode: 'BLOCK' },
    });
    const w = await world({ endsInDays: 30, autoRenew: true });
    const first = await cron('renewals');
    expect(first.body.result).toMatchObject({ prepared: 0, failed: 1 });
    expect(await titlesFor(w.manager.id)).toContain('Automatic renewal did not work');
    expect((await cron('renewals')).body.result.failed).toBe(0);
    expect(await testPrisma.rent.count({ where: { renewedFromId: w.rent.id } })).toBe(0);
  });
});

describe('choosing to renew automatically, and the admin’s renewal settings', () => {
  const patch = (w: World, cookie: string, body: unknown) =>
    apiFetch(`/api/v1/rents/${w.rent.id}`, { method: 'PATCH', cookie, body });

  it('is saved quietly for the team and refused while the admin has it off', async () => {
    const w = await world();
    const off = await patch(w, w.m, { autoRenew: true });
    expect(off.status).toBe(403);
    expect(off.body.code).toBe('AUTO_RENEWAL_OFF');

    await setSystemSettings({ id: 'global', autoRenewalEnabled: true });
    const read = await apiFetch(`/api/v1/rents/${w.rent.id}`, { cookie: w.m });
    expect(read.body.data.renewal).toMatchObject({
      enabled: true,
      autoEnabled: true,
      autoDaysBefore: 60,
    });
    const on = await patch(w, w.m, {
      autoRenew: true,
      autoRenewIncreasePercent: 7.5,
      autoRenewTermMonths: 24,
    });
    expect(on.status).toBe(200);
    expect(
      await testPrisma.rent.findUniqueOrThrow({
        where: { id: w.rent.id },
        select: { autoRenew: true, autoRenewIncreasePercent: true, autoRenewTermMonths: true },
      }),
    ).toEqual({ autoRenew: true, autoRenewIncreasePercent: 7.5, autoRenewTermMonths: 24 });
    // Nothing the tenant agreed to changed, so the tenant is not told.
    expect(await titlesFor(w.tenant.id)).toEqual([]);
    // Switching it off is always allowed.
    await setSystemSettings({ id: 'global', autoRenewalEnabled: false });
    expect((await patch(w, w.m, { autoRenew: false })).status).toBe(200);
  });

  it('is for the property team, with sensible limits', async () => {
    await setSystemSettings({ id: 'global', autoRenewalEnabled: true });
    const w = await world();
    expect((await patch(w, w.t, { autoRenew: true })).status).toBe(403);
    expect((await patch(w, w.m, { autoRenewIncreasePercent: 101 })).status).toBe(400);
    expect((await patch(w, w.m, { autoRenewTermMonths: 0 })).status).toBe(400);
    expect((await patch(w, w.m, { autoRenewTermMonths: 1.5 })).status).toBe(400);
  });

  it('are changed by the admin alone, with limits on the days', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const set = (body: unknown) =>
      apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie, body });
    const ok = await set({
      agreementRenewalEnabled: false,
      agreementRemindersEnabled: false,
      autoRenewalEnabled: true,
      renewalReminderDays: [120, 45, 10],
      agreementUnsignedReminderDays: 5,
      autoRenewalDaysBefore: 90,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      agreementRenewalEnabled: false,
      agreementRemindersEnabled: false,
      autoRenewalEnabled: true,
      renewalReminderDays: [120, 45, 10],
      agreementUnsignedReminderDays: 5,
      autoRenewalDaysBefore: 90,
    });
    expect((await set({ renewalReminderDays: [0] })).status).toBe(400);
    expect((await set({ renewalReminderDays: [30, 30] })).status).toBe(400);
    expect((await set({ renewalReminderDays: [1, 2, 3, 4, 5, 6, 7] })).status).toBe(400);
    expect((await set({ renewalReminderDays: [400] })).status).toBe(400);
    expect((await set({ agreementUnsignedReminderDays: -1 })).status).toBe(400);
    expect((await set({ autoRenewalDaysBefore: 3 })).status).toBe(400);
    const manager = await createUser(Role.MANAGER);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await authCookie(manager.id, manager.role),
          body: { autoRenewalEnabled: false },
        })
      ).status,
    ).toBe(403);
  });

  it('only runs the renewals job for a caller with the cron secret', async () => {
    expect((await apiFetch('/api/v1/cron/renewals', { method: 'POST' })).status).toBe(401);
  });
});
