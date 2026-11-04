import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, setSystemSettings } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { listUsableTemplates } from '../../lib/agreements';

// Owner decisions of 2026-10-23: the legal rules (advance rent, notice, registration) and the
// agreement wording are data an admin edits, not code. Nothing seeded is lawyer reviewed, and a
// template needs an admin's approval before managers can use it unless that is switched off.

const clause = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Clause ${id}`,
  body: 'The tenant {{tenantName}} pays {{rentAmount}}.',
  mode: 'EDITABLE',
  ...over,
});

async function as(role: Role) {
  const user = await createUser(role);
  return { user, cookie: await authCookie(user.id, user.role) };
}

describe('jurisdictions', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('seeds Lagos, the FCT and a general default, none of them lawyer reviewed', async () => {
    const { cookie } = await as(Role.ADMIN);
    const res = await apiFetch('/api/v1/admin/jurisdictions', { cookie });
    expect(res.status).toBe(200);
    const byKey = Object.fromEntries(res.body.data.map((j: { key: string }) => [j.key, j]));
    expect(Object.keys(byKey).sort()).toEqual(['abuja', 'lagos', 'nigeria-general']);
    expect(byKey.lagos).toMatchObject({
      advanceRentMaxMonths: 12,
      advanceRentMode: 'WARN',
      lawyerReviewed: false,
    });
    expect(byKey.lagos.excludedAreas).toContain('Ikoyi');
    expect(byKey['nigeria-general'].isDefault).toBe(true);
    expect(res.body.data.every((j: { lawyerReviewed: boolean }) => !j.lawyerReviewed)).toBe(true);
    // Reading twice does not seed twice.
    const again = await apiFetch('/api/v1/admin/jurisdictions', { cookie });
    expect(again.body.data).toHaveLength(3);
  });

  it('lets managers and landlords read the active ones, and nobody else', async () => {
    for (const role of [Role.MANAGER, Role.LANDLORD, Role.ADMIN]) {
      const { cookie } = await as(role);
      const res = await apiFetch('/api/v1/jurisdictions', { cookie });
      expect(res.status, role).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    }
    for (const role of [Role.TENANT, Role.VENDOR]) {
      const { cookie } = await as(role);
      expect((await apiFetch('/api/v1/jurisdictions', { cookie })).status, role).toBe(403);
    }
    expect((await apiFetch('/api/v1/jurisdictions')).status).toBe(401);
  });

  it('leaves out jurisdictions that are switched off', async () => {
    const admin = await as(Role.ADMIN);
    const created = await apiFetch('/api/v1/admin/jurisdictions', {
      method: 'POST',
      cookie: admin.cookie,
      body: { key: 'hidden-state', name: 'Hidden State', states: ['Hidden'], isActive: false },
    });
    expect(created.status).toBe(201);
    const manager = await as(Role.MANAGER);
    const list = await apiFetch('/api/v1/jurisdictions', { cookie: manager.cookie });
    expect(list.body.data.some((j: { key: string }) => j.key === 'hidden-state')).toBe(false);
    const all = await apiFetch('/api/v1/admin/jurisdictions', { cookie: admin.cookie });
    expect(all.body.data.some((j: { key: string }) => j.key === 'hidden-state')).toBe(true);
  });

  it('creates, updates and audits a jurisdiction; the key is fixed and unique', async () => {
    const { user, cookie } = await as(Role.ADMIN);
    const created = await apiFetch('/api/v1/admin/jurisdictions', {
      method: 'POST',
      cookie,
      body: {
        key: 'ogun',
        name: 'Ogun State',
        states: ['Ogun'],
        advanceRentMaxMonths: 6,
        advanceRentMode: 'BLOCK',
        noticeDays: { ANNUAL: 90 },
      },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const dup = await apiFetch('/api/v1/admin/jurisdictions', {
      method: 'POST',
      cookie,
      body: { key: 'ogun', name: 'Again' },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('KEY_IN_USE');

    const updated = await apiFetch(`/api/v1/admin/jurisdictions/${id}`, {
      method: 'PATCH',
      cookie,
      body: { advanceRentMaxMonths: null, lawyerReviewed: true, rulesCheckedAt: '2026-10-24' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ advanceRentMaxMonths: null, lawyerReviewed: true });

    const rekey = await apiFetch(`/api/v1/admin/jurisdictions/${id}`, {
      method: 'PATCH',
      cookie,
      body: { key: 'other' },
    });
    expect(rekey.status).toBe(400);

    const audit = await testPrisma.auditLog.findMany({
      where: { entityId: id, actorId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual(['JURISDICTION_CREATED', 'JURISDICTION_UPDATED']);
  });

  it('refuses nonsense values', async () => {
    const { cookie } = await as(Role.ADMIN);
    const body = (over: Record<string, unknown>) => ({ key: 'bad-one', name: 'Bad', ...over });
    for (const over of [
      { key: 'Bad Key!' },
      { advanceRentMaxMonths: 0 },
      { advanceRentMode: 'MAYBE' },
      { noticeDays: { WEEKLY: 7 } },
      { noticeDays: { ANNUAL: -3 } },
      { registrationThresholdYears: 150 },
    ]) {
      const res = await apiFetch('/api/v1/admin/jurisdictions', {
        method: 'POST',
        cookie,
        body: body(over),
      });
      expect(res.status, JSON.stringify(over)).toBe(400);
    }
  });

  it('keeps exactly one default, and protects it', async () => {
    const { cookie } = await as(Role.ADMIN);
    const list = (await apiFetch('/api/v1/admin/jurisdictions', { cookie })).body.data;
    const general = list.find((j: { key: string }) => j.key === 'nigeria-general');
    const lagos = list.find((j: { key: string }) => j.key === 'lagos');

    const noUnset = await apiFetch(`/api/v1/admin/jurisdictions/${general.id}`, {
      method: 'PATCH',
      cookie,
      body: { isDefault: false },
    });
    expect(noUnset.status).toBe(400);
    expect(
      (await apiFetch(`/api/v1/admin/jurisdictions/${general.id}`, { method: 'DELETE', cookie }))
        .status,
    ).toBe(400);

    const move = await apiFetch(`/api/v1/admin/jurisdictions/${lagos.id}`, {
      method: 'PATCH',
      cookie,
      body: { isDefault: true },
    });
    expect(move.status).toBe(200);
    const after = (await apiFetch('/api/v1/admin/jurisdictions', { cookie })).body.data;
    expect(after.filter((j: { isDefault: boolean }) => j.isDefault)).toHaveLength(1);
    expect(after.find((j: { isDefault: boolean }) => j.isDefault).key).toBe('lagos');
  });

  it('refuses to delete a jurisdiction that has templates; deletes one that has none', async () => {
    const { cookie } = await as(Role.ADMIN);
    const list = (await apiFetch('/api/v1/admin/jurisdictions', { cookie })).body.data;
    const abuja = list.find((j: { key: string }) => j.key === 'abuja');
    const blocked = await apiFetch(`/api/v1/admin/jurisdictions/${abuja.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('IN_USE');

    const empty = (
      await apiFetch('/api/v1/admin/jurisdictions', {
        method: 'POST',
        cookie,
        body: { key: 'empty-one', name: 'Empty' },
      })
    ).body.data;
    expect(
      (await apiFetch(`/api/v1/admin/jurisdictions/${empty.id}`, { method: 'DELETE', cookie }))
        .status,
    ).toBe(200);
  });

  it('is admin-only to change', async () => {
    const manager = await as(Role.MANAGER);
    for (const [method, path, body] of [
      ['GET', '/api/v1/admin/jurisdictions', undefined],
      ['POST', '/api/v1/admin/jurisdictions', { key: 'x1', name: 'X' }],
    ] as const) {
      const res = await apiFetch(path, { method, cookie: manager.cookie, body });
      expect(res.status).toBe(403);
    }
  });
});

describe('agreement templates', () => {
  beforeAll(async () => {
    await resetDb();
    await setSystemSettings({ id: 'global', agreementTemplatesNeedApproval: true });
  });

  const jurisdictionId = async (cookie: string, key = 'lagos') =>
    (await apiFetch('/api/v1/admin/jurisdictions', { cookie })).body.data.find(
      (j: { key: string }) => j.key === key,
    ).id as string;

  it('seeds a draft template for each starting jurisdiction', async () => {
    const { cookie } = await as(Role.ADMIN);
    const res = await apiFetch('/api/v1/admin/agreement-templates', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    for (const t of res.body.data) {
      expect(t).toMatchObject({ status: 'DRAFT', version: 1, witnessRequired: true });
      expect(t.clauses.length).toBeGreaterThan(10);
      expect(t.notes).toMatch(/not reviewed by a lawyer/i);
    }
  });

  it('cannot be used by managers until an admin approves it', async () => {
    const settings = { agreementTemplatesNeedApproval: true };
    expect(await listUsableTemplates(settings)).toHaveLength(0);

    const { cookie } = await as(Role.ADMIN);
    const lagos = (await apiFetch('/api/v1/admin/agreement-templates', { cookie })).body.data.find(
      (t: { key: string }) => t.key === 'lagos-residential',
    );
    const approved = await apiFetch(`/api/v1/admin/agreement-templates/${lagos.id}/approve`, {
      method: 'POST',
      cookie,
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.approvedAt).not.toBeNull();
    expect((await listUsableTemplates(settings)).map((t) => t.key)).toEqual(['lagos-residential']);

    // Switching the requirement off makes the newest draft or approved version of each usable.
    const open = await listUsableTemplates({ agreementTemplatesNeedApproval: false });
    expect(open.map((t) => t.key).sort()).toEqual([
      'abuja-residential',
      'lagos-residential',
      'nigeria-residential',
    ]);
  });

  it('creates a draft, validates fields, edits only drafts, and keeps keys unique', async () => {
    const { cookie } = await as(Role.ADMIN);
    const jid = await jurisdictionId(cookie);
    const make = (over: Record<string, unknown> = {}) =>
      apiFetch('/api/v1/admin/agreement-templates', {
        method: 'POST',
        cookie,
        body: {
          key: 'short-let',
          name: 'Short let',
          jurisdictionId: jid,
          clauses: [clause('one'), clause('two', { mode: 'OPTIONAL', defaultOn: false })],
          ...over,
        },
      });

    const typo = await make({ clauses: [clause('one', { body: 'Pay {{rentAmmount}}' })] });
    expect(typo.status).toBe(400);
    expect(JSON.stringify(typo.body)).toContain('rentAmmount');
    expect((await make({ clauses: [] })).status).toBe(400);
    expect((await make({ clauses: [clause('a'), clause('a')] })).status).toBe(400);
    expect((await make({ jurisdictionId: 'missing' })).status).toBe(404);

    const created = await make();
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'DRAFT', version: 1, key: 'short-let' });
    expect((await make()).status).toBe(409);

    const id = created.body.data.id;
    const edited = await apiFetch(`/api/v1/admin/agreement-templates/${id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Short let (updated)', clauses: [clause('one'), clause('three')] },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.clauses.map((c: { id: string }) => c.id)).toEqual(['one', 'three']);

    const rekey = await apiFetch(`/api/v1/admin/agreement-templates/${id}`, {
      method: 'PATCH',
      cookie,
      body: { key: 'changed' },
    });
    expect(rekey.status).toBe(400);
  });

  it('never edits an approved version: a change is a new draft version, and approving it retires the old one', async () => {
    const { user, cookie } = await as(Role.ADMIN);
    const jid = await jurisdictionId(cookie);
    const created = (
      await apiFetch('/api/v1/admin/agreement-templates', {
        method: 'POST',
        cookie,
        body: { key: 'versioned', name: 'Versioned', jurisdictionId: jid, clauses: [clause('a')] },
      })
    ).body.data;
    const approve = (id: string) =>
      apiFetch(`/api/v1/admin/agreement-templates/${id}/approve`, { method: 'POST', cookie });
    expect((await approve(created.id)).status).toBe(200);
    expect((await approve(created.id)).status).toBe(409);

    const locked = await apiFetch(`/api/v1/admin/agreement-templates/${created.id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Sneaky change' },
    });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('NOT_DRAFT');
    expect(
      (
        await apiFetch(`/api/v1/admin/agreement-templates/${created.id}`, {
          method: 'DELETE',
          cookie,
        })
      ).status,
    ).toBe(409);

    const next = await apiFetch(`/api/v1/admin/agreement-templates/${created.id}/new-version`, {
      method: 'POST',
      cookie,
    });
    expect(next.status).toBe(201);
    expect(next.body.data).toMatchObject({ version: 2, status: 'DRAFT', key: 'versioned' });
    expect(next.body.data.clauses).toEqual(created.clauses);

    // Only one draft at a time.
    const again = await apiFetch(`/api/v1/admin/agreement-templates/${created.id}/new-version`, {
      method: 'POST',
      cookie,
    });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'DRAFT_EXISTS', draftId: next.body.data.id });

    await apiFetch(`/api/v1/admin/agreement-templates/${next.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { clauses: [clause('a'), clause('b')] },
    });
    expect((await approve(next.body.data.id)).status).toBe(200);

    const rows = await testPrisma.agreementTemplate.findMany({
      where: { key: 'versioned' },
      orderBy: { version: 'asc' },
    });
    expect(rows.map((r) => [r.version, r.status])).toEqual([
      [1, 'ARCHIVED'],
      [2, 'APPROVED'],
    ]);
    expect(rows[1].approvedById).toBe(user.id);

    // Managers see only the newest approved version.
    const usable = await listUsableTemplates({ agreementTemplatesNeedApproval: true });
    expect(usable.filter((t) => t.key === 'versioned').map((t) => t.version)).toEqual([2]);

    const audit = await testPrisma.auditLog.findMany({
      where: { action: { startsWith: 'AGREEMENT_TEMPLATE_' }, entityId: next.body.data.id },
    });
    expect(audit.map((a) => a.action).sort()).toEqual([
      'AGREEMENT_TEMPLATE_APPROVED',
      'AGREEMENT_TEMPLATE_CREATED',
      'AGREEMENT_TEMPLATE_UPDATED',
    ]);
  });

  it('archives a version so managers can no longer start from it, and deletes drafts only', async () => {
    const { cookie } = await as(Role.ADMIN);
    const jid = await jurisdictionId(cookie);
    const t = (
      await apiFetch('/api/v1/admin/agreement-templates', {
        method: 'POST',
        cookie,
        body: { key: 'retired', name: 'Retired', jurisdictionId: jid, clauses: [clause('a')] },
      })
    ).body.data;
    await apiFetch(`/api/v1/admin/agreement-templates/${t.id}/approve`, { method: 'POST', cookie });
    expect(
      (await listUsableTemplates({ agreementTemplatesNeedApproval: true })).some(
        (x) => x.key === 'retired',
      ),
    ).toBe(true);
    const archived = await apiFetch(`/api/v1/admin/agreement-templates/${t.id}/archive`, {
      method: 'POST',
      cookie,
    });
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe('ARCHIVED');
    expect(
      (
        await apiFetch(`/api/v1/admin/agreement-templates/${t.id}/archive`, {
          method: 'POST',
          cookie,
        })
      ).status,
    ).toBe(409);
    expect(
      (await listUsableTemplates({ agreementTemplatesNeedApproval: false })).some(
        (x) => x.key === 'retired',
      ),
    ).toBe(false);

    const draft = (
      await apiFetch('/api/v1/admin/agreement-templates', {
        method: 'POST',
        cookie,
        body: { key: 'scrap', name: 'Scrap', jurisdictionId: jid, clauses: [clause('a')] },
      })
    ).body.data;
    expect(
      (
        await apiFetch(`/api/v1/admin/agreement-templates/${draft.id}`, {
          method: 'DELETE',
          cookie,
        })
      ).status,
    ).toBe(200);
  });

  it('does not let two approvals of the same wording both win', async () => {
    const { cookie } = await as(Role.ADMIN);
    const jid = await jurisdictionId(cookie);
    const v1 = (
      await apiFetch('/api/v1/admin/agreement-templates', {
        method: 'POST',
        cookie,
        body: { key: 'raced', name: 'Raced', jurisdictionId: jid, clauses: [clause('a')] },
      })
    ).body.data;
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        apiFetch(`/api/v1/admin/agreement-templates/${v1.id}/approve`, { method: 'POST', cookie }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      await testPrisma.agreementTemplate.count({ where: { key: 'raced', status: 'APPROVED' } }),
    ).toBe(1);
  }, 60_000);

  it('is admin-only', async () => {
    const manager = await as(Role.MANAGER);
    const some = (await testPrisma.agreementTemplate.findFirstOrThrow()).id;
    for (const [method, path] of [
      ['GET', '/api/v1/admin/agreement-templates'],
      ['GET', `/api/v1/admin/agreement-templates/${some}`],
      ['POST', `/api/v1/admin/agreement-templates/${some}/approve`],
      ['POST', `/api/v1/admin/agreement-templates/${some}/new-version`],
      ['POST', `/api/v1/admin/agreement-templates/${some}/archive`],
      ['DELETE', `/api/v1/admin/agreement-templates/${some}`],
    ] as const) {
      expect((await apiFetch(path, { method, cookie: manager.cookie })).status, path).toBe(403);
    }
  });
});

describe('agreement settings', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('start with the owner’s defaults and change one at a time, with an audit row', async () => {
    const { user, cookie } = await as(Role.ADMIN);
    const before = (await apiFetch('/api/v1/admin/settings', { cookie })).body.data;
    expect(before).toMatchObject({
      agreementTemplatesNeedApproval: true,
      agreementLandlordNameByManager: true,
      agreementAgencyFee: true,
      agreementLegalFee: true,
      agreementCautionFee: true,
      rentActivationRule: 'INDEPENDENT',
      chargeForAgreements: false,
      chargeForUploads: false,
    });

    const res = await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie,
      body: { rentActivationRule: 'AFTER_BOTH_SIGN', chargeForAgreements: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      rentActivationRule: 'AFTER_BOTH_SIGN',
      chargeForAgreements: true,
      chargeForUploads: false,
    });

    const bad = await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie,
      body: { rentActivationRule: 'WHENEVER' },
    });
    expect(bad.status).toBe(400);

    const audit = await testPrisma.auditLog.findFirstOrThrow({
      where: { actorId: user.id, action: 'SETTINGS_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit.metadata)).toContain('rentActivationRule');
  });
});
