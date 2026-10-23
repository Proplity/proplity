import { beforeAll, describe, expect, it } from 'vitest';
import { RentStatus, Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  setSystemSettings,
} from '../helpers/fixtures';
import { apiFetch } from '../helpers/client';
import { fileUrl } from '../../lib/fileRef';

const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';
const DAY = 24 * 60 * 60 * 1000;

async function idDoc(ownerId: string) {
  const file = await testPrisma.storedFile.create({
    data: {
      ownerId,
      folder: 'profile',
      access: 'PRIVATE',
      provider: 'local',
      key: `private/profile/${ownerId}/${Date.now()}-id.pdf`,
      originalName: 'id.pdf',
      status: 'READY',
    },
  });
  await testPrisma.user.update({
    where: { id: ownerId },
    data: { idDocumentUrl: fileUrl(file.id) },
  });
  return file;
}

async function runRetention() {
  return apiFetch('/api/v1/cron/retention', {
    method: 'POST',
    headers: { 'x-cron-secret': CRON_SECRET },
  });
}

describe('identity-document retention (ISS-039, ADR-0012)', () => {
  beforeAll(async () => {
    await resetDb();
    // The test server allows retention (RETENTION_ENABLED); the admin switch is the second gate.
    await setSystemSettings({ retentionEnabled: true });
  });

  it('deletes the ID of a tenant whose tenancy ended over 12 months ago, and clears the profile link', async () => {
    const tenant = await createUser(Role.TENANT);
    const unit = await createUnit((await createProperty()).id);
    await createRent(unit.id, tenant.id, {
      status: RentStatus.EXPIRED,
      endDate: new Date(Date.now() - 400 * DAY),
    });
    const file = await idDoc(tenant.id);

    const res = await runRetention();
    expect(res.status).toBe(200);

    const row = await testPrisma.storedFile.findUnique({ where: { id: file.id } });
    expect(row?.status).toBe('DELETED');
    const user = await testPrisma.user.findUnique({ where: { id: tenant.id } });
    expect(user?.idDocumentUrl).toBeNull();
    const audit = await testPrisma.auditLog.findMany({
      where: { action: 'FILE_RETENTION_DELETED', entityId: file.id },
    });
    expect(audit).toHaveLength(1);
  });

  it('keeps the ID of a tenant with an active tenancy, or one that ended recently', async () => {
    const active = await createUser(Role.TENANT);
    const recent = await createUser(Role.TENANT);
    const unitA = await createUnit((await createProperty()).id);
    const unitB = await createUnit((await createProperty()).id);
    await createRent(unitA.id, active.id, { status: RentStatus.ACTIVE });
    await createRent(unitB.id, recent.id, {
      status: RentStatus.EXPIRED,
      endDate: new Date(Date.now() - 30 * DAY),
    });
    const a = await idDoc(active.id);
    const b = await idDoc(recent.id);

    await runRetention();

    expect((await testPrisma.storedFile.findUnique({ where: { id: a.id } }))?.status).toBe('READY');
    expect((await testPrisma.storedFile.findUnique({ where: { id: b.id } }))?.status).toBe('READY');
  });

  it('deletes the ID of an applicant rejected over 90 days ago, but not a recent rejection or a pending application', async () => {
    const unit = await createUnit((await createProperty()).id);
    const old = await createUser(Role.TENANT);
    const recent = await createUser(Role.TENANT);
    const pending = await createUser(Role.TENANT);
    const mk = (applicantId: string, status: 'REJECTED' | 'PENDING', daysAgo: number) =>
      testPrisma.application.create({
        data: {
          unitId: unit.id,
          applicantId,
          status,
          details: {},
          reviewedAt: status === 'REJECTED' ? new Date(Date.now() - daysAgo * DAY) : null,
        },
      });
    await mk(old.id, 'REJECTED', 120);
    await mk(recent.id, 'REJECTED', 10);
    await mk(pending.id, 'PENDING', 0);
    const fOld = await idDoc(old.id);
    const fRecent = await idDoc(recent.id);
    const fPending = await idDoc(pending.id);

    await runRetention();

    const status = async (id: string) =>
      (await testPrisma.storedFile.findUnique({ where: { id } }))?.status;
    expect(await status(fOld.id)).toBe('DELETED');
    expect(await status(fRecent.id)).toBe('READY');
    expect(await status(fPending.id)).toBe('READY');
  });

  it('leaves users with no rent and no application alone', async () => {
    const user = await createUser(Role.TENANT);
    const file = await idDoc(user.id);
    await runRetention();
    expect((await testPrisma.storedFile.findUnique({ where: { id: file.id } }))?.status).toBe(
      'READY',
    );
  });
});

describe('retention: the admin switch and periods (ADR-0015)', () => {
  const statusOf = async (id: string) =>
    (await testPrisma.storedFile.findUnique({ where: { id } }))?.status;

  async function endedTenancy(daysAgo: number) {
    const tenant = await createUser(Role.TENANT);
    const unit = await createUnit((await createProperty()).id);
    await createRent(unit.id, tenant.id, {
      status: RentStatus.EXPIRED,
      endDate: new Date(Date.now() - daysAgo * DAY),
    });
    return idDoc(tenant.id);
  }

  beforeAll(async () => {
    await resetDb();
  });

  it('only reports what it would delete while the admin switch is off (the default)', async () => {
    const file = await endedTenancy(400);

    const res = await runRetention();
    expect(res.status).toBe(200);
    expect(res.body.result.enabled).toBe(false);
    expect(res.body.result.files).toBe(1);
    expect(res.body.result.deleted).toBe(0);
    expect(await statusOf(file.id)).toBe('READY');
  });

  it('deletes once an admin has switched it on', async () => {
    const file = await endedTenancy(400);
    await setSystemSettings({ retentionEnabled: true });

    const res = await runRetention();
    expect(res.body.result.enabled).toBe(true);
    expect(await statusOf(file.id)).toBe('DELETED');
  });

  it('uses the period an admin set after a tenancy ends, not a fixed 12 months', async () => {
    await setSystemSettings({ retentionEnabled: true, retentionAfterTenancyDays: 500 });
    const kept = await endedTenancy(400);
    await runRetention();
    expect(await statusOf(kept.id)).toBe('READY');

    await setSystemSettings({ retentionAfterTenancyDays: 300 });
    await runRetention();
    expect(await statusOf(kept.id)).toBe('DELETED');
  });

  it('uses the period an admin set after a rejection', async () => {
    await setSystemSettings({
      retentionEnabled: true,
      retentionAfterTenancyDays: 365,
      retentionAfterRejectionDays: 30,
    });
    const unit = await createUnit((await createProperty()).id);
    const applicant = await createUser(Role.TENANT);
    await testPrisma.application.create({
      data: {
        unitId: unit.id,
        applicantId: applicant.id,
        status: 'REJECTED',
        details: {},
        reviewedAt: new Date(Date.now() - 45 * DAY),
      },
    });
    const file = await idDoc(applicant.id);

    await setSystemSettings({ retentionAfterRejectionDays: 60 });
    await runRetention();
    expect(await statusOf(file.id)).toBe('READY');

    await setSystemSettings({ retentionAfterRejectionDays: 30 });
    await runRetention();
    expect(await statusOf(file.id)).toBe('DELETED');
  });
});
