import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createLease,
  createMaintenanceCategory,
  createMaintenanceRequest,
  createMaintenanceSchedule,
  createProperty,
  createUnit,
  createUser,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const PNG = new TextEncoder().encode('\x89PNG test');
const MR = '/api/v1/maintenance/requests';
const SCHEDULES = '/api/v1/maintenance/schedules';
const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';
const DAY = 24 * 60 * 60 * 1000;

type User = { id: string; role: Role };
const cookieOf = (u: User) => authCookie(u.id, u.role);

async function uploadPhoto(cookie: string): Promise<string> {
  const sign = await apiFetch('/api/v1/uploads/sign', {
    method: 'POST',
    cookie,
    body: {
      folder: 'maintenance-requests',
      fileName: 'p.png',
      contentType: 'image/png',
      size: PNG.byteLength,
    },
  });
  expect(sign.status).toBe(200);
  const form = new FormData();
  form.append('fileId', sign.body.data.plan.fileId);
  form.append('file', new Blob([PNG as unknown as BlobPart], { type: 'image/png' }), 'p.png');
  const put = await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie, body: form });
  expect(put.status).toBe(201);
  return sign.body.data.file.url as string;
}

const titlesFor = async (userId: string) =>
  (await testPrisma.notification.findMany({ where: { recipientId: userId } })).map((n) => n.title);

/** A property run by a manager with a landlord, one vacant unit and one let to a tenant. */
async function world() {
  const manager = await createUser(Role.MANAGER);
  const landlord = await createUser(Role.LANDLORD);
  const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
  const vacantUnit = await createUnit(property.id);
  const letUnit = await createUnit(property.id);
  const tenant = await createUser(Role.TENANT);
  await createLease(letUnit.id, tenant.id);
  const vendor = await createUser(Role.VENDOR);
  const admin = await createUser(Role.ADMIN);
  const outsider = await createUser(Role.MANAGER);
  return {
    manager,
    landlord,
    property,
    vacantUnit,
    letUnit,
    tenant,
    vendor,
    admin,
    outsider,
    cookies: {
      manager: await cookieOf(manager),
      landlord: await cookieOf(landlord),
      tenant: await cookieOf(tenant),
      vendor: await cookieOf(vendor),
      admin: await cookieOf(admin),
      outsider: await cookieOf(outsider),
    },
  };
}

const workOrder = (unitId: string, extra: Record<string, unknown> = {}) => ({
  unitId,
  title: 'Repaint the empty flat',
  description: 'Two coats before the next tenant.',
  ...extra,
});

describe('work orders: repairs the property team raises itself', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('raises one on a vacant unit with no tenant, and tells the rest of the team', async () => {
    const w = await world();
    const res = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: workOrder(w.vacantUnit.id),
    });
    expect(res.status).toBe(201);

    const row = await testPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(row.tenantId).toBeNull();
    expect(row.createdById).toBe(w.manager.id);
    expect(row.status).toBe('SUBMITTED');

    expect(await titlesFor(w.landlord.id)).toContain('Work order raised: Repaint the empty flat');
    // Whoever raised it knows.
    expect(await titlesFor(w.manager.id)).not.toContain(
      'Work order raised: Repaint the empty flat',
    );
  });

  it('can hand it to a vendor at once, who is told; a vendor not yet verified is refused', async () => {
    const w = await world();
    const ok = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.landlord,
      body: workOrder(w.vacantUnit.id, { vendorId: w.vendor.id }),
    });
    expect(ok.status).toBe(201);
    const row = await testPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: ok.body.data.id },
    });
    expect(row.vendorId).toBe(w.vendor.id);
    expect(row.status).toBe('SCHEDULED');
    expect(await titlesFor(w.vendor.id)).toContain('New Job Assigned: Repaint the empty flat');

    const unverified = await createUser(Role.VENDOR);
    await testPrisma.vendorProfile.create({
      data: { userId: unverified.id, businessName: 'Not Yet Ltd', verificationStatus: 'PENDING' },
    });
    const refused = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: workOrder(w.vacantUnit.id, { vendorId: unverified.id }),
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('VENDOR_NOT_VERIFIED');
  });

  it('on an occupied unit the current tenant is told, but the repair is still not theirs', async () => {
    const w = await world();
    const res = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: workOrder(w.letUnit.id, { title: 'Service the gate motor' }),
    });
    expect(res.status).toBe(201);
    const row = await testPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(row.tenantId).toBeNull();
    expect(await titlesFor(w.tenant.id)).toContain(
      'Maintenance planned for your unit: Service the gate motor',
    );
    // It is not in their own list of repairs.
    const mine = await apiFetch<{ data: { id: string }[] }>(MR, { cookie: w.cookies.tenant });
    expect(mine.body.data.map((r) => r.id)).not.toContain(row.id);
  });

  it('only the property team and admins may raise one, and only on their own units', async () => {
    const w = await world();
    const send = (cookie: string, unitId = w.vacantUnit.id) =>
      apiFetch(MR, { method: 'POST', cookie, body: workOrder(unitId) });

    expect((await send(w.cookies.admin)).status).toBe(201);
    expect((await send(w.cookies.landlord)).status).toBe(201);
    expect((await send(w.cookies.outsider)).status).toBe(403);
    expect((await send(w.cookies.vendor)).status).toBe(403);
    // A tenant still needs an active lease on the unit they report.
    expect((await send(w.cookies.tenant)).status).toBe(403);
    expect((await send(w.cookies.manager, 'no-such-unit')).status).toBe(404);
    expect(
      (await apiFetch(MR, { method: 'POST', cookie: w.cookies.manager, body: { unitId: 'x' } }))
        .status,
    ).toBe(400);
  });

  it('is shown to the team with who raised it, and to the vendor without a tenant', async () => {
    const w = await world();
    const created = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: workOrder(w.vacantUnit.id, { vendorId: w.vendor.id }),
    });
    const id = created.body.data.id as string;

    const list = await apiFetch<{
      data: { id: string; tenant: unknown; createdBy: { id: string } }[];
    }>(MR, { cookie: w.cookies.landlord });
    const listed = list.body.data.find((r) => r.id === id);
    expect(listed?.tenant).toBeNull();
    expect(listed?.createdBy.id).toBe(w.manager.id);

    const asVendor = await apiFetch(`${MR}/${id}`, { cookie: w.cookies.vendor });
    expect(asVendor.status).toBe(200);
    expect(asVendor.body.data.tenant).toBeNull();
    expect(asVendor.body.data.createdBy.id).toBe(w.manager.id);
    // The raised-by name is all it shows: no private fields from the user row.
    expect(JSON.stringify(asVendor.body)).not.toContain('passwordHash');
  });

  it(
    'is finished by the vendor with nobody to ask, and signed off by the team',
    { timeout: 90_000 },
    async () => {
      const w = await world();
      const created = await apiFetch(MR, {
        method: 'POST',
        cookie: w.cookies.manager,
        body: workOrder(w.vacantUnit.id, { vendorId: w.vendor.id }),
      });
      const id = created.body.data.id as string;

      const photo = await uploadPhoto(w.cookies.vendor);
      const done = await apiFetch(`${MR}/${id}`, {
        method: 'PATCH',
        cookie: w.cookies.vendor,
        body: { status: 'COMPLETED', afterPhotoUrls: [photo], finalCost: 40000 },
      });
      expect(done.status).toBe(200);
      const row = await testPrisma.maintenanceRequest.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('COMPLETED');
      // With no tenant there is nothing to wait for.
      expect(row.confirmationStatus).toBe('NOT_REQUESTED');

      // The tenant of the other unit cannot answer or rate it.
      const answer = await apiFetch(`${MR}/${id}/confirmation`, {
        method: 'POST',
        cookie: w.cookies.tenant,
        body: { outcome: 'CONFIRMED' },
      });
      expect(answer.status).toBe(403);
      const rate = await apiFetch(`${MR}/${id}/rating`, {
        method: 'POST',
        cookie: w.cookies.tenant,
        body: { rating: 5 },
      });
      expect(rate.status).toBe(403);

      const approve = await apiFetch(`${MR}/${id}/review`, {
        method: 'POST',
        cookie: w.cookies.landlord,
        body: { action: 'APPROVE' },
      });
      expect(approve.status).toBe(200);
      expect(
        (await testPrisma.maintenanceRequest.findUniqueOrThrow({ where: { id } })).approvedAt,
      ).not.toBeNull();
    },
  );

  it(
    'the vendor invoice closes it and tells the team, with no tenant to notify',
    { timeout: 90_000 },
    async () => {
      const w = await world();
      const created = await apiFetch(MR, {
        method: 'POST',
        cookie: w.cookies.manager,
        body: workOrder(w.vacantUnit.id, { vendorId: w.vendor.id }),
      });
      const id = created.body.data.id as string;
      await apiFetch(`${MR}/${id}`, {
        method: 'PATCH',
        cookie: w.cookies.vendor,
        body: { afterPhotoUrls: [await uploadPhoto(w.cookies.vendor)] },
      });

      const invoice = await apiFetch('/api/v1/invoices', {
        method: 'POST',
        cookie: w.cookies.vendor,
        body: {
          type: 'MAINTENANCE',
          maintenanceRequestId: id,
          amount: 40000,
          dueDate: new Date(Date.now() + 7 * DAY).toISOString(),
        },
      });
      expect(invoice.status).toBe(201);
      const row = await testPrisma.maintenanceRequest.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('COMPLETED');
      expect(row.confirmationStatus).toBe('NOT_REQUESTED');
      expect(
        (await titlesFor(w.landlord.id)).some(
          (t) => t.includes('Vendor invoice to pay') || t.includes('vendor invoice to pay'),
        ),
      ).toBe(true);
    },
  );

  it('has a message thread for the team and the vendor, without a tenant in it', async () => {
    const w = await world();
    const created = await apiFetch(MR, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: workOrder(w.vacantUnit.id, { vendorId: w.vendor.id }),
    });
    const id = created.body.data.id as string;

    const thread = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: w.cookies.manager,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: id, title: 'Repaint' },
    });
    expect(thread.status).toBe(201);
    const people = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: thread.body.data.id },
    });
    expect(people.map((p) => p.userId).sort()).toEqual(
      [w.manager.id, w.landlord.id, w.vendor.id].sort(),
    );
  });

  it('keeps a tenant-less repair out of tenant-only screens and notices', async () => {
    const w = await world();
    const mr = await createMaintenanceRequest(w.vacantUnit.id, null, {
      createdById: w.manager.id,
      title: 'Clear the compound',
    });
    const asTenant = await apiFetch(`${MR}/${mr.id}`, { cookie: w.cookies.tenant });
    expect(asTenant.status).toBe(403);
    const cancel = await apiFetch(`${MR}/${mr.id}`, {
      method: 'PATCH',
      cookie: w.cookies.manager,
      body: { status: 'CANCELLED' },
    });
    expect(cancel.status).toBe(200);
  });
});

describe('recurring maintenance schedules', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const body = (unitId: string, categoryId: string, extra: Record<string, unknown> = {}) => ({
    unitId,
    categoryId,
    frequency: 'MONTHLY',
    nextDueDate: '2027-01-31',
    ...extra,
  });

  it('creates one, remembers the intended day of the month, and checks what it points at', async () => {
    const w = await world();
    const cat = await createMaintenanceCategory();
    const ok = await apiFetch(SCHEDULES, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: body(w.letUnit.id, cat.id),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.dayOfMonth).toBe(31);

    const weekly = await apiFetch(SCHEDULES, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: body(w.letUnit.id, cat.id, { frequency: 'WEEKLY' }),
    });
    expect(weekly.body.data.dayOfMonth).toBeNull();

    expect(
      (
        await apiFetch(SCHEDULES, {
          method: 'POST',
          cookie: w.cookies.manager,
          body: body(w.letUnit.id, 'nope'),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await apiFetch(SCHEDULES, {
          method: 'POST',
          cookie: w.cookies.outsider,
          body: body(w.letUnit.id, cat.id),
        })
      ).status,
    ).toBe(403);

    // Equipment from another building cannot be pointed at.
    const other = await createProperty({ managerId: w.outsider.id });
    const strange = await testPrisma.equipment.create({
      data: { propertyId: other.id, type: 'GENERATOR' },
    });
    const wrong = await apiFetch(SCHEDULES, {
      method: 'POST',
      cookie: w.cookies.manager,
      body: body(w.letUnit.id, cat.id, { equipmentId: strange.id }),
    });
    expect(wrong.status).toBe(400);
    const here = await testPrisma.equipment.create({
      data: { propertyId: w.property.id, type: 'GENERATOR' },
    });
    expect(
      (
        await apiFetch(SCHEDULES, {
          method: 'POST',
          cookie: w.cookies.manager,
          body: body(w.letUnit.id, cat.id, { equipmentId: here.id }),
        })
      ).status,
    ).toBe(201);
  });

  it('lists only the schedules of properties the person looks after', async () => {
    const w = await world();
    const cat = await createMaintenanceCategory();
    await createMaintenanceSchedule(w.letUnit.id, cat.id);
    const mine = await apiFetch<{ data: { unit: { property: { name: string } } }[] }>(SCHEDULES, {
      cookie: w.cookies.manager,
    });
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(mine.body.data[0].unit.property.name).toBeTruthy();
    const theirs = await apiFetch<{ data: { unitId: string }[] }>(SCHEDULES, {
      cookie: w.cookies.outsider,
    });
    expect(theirs.body.data.map((s) => s.unitId)).not.toContain(w.letUnit.id);
    expect((await apiFetch(SCHEDULES, { cookie: w.cookies.tenant })).status).toBe(403);
  });

  it('can be paused, resumed, changed and removed, by the property team only', async () => {
    const w = await world();
    const cat = await createMaintenanceCategory();
    const s = await createMaintenanceSchedule(w.letUnit.id, cat.id);
    const url = `${SCHEDULES}/${s.id}`;

    const pause = await apiFetch(url, {
      method: 'PATCH',
      cookie: w.cookies.manager,
      body: { isActive: false },
    });
    expect(pause.status).toBe(200);
    expect(pause.body.data.isActive).toBe(false);
    expect(
      (
        await apiFetch(url, {
          method: 'PATCH',
          cookie: w.cookies.manager,
          body: { isActive: true },
        })
      ).body.data.isActive,
    ).toBe(true);

    const changed = await apiFetch(url, {
      method: 'PATCH',
      cookie: w.cookies.landlord,
      body: { frequency: 'QUARTERLY', nextDueDate: '2027-05-30' },
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.frequency).toBe('QUARTERLY');
    expect(changed.body.data.dayOfMonth).toBe(30);

    expect(
      (await apiFetch(url, { method: 'PATCH', cookie: w.cookies.manager, body: {} })).status,
    ).toBe(400);
    expect(
      (
        await apiFetch(url, {
          method: 'PATCH',
          cookie: w.cookies.outsider,
          body: { isActive: false },
        })
      ).status,
    ).toBe(403);
    expect((await apiFetch(url, { method: 'DELETE', cookie: w.cookies.outsider })).status).toBe(
      403,
    );
    expect(
      (
        await apiFetch(`${SCHEDULES}/missing`, {
          method: 'PATCH',
          cookie: w.cookies.manager,
          body: { isActive: false },
        })
      ).status,
    ).toBe(404);

    const gone = await apiFetch(url, { method: 'DELETE', cookie: w.cookies.manager });
    expect(gone.status).toBe(200);
    expect(await testPrisma.maintenanceSchedule.findUnique({ where: { id: s.id } })).toBeNull();
    const audit = await testPrisma.auditLog.findFirst({
      where: { action: 'MAINTENANCE_SCHEDULE_DELETED', entityId: s.id },
    });
    expect(audit?.actorId).toBe(w.manager.id);
  });

  const runDispatcher = () =>
    apiFetch<{ result: { dispatched: number; forVacantUnits: number } }>(
      '/api/v1/cron/maintenance-schedule-dispatcher',
      { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET } },
    );

  it('the daily job raises a tenant-less work order for a vacant unit instead of skipping it', async () => {
    const w = await world();
    const cat = await createMaintenanceCategory({ name: 'Gate servicing' });
    await createMaintenanceSchedule(w.vacantUnit.id, cat.id, {
      nextDueDate: new Date(Date.now() - DAY),
    });

    const run = await runDispatcher();
    expect(run.status).toBe(200);
    expect(run.body.result.forVacantUnits).toBeGreaterThanOrEqual(1);

    const raised = await testPrisma.maintenanceRequest.findMany({
      where: { unitId: w.vacantUnit.id },
    });
    expect(raised).toHaveLength(1);
    expect(raised[0].tenantId).toBeNull();
    expect(raised[0].title).toBe('Scheduled maintenance: Gate servicing');
    expect(await titlesFor(w.manager.id)).toContain(
      'Scheduled maintenance: Gate servicing needs a vendor',
    );
    // Run again straight away: it is not due again.
    await runDispatcher();
    expect(await testPrisma.maintenanceRequest.count({ where: { unitId: w.vacantUnit.id } })).toBe(
      1,
    );
  });

  it('attributes a let unit’s repair to its tenant, skips a paused schedule, and keeps the day of the month', async () => {
    const w = await world();
    const cat = await createMaintenanceCategory();
    const due = await testPrisma.maintenanceSchedule.create({
      data: {
        unitId: w.letUnit.id,
        categoryId: cat.id,
        frequency: 'MONTHLY',
        nextDueDate: new Date('2026-01-31T09:00:00.000Z'),
        dayOfMonth: 31,
      },
    });
    const paused = await testPrisma.maintenanceSchedule.create({
      data: {
        unitId: w.letUnit.id,
        categoryId: cat.id,
        frequency: 'WEEKLY',
        nextDueDate: new Date(Date.now() - DAY),
        isActive: false,
      },
    });

    await runDispatcher();
    const requests = await testPrisma.maintenanceRequest.findMany({
      where: { unitId: w.letUnit.id },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].tenantId).toBe(w.tenant.id);
    expect(await titlesFor(w.tenant.id)).toContain('Scheduled maintenance for your unit');

    // 31 January plus a month is the end of February, not the start of March.
    const after = await testPrisma.maintenanceSchedule.findUniqueOrThrow({ where: { id: due.id } });
    expect(after.nextDueDate.toISOString().slice(0, 10)).toBe('2026-02-28');
    const stillPaused = await testPrisma.maintenanceSchedule.findUniqueOrThrow({
      where: { id: paused.id },
    });
    expect(stillPaused.lastGeneratedAt).toBeNull();
  });
});
