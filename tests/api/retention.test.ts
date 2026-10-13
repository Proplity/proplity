import { beforeAll, describe, expect, it } from 'vitest';
import { LeaseStatus, Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
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
  });

  it('deletes the ID of a tenant whose tenancy ended over 12 months ago, and clears the profile link', async () => {
    const tenant = await createUser(Role.TENANT);
    const unit = await createUnit((await createProperty()).id);
    await createLease(unit.id, tenant.id, {
      status: LeaseStatus.EXPIRED,
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
    await createLease(unitA.id, active.id, { status: LeaseStatus.ACTIVE });
    await createLease(unitB.id, recent.id, {
      status: LeaseStatus.EXPIRED,
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

  it('leaves users with no lease and no application alone', async () => {
    const user = await createUser(Role.TENANT);
    const file = await idDoc(user.id);
    await runRetention();
    expect((await testPrisma.storedFile.findUnique({ where: { id: file.id } }))?.status).toBe(
      'READY',
    );
  });
});
