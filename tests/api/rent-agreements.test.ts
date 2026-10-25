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

// Owner decisions of 2026-10-23: a manager can make a rent agreement from a template (the admin
// decides which are usable), or upload one they already have; the tenant signs or confirms it; the
// admin decides whether making one costs credits and whether the rent starts when both have signed.

const PDF = new TextEncoder().encode('%PDF-1.4 test agreement');

let templateId = '';
let n = 0;

async function world(over: { landlord?: boolean; frequency?: 'ANNUAL' | 'MONTHLY' } = {}) {
  const manager = await createUser(Role.MANAGER, { name: 'Bola Adeyemi' });
  const landlord =
    over.landlord === false ? null : await createUser(Role.LANDLORD, { name: 'Mr Bello' });
  const tenant = await createUser(Role.TENANT, {
    name: 'Ada Okafor',
    email: `ada-${++n}@agree.test`,
  });
  const property = await createProperty({
    managerId: manager.id,
    landlordId: landlord?.id ?? null,
    name: `Agreement Court ${n}`,
  });
  const unit = await createUnit(property.id, { unitNumber: `A${n}` });
  const rent = await createRent(unit.id, tenant.id, {
    status: 'PENDING',
    rentAmount: 2_500_000,
    paymentFrequency: over.frequency ?? 'ANNUAL',
    startDate: new Date('2026-12-01T00:00:00Z'),
    endDate: new Date('2027-11-30T00:00:00Z'),
    deposit: 250_000,
  });
  return {
    manager,
    landlord,
    tenant,
    property,
    unit,
    rent,
    m: await authCookie(manager.id, manager.role),
    l: landlord ? await authCookie(landlord.id, landlord.role) : '',
    t: await authCookie(tenant.id, tenant.role),
  };
}
type World = Awaited<ReturnType<typeof world>>;

const base = (w: World) => `/api/v1/rents/${w.rent.id}/agreement`;
const generate = (w: World, body: Record<string, unknown> = {}, cookie = w.m) =>
  apiFetch(base(w), {
    method: 'POST',
    cookie,
    body: { source: 'GENERATED', templateId, ...body },
  });
const post = (w: World, path: string, cookie: string, body?: unknown) =>
  apiFetch(`${base(w)}/${path}`, { method: 'POST', cookie, body: body ?? {} });
const sign = (w: World, cookie: string, fullName: string) =>
  apiFetch(`/api/v1/rents/${w.rent.id}/sign`, { method: 'POST', cookie, body: { fullName } });

async function uploadFile(cookie: string, folder = 'rents') {
  const sign = await apiFetch('/api/v1/uploads/sign', {
    method: 'POST',
    cookie,
    body: {
      folder,
      fileName: 'agreement.pdf',
      contentType: 'application/pdf',
      size: PDF.byteLength,
    },
  });
  const form = new FormData();
  form.append('fileId', sign.body.data.plan.fileId);
  form.append('file', new Blob([PDF as unknown as BlobPart], { type: 'application/pdf' }), 'a.pdf');
  await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie, body: form });
  return sign.body.data.file.url as string;
}

const notes = (userId: string) =>
  testPrisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'asc' },
  });
const balance = async (userId: string) =>
  (await testPrisma.creditEntry.aggregate({ where: { userId }, _sum: { delta: true } }))._sum
    .delta ?? 0;

describe('making an agreement from a template', () => {
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
      agreementLandlordNameByManager: true,
      agreementAgencyFee: true,
      agreementLegalFee: true,
      agreementCautionFee: true,
      rentActivationRule: 'INDEPENDENT',
      chargeForAgreements: false,
      chargeForUploads: false,
    });
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMaxMonths: 12, advanceRentMode: 'WARN' },
    });
  });

  it('offers only approved templates while approval is required, and the facts the form needs', async () => {
    const w = await world();
    await setSystemSettings({ id: 'global', agreementTemplatesNeedApproval: true });
    const none = await apiFetch(`${base(w)}/options`, { cookie: w.m });
    expect(none.status).toBe(200);
    expect(none.body.data.templates).toEqual([]);
    expect(none.body.data.jurisdiction).toMatchObject({
      name: 'Lagos State',
      lawyerReviewed: false,
    });

    await testPrisma.agreementTemplate.update({
      where: { id: templateId },
      data: { status: 'APPROVED' },
    });
    const some = await apiFetch(`${base(w)}/options`, { cookie: w.m });
    expect(some.body.data.templates.map((t: { key: string }) => t.key)).toContain(
      'lagos-residential',
    );
    expect(some.body.data.landlord).toMatchObject({ hasAccount: true, name: 'Mr Bello' });
    expect(some.body.data.offers).toEqual({ caution: true, agency: true, legal: true });
    expect(some.body.data.credits).toMatchObject({ generateCost: 0, uploadCost: 0 });
    await testPrisma.agreementTemplate.update({
      where: { id: templateId },
      data: { status: 'DRAFT' },
    });

    const refused = await generate(w);
    expect(refused.status).toBe(422);
    expect(refused.body.code).toBe('TEMPLATE_NOT_AVAILABLE');
  });

  it('previews the text without saving it, with the rent filled in', async () => {
    const w = await world();
    const res = await apiFetch(`${base(w)}/preview`, {
      method: 'POST',
      cookie: w.m,
      body: { templateId, agencyFee: 125_000, specialConditions: 'No pets.' },
    });
    expect(res.status).toBe(200);
    const text = res.body.data.clauses.map((c: { body: string }) => c.body).join('\n');
    expect(text).toContain('Ada Okafor');
    expect(text).toContain('Mr Bello, represented by their agent Bola Adeyemi (the Landlord)');
    expect(text).toContain('₦2,500,000 (Two Million, Five Hundred Thousand Naira) per annum');
    expect(text).toContain('12 months, starting on 1 December 2026 and ending on 30 November 2027');
    expect(text).toContain('caution deposit of ₦250,000');
    expect(text).toContain('agency fee of ₦125,000');
    expect(text).not.toContain('{{');
    expect(res.body.data.specialConditions).toBe('No pets.');
    expect(await testPrisma.rentAgreement.count()).toBe(0);
  });

  it('saves a draft the tenant cannot see, keeping a snapshot of the text', async () => {
    const w = await world();
    const res = await generate(w, { specialConditions: 'The tenant may keep one cat.' });
    expect(res.status).toBe(201);
    const a = res.body.data;
    expect(a).toMatchObject({
      source: 'GENERATED',
      status: 'DRAFT',
      templateKey: 'lagos-residential',
      templateVersion: 1,
      landlordName: 'Mr Bello',
      agentName: 'Bola Adeyemi',
      specialConditions: 'The tenant may keep one cat.',
    });
    expect(a.clauses.length).toBeGreaterThan(10);
    expect(JSON.stringify(a.clauses)).not.toContain('{{');

    expect((await apiFetch(base(w), { cookie: w.t })).body.data).toBeNull();
    expect((await apiFetch(base(w), { cookie: w.m })).body.data.id).toBe(a.id);
    expect(await notes(w.tenant.id)).toHaveLength(0);

    // Changing the template afterwards never reaches the agreement already made.
    try {
      await testPrisma.agreementTemplate.update({
        where: { id: templateId },
        data: { clauses: [{ id: 'x', title: 'Changed', body: 'Changed.', mode: 'LOCKED' }] },
      });
      const again = (await apiFetch(base(w), { cookie: w.m })).body.data;
      expect(again.clauses.length).toBeGreaterThan(10);
    } finally {
      await ensureTemplateRestored();
    }
  });

  it('asks the manager to type the owner’s name when the property has no landlord account, unless the admin turned that off', async () => {
    const w = await world({ landlord: false });
    const missing = await generate(w);
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe('LANDLORD_NAME_REQUIRED');

    const typed = await generate(w, { landlordName: 'Chief Obi' });
    expect(typed.status).toBe(201);
    expect(typed.body.data.landlordName).toBe('Chief Obi');
    expect(typed.body.data.agentName).toBe('Bola Adeyemi');

    const w2 = await world({ landlord: false });
    await setSystemSettings({ id: 'global', agreementLandlordNameByManager: false });
    const off = await generate(w2, { landlordName: 'Chief Obi' });
    expect(off.status).toBe(422);
    expect(off.body.code).toBe('LANDLORD_REQUIRED');
  });

  it('leaves out the agent when the landlord makes their own agreement', async () => {
    const w = await world();
    const res = await generate(w, {}, w.l);
    expect(res.status).toBe(201);
    expect(res.body.data.agentName).toBeNull();
    expect(JSON.stringify(res.body.data.clauses)).not.toContain('represented by');
  });

  it('applies the manager’s choices: optional clauses out or in, editable ones reworded, locked ones untouched', async () => {
    const w = await world();
    const ok = await generate(w, {
      choices: {
        omit: ['alterations'],
        include: ['renewal'],
        edits: { use: 'Home use only, with a home office allowed.' },
      },
    });
    expect(ok.status).toBe(201);
    const ids = ok.body.data.clauses.map((c: { id: string }) => c.id);
    expect(ids).not.toContain('alterations');
    expect(ids).toContain('renewal');
    expect(ok.body.data.clauses.find((c: { id: string }) => c.id === 'use').body).toBe(
      'Home use only, with a home office allowed.',
    );

    for (const choices of [
      { edits: { rent: 'Free rent.' } },
      { omit: ['rent'] },
      { include: ['use'] },
      { edits: { nonexistent: 'x' } },
    ]) {
      const w2 = await world();
      const bad = await generate(w2, { choices });
      expect(bad.status, JSON.stringify(choices)).toBe(400);
      expect(bad.body.code).toBe('BAD_CHOICES');
    }

    const w3 = await world();
    const typo = await generate(w3, { choices: { edits: { use: 'Used by {{tenantNaem}}.' } } });
    expect(typo.status).toBe(422);
    expect(typo.body.code).toBe('UNKNOWN_FIELD');
  });

  it('offers the fees the admin allows and only those', async () => {
    const w = await world();
    await setSystemSettings({ id: 'global', agreementAgencyFee: false });
    const refused = await generate(w, { agencyFee: 100_000 });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('FEE_NOT_OFFERED');

    const ok = await generate(w, { legalFee: 50_000 });
    expect(ok.status).toBe(201);
    const text = ok.body.data.clauses.map((c: { body: string }) => c.body).join('\n');
    expect(text).toContain('legal fee of ₦50,000');
    expect(text).toContain('agency fee of nil');

    await setSystemSettings({ id: 'global', agreementCautionFee: false });
    const w2 = await world();
    const noCaution = await generate(w2);
    expect(noCaution.body.data.clauses.map((c: { body: string }) => c.body).join('\n')).toContain(
      'caution deposit of nil',
    );
  });

  it('holds one agreement per rent: a second is refused until the first is withdrawn', async () => {
    const w = await world();
    expect((await generate(w)).status).toBe(201);
    const again = await generate(w);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('AGREEMENT_EXISTS');

    expect((await post(w, 'void', w.m, { reason: 'Wrong template' })).status).toBe(200);
    expect((await generate(w)).status).toBe(201);
    expect(await testPrisma.rentAgreement.count({ where: { rentId: w.rent.id } })).toBe(2);

    const w2 = await world();
    const results = await Promise.all([generate(w2), generate(w2), generate(w2)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  }, 60_000);

  it('can be edited while a draft, and only its witnesses once sent', async () => {
    const w = await world();
    const a = (await generate(w)).body.data;
    const edited = await apiFetch(base(w), {
      method: 'PATCH',
      cookie: w.m,
      body: {
        specialConditions: 'Parking space B2 is included.',
        choices: { omit: ['late-payment'] },
        witnesses: { landlord: { name: 'Tunde A', address: '1 Road' } },
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.specialConditions).toBe('Parking space B2 is included.');
    expect(edited.body.data.clauses.map((c: { id: string }) => c.id)).not.toContain('late-payment');
    expect(edited.body.data.witnesses.landlord.name).toBe('Tunde A');
    expect(edited.body.data.id).toBe(a.id);

    expect((await post(w, 'issue', w.m)).status).toBe(200);
    const late = await apiFetch(base(w), {
      method: 'PATCH',
      cookie: w.m,
      body: { specialConditions: 'Sneaky change.' },
    });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('NOT_DRAFT');
    const witnesses = await apiFetch(base(w), {
      method: 'PATCH',
      cookie: w.m,
      body: { witnesses: { tenant: { name: 'Chinwe', address: '2 Street' } } },
    });
    expect(witnesses.status).toBe(200);
    expect(witnesses.body.data.witnesses.tenant.name).toBe('Chinwe');
  });

  it('is sent to the tenant by issuing it, who is told, and who then sees the same text', async () => {
    const w = await world();
    const draft = (await generate(w)).body.data;
    const issued = await post(w, 'issue', w.m);
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe('ISSUED');

    const titles = (await notes(w.tenant.id)).map((x) => x.title);
    expect(titles).toContain('Rent agreement ready to sign');

    const seen = await apiFetch(base(w), { cookie: w.t });
    expect(seen.status).toBe(200);
    expect(seen.body.data.id).toBe(draft.id);
    expect(seen.body.data.clauses).toEqual(draft.clauses);
    // The tenant never sees the property team's internals.
    expect(seen.body.data).not.toHaveProperty('creditsCharged');
    expect(seen.body.data).not.toHaveProperty('choices');

    expect((await post(w, 'issue', w.m)).status).toBe(409);
  });

  it('is signed by both sides, which executes it; the rent starts only if the admin’s rule says so', async () => {
    const independent = await world();
    await generate(independent);
    await post(independent, 'issue', independent.m);
    expect((await sign(independent, independent.t, 'Ada Okafor')).status).toBe(201);
    expect(
      (await testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: independent.rent.id } }))
        .status,
    ).toBe('ISSUED');
    expect((await sign(independent, independent.m, 'Bola Adeyemi')).status).toBe(201);
    const done = await testPrisma.rentAgreement.findFirstOrThrow({
      where: { rentId: independent.rent.id },
    });
    expect(done.status).toBe('EXECUTED');
    expect(done.executedAt).not.toBeNull();
    const rentAfter = await testPrisma.rent.findUniqueOrThrow({
      where: { id: independent.rent.id },
    });
    expect(rentAfter.agreementSignedAt).not.toBeNull();
    expect(rentAfter.status).toBe('PENDING');

    await setSystemSettings({ id: 'global', rentActivationRule: 'AFTER_BOTH_SIGN' });
    const w = await world();
    await generate(w);
    await post(w, 'issue', w.m);
    await sign(w, w.t, 'Ada Okafor');
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'PENDING',
    );
    await sign(w, w.l, 'Mr Bello');
    const started = await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } });
    expect(started.status).toBe('ACTIVE');
    expect((await testPrisma.unit.findUniqueOrThrow({ where: { id: w.unit.id } })).status).toBe(
      'OCCUPIED',
    );
  });

  it('puts the agreement in the tenant’s needs-your-attention list only once it has been sent', async () => {
    const attention = async (w: World) =>
      (await apiFetch('/api/v1/dashboard/attention', { cookie: w.t })).body.data.map(
        (r: { id: string }) => r.id,
      );
    const w = await world();
    // A pending rent with no agreement is the plain "rent to sign".
    expect(await attention(w)).toContain('rent-to-sign');
    await generate(w);
    expect(await attention(w)).not.toContain('rent-to-sign');
    await post(w, 'issue', w.m);
    expect(await attention(w)).toContain('rent-to-sign');

    // A rent that is already running is waiting on the tenant too, if its agreement was uploaded.
    const running = await world();
    await testPrisma.rent.update({ where: { id: running.rent.id }, data: { status: 'ACTIVE' } });
    expect(await attention(running)).not.toContain('rent-to-sign');
    await apiFetch(base(running), {
      method: 'POST',
      cookie: running.m,
      body: { source: 'UPLOADED', fileUrl: await uploadFile(running.m) },
    });
    expect(await attention(running)).toContain('rent-to-sign');
    await post(running, 'confirm', running.t, { fullName: 'Ada Okafor' });
    expect(await attention(running)).not.toContain('rent-to-sign');
  });

  it('keeps signing out of a draft, and out of an uploaded agreement', async () => {
    const w = await world();
    await generate(w);
    const early = await sign(w, w.t, 'Ada Okafor');
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('AGREEMENT_DRAFT');

    const u = await world();
    const fileUrl = await uploadFile(u.m);
    const up = await apiFetch(base(u), {
      method: 'POST',
      cookie: u.m,
      body: { source: 'UPLOADED', fileUrl },
    });
    expect(up.status).toBe(201);
    const blocked = await sign(u, u.t, 'Ada Okafor');
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('USE_CONFIRMATION');
  });

  it('does not start a pending rent by hand before it is signed when the rule is "after both sign"', async () => {
    await setSystemSettings({ id: 'global', rentActivationRule: 'AFTER_BOTH_SIGN' });
    const w = await world();
    const early = await apiFetch(`/api/v1/rents/${w.rent.id}`, {
      method: 'PATCH',
      cookie: w.m,
      body: { status: 'ACTIVE' },
    });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('AGREEMENT_NOT_SIGNED');

    const admin = await createUser(Role.ADMIN);
    const byAdmin = await apiFetch(`/api/v1/rents/${w.rent.id}`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'ACTIVE' },
    });
    expect(byAdmin.status).toBe(200);

    await setSystemSettings({ id: 'global', rentActivationRule: 'INDEPENDENT' });
    const w2 = await world();
    const free = await apiFetch(`/api/v1/rents/${w2.rent.id}`, {
      method: 'PATCH',
      cookie: w2.m,
      body: { status: 'ACTIVE' },
    });
    expect(free.status).toBe(200);
  });

  it('applies the place’s advance-rent rule: a warning goes through, a block stops it', async () => {
    const w = await world();
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMaxMonths: 6, advanceRentMode: 'WARN' },
    });
    const warn = await generate(w);
    expect(warn.status).toBe(201);
    expect(warn.body.findings[0]).toMatchObject({ rule: 'ADVANCE_RENT', mode: 'WARN' });
    expect((await apiFetch(base(w), { cookie: w.m })).body.findings).toHaveLength(1);
    await post(w, 'void', w.m);

    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMode: 'BLOCK' },
    });
    const blocked = await generate(w);
    expect(blocked.status).toBe(422);
    expect(blocked.body.code).toBe('TENANCY_RULE');
    expect(blocked.body.findings[0].message).toContain('6 months');

    // A monthly payer is under the cap.
    const monthly = await world({ frequency: 'MONTHLY' });
    expect((await generate(monthly)).status).toBe(201);

    // The same rule stops a rent being created in the first place.
    const unit = await createUnit(w.property.id);
    const tenant = await createUser(Role.TENANT, { email: `new-${++n}@agree.test` });
    const body = {
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: '2026-12-01',
      endDate: '2027-11-30',
      rentAmount: 3_000_000,
      deposit: 0,
    };
    const rentBlocked = await apiFetch('/api/v1/rents', { method: 'POST', cookie: w.m, body });
    expect(rentBlocked.status).toBe(422);
    expect(rentBlocked.body.code).toBe('TENANCY_RULE');
    expect(await testPrisma.rent.count({ where: { unitId: unit.id } })).toBe(0);

    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { advanceRentMode: 'WARN' },
    });
    const rentWarned = await apiFetch('/api/v1/rents', { method: 'POST', cookie: w.m, body });
    expect(rentWarned.status).toBe(201);
    expect(rentWarned.body.data.warnings[0].rule).toBe('ADVANCE_RENT');
  });

  it('refuses people who do not look after the property, and tenants making or sending one', async () => {
    const w = await world();
    const stranger = await createUser(Role.MANAGER);
    const other = await authCookie(stranger.id, stranger.role);
    expect((await generate(w, {}, other)).status).toBe(403);
    expect((await apiFetch(`${base(w)}/options`, { cookie: other })).status).toBe(403);
    expect((await apiFetch(base(w), { cookie: other })).status).toBe(403);
    expect((await generate(w, {}, w.t)).status).toBe(403);
    const otherTenant = await createUser(Role.TENANT);
    expect(
      (await apiFetch(base(w), { cookie: await authCookie(otherTenant.id, otherTenant.role) }))
        .status,
    ).toBe(403);
    const vendor = await createUser(Role.VENDOR);
    expect(
      (await apiFetch(base(w), { cookie: await authCookie(vendor.id, vendor.role) })).status,
    ).toBe(403);
    expect(await testPrisma.rentAgreement.count({ where: { rentId: w.rent.id } })).toBe(0);
  });

  it('refuses a rent that has ended', async () => {
    const w = await world();
    await testPrisma.rent.update({ where: { id: w.rent.id }, data: { status: 'TERMINATED' } });
    const res = await generate(w);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RENT_ENDED');
  });
});

describe('uploading an agreement that already exists', () => {
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
      rentActivationRule: 'INDEPENDENT',
      chargeForAgreements: false,
      chargeForUploads: false,
    });
  });

  const upload = async (w: World) => {
    const fileUrl = await uploadFile(w.m);
    const res = await apiFetch(base(w), {
      method: 'POST',
      cookie: w.m,
      body: { source: 'UPLOADED', fileUrl },
    });
    return { fileUrl, res };
  };

  it('goes straight to the tenant, who confirms it with their name; then it is the rent’s signed agreement', async () => {
    const w = await world();
    const { fileUrl, res } = await upload(w);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ source: 'UPLOADED', status: 'ISSUED', fileUrl });
    expect((await notes(w.tenant.id)).map((x) => x.title)).toContain('Rent agreement to confirm');

    const file = (url: string, cookie: string) => apiFetch(url, { cookie });
    expect((await file(fileUrl, w.t)).status).toBe(200);
    const stranger = await createUser(Role.TENANT);
    expect((await file(fileUrl, await authCookie(stranger.id, stranger.role))).status).toBe(404);
    expect((await file(fileUrl, w.l)).status).toBe(200);

    const confirm = await post(w, 'confirm', w.t, { fullName: 'Ada N. Okafor' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe('EXECUTED');

    const a = await testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: w.rent.id } });
    expect(a).toMatchObject({ status: 'EXECUTED', confirmedName: 'Ada N. Okafor' });
    expect(a.confirmedAt).not.toBeNull();
    const rent = await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } });
    expect(rent.signedAgreementUrl).toBe(fileUrl);
    expect(rent.agreementSignedAt).not.toBeNull();
    expect(rent.status).toBe('PENDING');
    const sig = await testPrisma.rentSignature.findFirstOrThrow({ where: { rentId: w.rent.id } });
    expect(sig).toMatchObject({
      signerId: w.tenant.id,
      signerRole: 'TENANT',
      fullNameTyped: 'Ada N. Okafor',
    });

    expect((await post(w, 'confirm', w.t, { fullName: 'Ada Okafor' })).status).toBe(409);
    expect((await notes(w.manager.id)).map((x) => x.title)).toContain(
      'Tenant confirmed the rent agreement',
    );
  });

  it('starts the rent on confirmation when the admin’s rule says so', async () => {
    await setSystemSettings({ id: 'global', rentActivationRule: 'AFTER_BOTH_SIGN' });
    const w = await world();
    await upload(w);
    await post(w, 'confirm', w.t, { fullName: 'Ada Okafor' });
    expect((await testPrisma.rent.findUniqueOrThrow({ where: { id: w.rent.id } })).status).toBe(
      'ACTIVE',
    );
    expect((await testPrisma.unit.findUniqueOrThrow({ where: { id: w.unit.id } })).status).toBe(
      'OCCUPIED',
    );
  });

  it('lets only the tenant of that rent confirm, only an uploaded agreement that was sent, and needs a name', async () => {
    const w = await world();
    await upload(w);
    expect((await post(w, 'confirm', w.m, { fullName: 'Bola' })).status).toBe(403);
    const other = await createUser(Role.TENANT);
    expect(
      (await post(w, 'confirm', await authCookie(other.id, other.role), { fullName: 'X' })).status,
    ).toBe(404);
    expect((await post(w, 'confirm', w.t, { fullName: '  ' })).status).toBe(400);

    const g = await world();
    await generate(g, {}, g.m);
    expect((await post(g, 'confirm', g.t, { fullName: 'Ada Okafor' })).status).toBe(409);
  });

  it('accepts only a file uploaded by the manager, not an arbitrary link or someone else’s file', async () => {
    const w = await world();
    const link = await apiFetch(base(w), {
      method: 'POST',
      cookie: w.m,
      body: { source: 'UPLOADED', fileUrl: 'https://example.com/a.pdf' },
    });
    expect(link.status).toBe(400);
    expect(link.body.code).toBe('BAD_FILE');

    const theirs = await uploadFile(w.t);
    const stolen = await apiFetch(base(w), {
      method: 'POST',
      cookie: w.m,
      body: { source: 'UPLOADED', fileUrl: theirs },
    });
    expect(stolen.status).toBe(400);
    expect(await testPrisma.rentAgreement.count({ where: { rentId: w.rent.id } })).toBe(0);
  });

  it('can be withdrawn before it is confirmed, and the tenant is told not to sign it', async () => {
    const w = await world();
    await upload(w);
    const voided = await post(w, 'void', w.m, { reason: 'Wrong file' });
    expect(voided.status).toBe(200);
    expect((await notes(w.tenant.id)).map((x) => x.title)).toContain('Rent agreement withdrawn');
    expect((await apiFetch(base(w), { cookie: w.t })).body.data).toBeNull();
    expect((await post(w, 'confirm', w.t, { fullName: 'Ada Okafor' })).status).toBe(409);
  });
});

describe('withdrawing and the credit charge', () => {
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
      chargeForAgreements: true,
      chargeForUploads: false,
      rentActivationRule: 'INDEPENDENT',
    });
  });

  it('takes the service’s credits to make an agreement, and stops cleanly with none', async () => {
    const w = await world();
    expect(await balance(w.manager.id)).toBe(0);
    const poor = await generate(w);
    expect(poor.status).toBe(402);
    expect(poor.body.code).toBe('INSUFFICIENT_CREDITS');
    expect(await testPrisma.rentAgreement.count({ where: { rentId: w.rent.id } })).toBe(0);

    const options = await apiFetch(`${base(w)}/options`, { cookie: w.m });
    expect(options.body.data.credits).toMatchObject({ generateCost: 1, uploadCost: 0, balance: 0 });

    await testPrisma.creditEntry.create({
      data: { userId: w.manager.id, delta: 3, reason: 'ADMIN_GRANT' },
    });
    const ok = await generate(w);
    expect(ok.status).toBe(201);
    expect(ok.body.data.creditsCharged).toBe(1);
    expect(await balance(w.manager.id)).toBe(2);
    expect(
      await testPrisma.creditEntry.count({
        where: { userId: w.manager.id, reason: 'SPEND', serviceKey: 'rent_agreement' },
      }),
    ).toBe(1);
    // Editing the draft costs nothing more.
    await apiFetch(base(w), { method: 'PATCH', cookie: w.m, body: { specialConditions: 'x' } });
    expect(await balance(w.manager.id)).toBe(2);
  });

  it('gives the credits back when a draft that was never sent is withdrawn, but not for one the tenant saw', async () => {
    const w = await world();
    await testPrisma.creditEntry.create({
      data: { userId: w.manager.id, delta: 5, reason: 'ADMIN_GRANT' },
    });
    await generate(w);
    expect(await balance(w.manager.id)).toBe(4);
    const voided = await post(w, 'void', w.m);
    expect(voided.body.data.refunded).toBe(1);
    expect(await balance(w.manager.id)).toBe(5);

    await generate(w);
    await post(w, 'issue', w.m);
    expect(await balance(w.manager.id)).toBe(4);
    const second = await post(w, 'void', w.m);
    expect(second.body.data.refunded).toBe(0);
    expect(await balance(w.manager.id)).toBe(4);
  });

  it('takes the credits once when three requests arrive together', async () => {
    const w = await world();
    await testPrisma.creditEntry.create({
      data: { userId: w.manager.id, delta: 5, reason: 'ADMIN_GRANT' },
    });
    const results = await Promise.all([generate(w), generate(w), generate(w)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await balance(w.manager.id)).toBe(4);
  }, 60_000);

  it('does not charge an admin, charges uploads only when asked, and spends the company’s shared credits', async () => {
    const w = await world();
    const admin = await createUser(Role.ADMIN);
    const adminRes = await generate(w, {}, await authCookie(admin.id, admin.role));
    expect(adminRes.status).toBe(201);
    expect(adminRes.body.data.creditsCharged).toBe(0);

    const u = await world();
    const free = await apiFetch(base(u), {
      method: 'POST',
      cookie: u.m,
      body: { source: 'UPLOADED', fileUrl: await uploadFile(u.m) },
    });
    expect(free.status).toBe(201);
    expect(free.body.data.creditsCharged).toBe(0);

    await setSystemSettings({ id: 'global', chargeForUploads: true });
    const c = await world();
    const poor = await apiFetch(base(c), {
      method: 'POST',
      cookie: c.m,
      body: { source: 'UPLOADED', fileUrl: await uploadFile(c.m) },
    });
    expect(poor.status).toBe(402);

    // A team member spends their partner's credits.
    const partner = await createUser(Role.MANAGER);
    const org = await testPrisma.organisation.create({
      data: { name: 'Firm', ownerId: partner.id },
    });
    await testPrisma.user.update({ where: { id: partner.id }, data: { organisationId: org.id } });
    const member = await createUser(Role.MANAGER, { organisationId: org.id });
    await testPrisma.creditEntry.create({
      data: { userId: partner.id, delta: 2, reason: 'ADMIN_GRANT' },
    });
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: member.id, landlordId: null });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { status: 'PENDING' });
    const res = await apiFetch(`/api/v1/rents/${rent.id}/agreement`, {
      method: 'POST',
      cookie: await authCookie(member.id, member.role),
      body: { source: 'GENERATED', templateId, landlordName: 'Owner Name' },
    });
    expect(res.status).toBe(201);
    expect(await balance(partner.id)).toBe(1);
    const spend = await testPrisma.creditEntry.findFirstOrThrow({
      where: { userId: partner.id, reason: 'SPEND' },
    });
    expect(spend.createdById).toBe(member.id);
  });

  it('cannot withdraw a signed agreement, or one somebody has already signed', async () => {
    await setSystemSettings({ id: 'global', chargeForAgreements: false });
    const w = await world();
    await generate(w);
    await post(w, 'issue', w.m);
    await sign(w, w.t, 'Ada Okafor');
    const partly = await post(w, 'void', w.m);
    expect(partly.status).toBe(409);
    expect(partly.body.code).toBe('HAS_SIGNATURES');
    await sign(w, w.l, 'Mr Bello');
    const done = await post(w, 'void', w.m);
    expect(done.status).toBe(409);
    expect(['EXECUTED', 'HAS_SIGNATURES']).toContain(done.body.code);
    expect(
      (await testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: w.rent.id } })).status,
    ).toBe('EXECUTED');
  });
});

describe('tracking stamp duty', () => {
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
      chargeForAgreements: false,
    });
  });

  const stamp = (w: World, body: unknown, cookie = w.m) =>
    apiFetch(`${base(w)}/stamp-duty`, { method: 'PATCH', cookie, body });

  it('records progress, the reference, the amount and the receipt once the agreement has been sent', async () => {
    const w = await world();
    await generate(w);
    const early = await stamp(w, { status: 'IN_PROGRESS' });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('NOT_SENT');
    await post(w, 'issue', w.m);

    const started = await stamp(w, {
      status: 'IN_PROGRESS',
      reference: 'FIRS-123',
      amount: 19_500,
    });
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({
      stampDutyStatus: 'IN_PROGRESS',
      stampDutyReference: 'FIRS-123',
      stampDutyAmount: 19_500,
      stampedAt: null,
    });

    const receipt = await uploadFile(w.m);
    const done = await stamp(w, { status: 'STAMPED', receiptUrl: receipt });
    expect(done.status).toBe(200);
    expect(done.body.data.stampDutyStatus).toBe('STAMPED');
    expect(done.body.data.stampedAt).not.toBeNull();
    expect(done.body.data.stampDutyReceiptUrl).toBe(receipt);
    // The tenant can read the receipt once the agreement was sent to them.
    expect((await apiFetch(receipt, { cookie: w.t })).status).toBe(200);

    const back = await stamp(w, { status: 'IN_PROGRESS' });
    expect(back.body.data.stampedAt).toBeNull();
    expect(
      await testPrisma.auditLog.count({
        where: { action: 'RENT_AGREEMENT_STAMP_DUTY_UPDATED', entityId: done.body.data.id },
      }),
    ).toBe(3);
  });

  it('is for the property team only, and takes only an uploaded file as a receipt', async () => {
    const w = await world();
    await generate(w);
    await post(w, 'issue', w.m);
    expect((await stamp(w, { status: 'STAMPED' }, w.t)).status).toBe(403);
    const stranger = await createUser(Role.MANAGER);
    expect(
      (await stamp(w, { status: 'STAMPED' }, await authCookie(stranger.id, stranger.role))).status,
    ).toBe(403);
    const link = await stamp(w, { receiptUrl: 'https://example.com/r.pdf' });
    expect(link.status).toBe(400);
    expect(link.body.code).toBe('BAD_FILE');
    expect((await stamp(w, { status: 'DONE' })).status).toBe(400);
    expect((await stamp(w, {})).status).toBe(400);
  });
});

/** The first test in this file rewrites the template to prove a made agreement keeps its own text. */
async function ensureTemplateRestored() {
  const { DEFAULT_TEMPLATES } = await import('../../lib/agreementDefaults');
  const t = DEFAULT_TEMPLATES.find((x) => x.key === 'lagos-residential')!;
  await testPrisma.agreementTemplate.update({
    where: { id: templateId },
    data: { clauses: t.clauses as unknown as object },
  });
}
