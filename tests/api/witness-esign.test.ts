import crypto from 'crypto';
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
import { hashWitnessToken } from '../../lib/agreementWitness';

// Owner request of 2026-10-25: witnesses can sign through an emailed link, and the admin can switch
// that on and off (and decide whether an agreement waits for its witnesses).

let templateId = '';
let n = 0;

async function world() {
  const manager = await createUser(Role.MANAGER, { name: 'Bola Adeyemi' });
  const landlord = await createUser(Role.LANDLORD, { name: 'Mr Bello' });
  const tenant = await createUser(Role.TENANT, {
    name: 'Ada Okafor',
    email: `ada-${++n}@witness.test`,
  });
  const property = await createProperty({
    managerId: manager.id,
    landlordId: landlord.id,
    name: `Witness Court ${n}`,
  });
  const unit = await createUnit(property.id, { unitNumber: `W${n}` });
  const rent = await createRent(unit.id, tenant.id, {
    status: 'PENDING',
    rentAmount: 2_500_000,
    paymentFrequency: 'ANNUAL',
    startDate: new Date('2026-12-01T00:00:00Z'),
    endDate: new Date('2027-11-30T00:00:00Z'),
    deposit: 250_000,
  });
  return {
    manager,
    landlord,
    tenant,
    rent,
    m: await authCookie(manager.id, manager.role),
    l: await authCookie(landlord.id, landlord.role),
    t: await authCookie(tenant.id, tenant.role),
  };
}
type World = Awaited<ReturnType<typeof world>>;

const base = (w: World) => `/api/v1/rents/${w.rent.id}/agreement`;
const post = (w: World, path: string, cookie: string, body?: unknown) =>
  apiFetch(`${base(w)}/${path}`, { method: 'POST', cookie, body: body ?? {} });
const sign = (w: World, cookie: string, fullName: string) =>
  apiFetch(`/api/v1/rents/${w.rent.id}/sign`, { method: 'POST', cookie, body: { fullName } });
const invite = (
  w: World,
  cookie: string,
  body: { side: 'LANDLORD' | 'TENANT'; name?: string; email?: string },
) =>
  apiFetch(`${base(w)}/witnesses`, {
    method: 'POST',
    cookie,
    body: { name: 'Chidi Obi', email: `chidi-${++n}@friends.test`, ...body },
  });

/** A made-and-sent agreement. */
async function issued(w: World) {
  const made = await apiFetch(base(w), {
    method: 'POST',
    cookie: w.m,
    body: { source: 'GENERATED', templateId },
  });
  expect(made.status).toBe(201);
  expect((await post(w, 'issue', w.m)).status).toBe(200);
  return testPrisma.rentAgreement.findFirstOrThrow({
    where: { rentId: w.rent.id, status: { not: 'VOID' } },
  });
}

/** A witness row with a link whose token we know (the email itself is not readable here). */
async function seedWitness(
  agreementId: string,
  side: 'LANDLORD' | 'TENANT',
  over: Partial<{ expires: Date; status: 'INVITED' | 'SIGNED' }> = {},
) {
  const token = crypto.randomBytes(32).toString('hex');
  const witness = await testPrisma.agreementWitness.create({
    data: {
      agreementId,
      side,
      name: `${side} witness`,
      email: `${side.toLowerCase()}-${++n}@friends.test`,
      tokenHash: hashWitnessToken(token),
      tokenExpiresAt: over.expires ?? new Date(Date.now() + 3 * 86_400_000),
      status: over.status ?? 'INVITED',
    },
  });
  return { token, witness };
}

const open = (token: string) => apiFetch(`/api/v1/witness/${token}`);
const witnessSign = (token: string, body: Record<string, unknown> = {}) =>
  apiFetch(`/api/v1/witness/${token}`, {
    method: 'POST',
    body: { fullName: 'Chidi Obi', confirm: true, ...body },
  });

describe('asking a witness to sign by email', () => {
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
      witnessEsignEnabled: true,
      witnessesMustSign: false,
      witnessLinkDays: 14,
    });
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMaxMonths: 12, advanceRentMode: 'WARN' },
    });
  });

  it('records the witness, sends a link that lasts the admin’s number of days, and never shows the token', async () => {
    await setSystemSettings({ id: 'global', witnessLinkDays: 5 });
    const w = await world();
    const agreement = await issued(w);
    const res = await invite(w, w.m, {
      side: 'LANDLORD',
      name: 'Chidi Obi',
      email: 'Chidi@Friends.test',
    });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/tokenHash|token"/i);
    const row = await testPrisma.agreementWitness.findFirstOrThrow({
      where: { agreementId: agreement.id, side: 'LANDLORD' },
    });
    expect(row.email).toBe('chidi@friends.test');
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const days = (row.tokenExpiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(4.9);
    expect(days).toBeLessThan(5.1);
    // The printed witness details follow the person who was asked.
    const after = await testPrisma.rentAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect((after.witnesses as { landlord: { name: string } }).landlord.name).toBe('Chidi Obi');
  });

  it('shows the team each witness and their email, and the tenant only their own witness’s email', async () => {
    const w = await world();
    const agreement = await issued(w);
    await seedWitness(agreement.id, 'LANDLORD');
    const own = await seedWitness(agreement.id, 'TENANT');
    const team = await apiFetch(base(w), { cookie: w.m });
    expect(team.body.data.witnessEsign).toMatchObject({ enabled: true, mustSign: false });
    expect(team.body.data.witnessSignatures).toHaveLength(2);
    expect(team.body.data.witnessSignatures.every((x: { email: string | null }) => x.email)).toBe(
      true,
    );
    const tenant = await apiFetch(base(w), { cookie: w.t });
    const sides = Object.fromEntries(
      tenant.body.data.witnessSignatures.map((x: { side: string; email: string | null }) => [
        x.side,
        x.email,
      ]),
    );
    expect(sides.LANDLORD).toBeNull();
    expect(sides.TENANT).toBe(own.witness.email);
  });

  it('is refused while the admin has it switched off, and shows the screens it is off', async () => {
    await setSystemSettings({ id: 'global', witnessEsignEnabled: false });
    const w = await world();
    await issued(w);
    const res = await invite(w, w.m, { side: 'LANDLORD' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WITNESS_ESIGN_OFF');
    const view = await apiFetch(base(w), { cookie: w.m });
    expect(view.body.data.witnessEsign.enabled).toBe(false);
  });

  it('needs an agreement that has been sent, that is generated, and that wants witnesses', async () => {
    const w = await world();
    expect((await invite(w, w.m, { side: 'LANDLORD' })).body.code).toBe('NO_AGREEMENT');
    await apiFetch(base(w), {
      method: 'POST',
      cookie: w.m,
      body: { source: 'GENERATED', templateId },
    });
    const draft = await invite(w, w.m, { side: 'LANDLORD' });
    expect(draft.status).toBe(409);
    expect(draft.body.code).toBe('AGREEMENT_NOT_SENT');

    await post(w, 'issue', w.m);
    await testPrisma.rentAgreement.updateMany({
      where: { rentId: w.rent.id },
      data: { witnessRequired: false },
    });
    expect((await invite(w, w.m, { side: 'LANDLORD' })).body.code).toBe('WITNESS_NOT_REQUIRED');
  });

  it('refuses a witness who is one of the people signing, or the same person on both sides', async () => {
    const w = await world();
    await issued(w);
    const self = await invite(w, w.m, { side: 'TENANT', email: w.tenant.email });
    expect(self.status).toBe(400);
    expect(self.body.code).toBe('WITNESS_IS_PARTY');
    expect((await invite(w, w.m, { side: 'LANDLORD', email: w.landlord.email })).body.code).toBe(
      'WITNESS_IS_PARTY',
    );

    expect((await invite(w, w.m, { side: 'LANDLORD', email: 'same@friends.test' })).status).toBe(
      201,
    );
    const both = await invite(w, w.m, { side: 'TENANT', email: 'same@friends.test' });
    expect(both.status).toBe(400);
    expect(both.body.code).toBe('WITNESS_ON_BOTH_SIDES');
  });

  it('lets the tenant ask only their own witness, and nobody outside the rent ask anyone', async () => {
    const w = await world();
    await issued(w);
    expect((await invite(w, w.t, { side: 'TENANT' })).status).toBe(201);
    const theirs = await invite(w, w.t, { side: 'LANDLORD' });
    expect(theirs.status).toBe(403);
    expect(theirs.body.code).toBe('NOT_YOUR_WITNESS');

    const stranger = await createUser(Role.MANAGER);
    expect(
      (await invite(w, await authCookie(stranger.id, stranger.role), { side: 'TENANT' })).status,
    ).toBe(403);
    const otherTenant = await createUser(Role.TENANT);
    expect(
      (await invite(w, await authCookie(otherTenant.id, otherTenant.role), { side: 'TENANT' }))
        .status,
    ).toBe(403);
  });

  it('sending again ends the old link, and stops after five emails for one witness', async () => {
    const w = await world();
    const agreement = await issued(w);
    const first = await seedWitness(agreement.id, 'LANDLORD');
    expect((await open(first.token)).status).toBe(200);

    const again = await invite(w, w.m, { side: 'LANDLORD', email: first.witness.email });
    expect(again.status).toBe(201);
    expect((await open(first.token)).status).toBe(404);

    for (let i = 0; i < 3; i++) {
      expect((await invite(w, w.m, { side: 'LANDLORD', email: first.witness.email })).status).toBe(
        201,
      );
    }
    const capped = await invite(w, w.m, { side: 'LANDLORD', email: first.witness.email });
    expect(capped.status).toBe(429);
    expect(capped.body.code).toBe('WITNESS_SEND_LIMIT');
    const row = await testPrisma.agreementWitness.findUniqueOrThrow({
      where: { id: first.witness.id },
    });
    expect(row.sendCount).toBe(5);
  });

  it('can take back a witness who has not signed, but not one who has', async () => {
    const w = await world();
    const agreement = await issued(w);
    const pending = await seedWitness(agreement.id, 'LANDLORD');
    const done = await seedWitness(agreement.id, 'TENANT', { status: 'SIGNED' });
    const del = (side: string, cookie = w.m) =>
      apiFetch(`${base(w)}/witnesses/${side}`, { method: 'DELETE', cookie });

    expect((await del('landlord')).status).toBe(200);
    expect((await open(pending.token)).status).toBe(404);
    expect((await del('landlord')).status).toBe(404);
    const signed = await del('tenant');
    expect(signed.status).toBe(409);
    expect(signed.body.code).toBe('WITNESS_ALREADY_SIGNED');
    expect(await testPrisma.agreementWitness.count({ where: { id: done.witness.id } })).toBe(1);
    expect((await del('landlord', w.t)).status).toBe(403);
    expect((await del('nobody')).status).toBe(400);
  });
});

describe('the witness’s own link', () => {
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
      witnessEsignEnabled: true,
      witnessesMustSign: false,
    });
  });

  it('shows the agreement to read without an account, and nothing that identifies the others', async () => {
    const w = await world();
    const agreement = await issued(w);
    const { token } = await seedWitness(agreement.id, 'LANDLORD');
    const res = await open(token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      state: 'READY',
      side: 'LANDLORD',
      tenantName: 'Ada Okafor',
    });
    expect(res.body.data.clauses.length).toBeGreaterThan(3);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(w.tenant.email);
    expect(text).not.toContain(w.tenant.id);
    expect(text).not.toMatch(/tokenHash/);
  });

  it('answers the same for a token that is unknown, malformed or too short', async () => {
    expect((await open('f'.repeat(64))).status).toBe(404);
    expect((await open('not-a-token')).status).toBe(404);
    expect((await witnessSign('a'.repeat(63))).status).toBe(404);
  });

  it('is gone once it has expired or the agreement was withdrawn', async () => {
    const w = await world();
    const agreement = await issued(w);
    const old = await seedWitness(agreement.id, 'LANDLORD', {
      expires: new Date(Date.now() - 1000),
    });
    const expired = await open(old.token);
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('LINK_EXPIRED');
    expect((await witnessSign(old.token)).status).toBe(410);

    const live = await seedWitness(agreement.id, 'TENANT');
    await testPrisma.rentAgreement.update({
      where: { id: agreement.id },
      data: { status: 'VOID', voidedAt: new Date() },
    });
    const withdrawn = await open(live.token);
    expect(withdrawn.status).toBe(410);
    expect(withdrawn.body.code).toBe('AGREEMENT_WITHDRAWN');
    expect((await witnessSign(live.token)).status).toBe(410);
  });

  it('records the signature with the typed name, the time and the address, once', async () => {
    const w = await world();
    const agreement = await issued(w);
    const { token, witness } = await seedWitness(agreement.id, 'LANDLORD');

    expect((await witnessSign(token, { confirm: false })).status).toBe(400);
    expect((await witnessSign(token, { fullName: '  ' })).status).toBe(400);
    expect((await witnessSign(token, { extra: 1 })).status).toBe(400);

    const res = await witnessSign(token, { fullName: 'Chidi Obi' });
    expect(res.status).toBe(201);
    const row = await testPrisma.agreementWitness.findUniqueOrThrow({ where: { id: witness.id } });
    expect(row).toMatchObject({ status: 'SIGNED', signedName: 'Chidi Obi' });
    expect(row.signedAt).not.toBeNull();
    expect(row.signedIp).toBeTruthy();

    const again = await witnessSign(token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_SIGNED');

    // After signing the link shows a thank-you, not the agreement.
    const after = await open(token);
    expect(after.body.data.state).toBe('SIGNED');
    expect(after.body.data.clauses).toBeUndefined();

    // The team and the tenant are told.
    for (const id of [w.manager.id, w.landlord.id, w.tenant.id]) {
      const got = await testPrisma.notification.findMany({
        where: { recipientId: id, title: 'A witness signed' },
      });
      expect(got).toHaveLength(1);
      expect(got[0].body).toContain('Chidi Obi');
    }
  });

  it('refuses a signature from another website', async () => {
    const w = await world();
    const agreement = await issued(w);
    const { token } = await seedWitness(agreement.id, 'LANDLORD');
    const res = await apiFetch(`/api/v1/witness/${token}`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: { fullName: 'Chidi Obi', confirm: true },
    });
    expect(res.status).toBe(403);
    const row = await testPrisma.agreementWitness.findFirstOrThrow({
      where: { agreementId: agreement.id },
    });
    expect(row.status).toBe('INVITED');
  });

  it('puts the witness’s signature on the agreement the parties read', async () => {
    const w = await world();
    const agreement = await issued(w);
    const { token } = await seedWitness(agreement.id, 'TENANT');
    await witnessSign(token, { fullName: 'Chidi Obi' });
    const view = await apiFetch(base(w), { cookie: w.t });
    const row = view.body.data.witnessSignatures.find((x: { side: string }) => x.side === 'TENANT');
    expect(row).toMatchObject({ status: 'SIGNED', signedName: 'Chidi Obi' });
  });
});

describe('an agreement that waits for its witnesses', () => {
  beforeAll(async () => {
    await resetDb();
    await seedPlans();
    await ensureDefaultAgreementData();
    templateId = (
      await testPrisma.agreementTemplate.findFirstOrThrow({ where: { key: 'lagos-residential' } })
    ).id;
  });

  const bothSign = async (w: World) => {
    expect((await sign(w, w.t, 'Ada Okafor')).status).toBe(201);
    expect((await sign(w, w.m, 'Bola Adeyemi')).status).toBe(201);
  };
  const state = async (w: World) => ({
    agreement: (await testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: w.rent.id } }))
      .status,
    signedAt: (await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } }))
      .agreementSignedAt,
    rent: (await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status,
  });

  it('is executed on the parties’ signatures when the admin does not make it wait', async () => {
    await setSystemSettings({
      id: 'global',
      agreementTemplatesNeedApproval: false,
      witnessEsignEnabled: true,
      witnessesMustSign: false,
      rentActivationRule: 'INDEPENDENT',
    });
    const w = await world();
    await issued(w);
    await bothSign(w);
    const s = await state(w);
    expect(s.agreement).toBe('EXECUTED');
    expect(s.signedAt).not.toBeNull();
  });

  it('stays open until a witness on each side has signed, then executes and starts the rent', async () => {
    await setSystemSettings({
      id: 'global',
      agreementTemplatesNeedApproval: false,
      witnessEsignEnabled: true,
      witnessesMustSign: true,
      rentActivationRule: 'AFTER_BOTH_SIGN',
    });
    const w = await world();
    const agreement = await issued(w);
    await bothSign(w);

    let s = await state(w);
    expect(s).toMatchObject({ agreement: 'ISSUED', signedAt: null, rent: 'PENDING' });
    const waiting = await testPrisma.notification.findMany({
      where: { recipientId: w.tenant.id, title: 'Signed: waiting for witnesses' },
    });
    expect(waiting).toHaveLength(1);

    const landlordSide = await seedWitness(agreement.id, 'LANDLORD');
    const tenantSide = await seedWitness(agreement.id, 'TENANT');
    await witnessSign(landlordSide.token);
    s = await state(w);
    expect(s).toMatchObject({ agreement: 'ISSUED', signedAt: null, rent: 'PENDING' });

    await witnessSign(tenantSide.token);
    s = await state(w);
    expect(s.agreement).toBe('EXECUTED');
    expect(s.signedAt).not.toBeNull();
    expect(s.rent).toBe('ACTIVE');
    const executed = await testPrisma.rentAgreement.findFirstOrThrow({
      where: { rentId: w.rent.id },
    });
    expect(executed.executedAt).not.toBeNull();
    const told = await testPrisma.notification.findMany({
      where: { recipientId: w.tenant.id, title: 'Rent fully signed' },
    });
    expect(told).toHaveLength(1);
  });

  it('lets the witnesses sign before the parties do', async () => {
    await setSystemSettings({
      id: 'global',
      agreementTemplatesNeedApproval: false,
      witnessEsignEnabled: true,
      witnessesMustSign: true,
      rentActivationRule: 'INDEPENDENT',
    });
    const w = await world();
    const agreement = await issued(w);
    await witnessSign((await seedWitness(agreement.id, 'LANDLORD')).token);
    await witnessSign((await seedWitness(agreement.id, 'TENANT')).token);
    expect((await state(w)).agreement).toBe('ISSUED');
    await bothSign(w);
    expect((await state(w)).agreement).toBe('EXECUTED');
  });

  it('does not wait when e-signing is off, even if the wait is on', async () => {
    await setSystemSettings({
      id: 'global',
      agreementTemplatesNeedApproval: false,
      witnessEsignEnabled: false,
      witnessesMustSign: true,
      rentActivationRule: 'INDEPENDENT',
    });
    const w = await world();
    await issued(w);
    await bothSign(w);
    expect((await state(w)).agreement).toBe('EXECUTED');
  });

  it('executes once when the last two signatures arrive together', async () => {
    await setSystemSettings({
      id: 'global',
      agreementTemplatesNeedApproval: false,
      witnessEsignEnabled: true,
      witnessesMustSign: true,
      rentActivationRule: 'AFTER_BOTH_SIGN',
    });
    const w = await world();
    const agreement = await issued(w);
    await sign(w, w.t, 'Ada Okafor');
    const landlordSide = await seedWitness(agreement.id, 'LANDLORD');
    const tenantSide = await seedWitness(agreement.id, 'TENANT');
    await witnessSign(landlordSide.token);
    await Promise.all([
      sign(w, w.m, 'Bola Adeyemi'),
      witnessSign(tenantSide.token, { fullName: 'Tunde Ojo' }),
    ]);
    const s = await state(w);
    expect(s).toMatchObject({ agreement: 'EXECUTED', rent: 'ACTIVE' });
    expect(
      await testPrisma.notification.count({
        where: { recipientId: w.tenant.id, title: 'Rent fully signed' },
      }),
    ).toBeLessThanOrEqual(2);
  });
});

describe('the admin’s witness settings', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('are changed through the platform settings, with limits on the link days', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const patch = (body: unknown) =>
      apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie, body });
    const ok = await patch({
      witnessEsignEnabled: false,
      witnessesMustSign: true,
      witnessLinkDays: 30,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      witnessEsignEnabled: false,
      witnessesMustSign: true,
      witnessLinkDays: 30,
    });
    expect((await patch({ witnessLinkDays: 0 })).status).toBe(400);
    expect((await patch({ witnessLinkDays: 91 })).status).toBe(400);
    expect((await patch({ witnessLinkDays: 1.5 })).status).toBe(400);
    const manager = await createUser(Role.MANAGER);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await authCookie(manager.id, manager.role),
          body: { witnessEsignEnabled: true },
        })
      ).status,
    ).toBe(403);
  });
});
