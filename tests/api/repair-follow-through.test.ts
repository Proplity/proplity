import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createRent,
  createProperty,
  createUnit,
  createUser,
  createMaintenanceRequest,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const PNG = new TextEncoder().encode('\x89PNG test');
const MR = '/api/v1/maintenance/requests';

type User = { id: string; role: Role };
const cookieOf = (u: User) => authCookie(u.id, u.role);

/** Uploads one small PNG into the repair folder as `cookie`'s owner and returns its gateway URL. */
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

async function setSettings(data: {
  requireTenantRepairConfirmation?: boolean;
  autoCompleteMaintenanceOnInvoice?: boolean;
}) {
  await testPrisma.systemSettings.upsert({
    where: { id: 'global' },
    update: data,
    create: { id: 'global', ...data },
  });
}

/** A property with its manager, a unit, a tenant and a vendor already on a scheduled job. */
async function world(overrides: { vendorId?: null; status?: 'SCHEDULED' | 'IN_PROGRESS' } = {}) {
  const manager = await createUser(Role.MANAGER);
  const landlord = await createUser(Role.LANDLORD);
  const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
  const unit = await createUnit(property.id);
  const tenant = await createUser(Role.TENANT);
  await createRent(unit.id, tenant.id);
  const vendor = await createUser(Role.VENDOR);
  const request = await createMaintenanceRequest(unit.id, tenant.id, {
    vendorId: overrides.vendorId === null ? null : vendor.id,
    status: overrides.status ?? 'IN_PROGRESS',
    title: 'Leaking pipe',
  });
  return {
    manager,
    landlord,
    property,
    unit,
    tenant,
    vendor,
    request,
    cookies: {
      manager: await cookieOf(manager),
      landlord: await cookieOf(landlord),
      tenant: await cookieOf(tenant),
      vendor: await cookieOf(vendor),
    },
  };
}

/** The vendor finishes the job through the API, so every field is set the way the app sets it. */
async function finish(w: Awaited<ReturnType<typeof world>>, cost = 8000) {
  const photo = await uploadPhoto(w.cookies.vendor);
  const res = await apiFetch(`${MR}/${w.request.id}`, {
    method: 'PATCH',
    cookie: w.cookies.vendor,
    body: { status: 'COMPLETED', afterPhotoUrls: [photo], finalCost: cost },
  });
  expect(res.status).toBe(200);
  return { photo, res };
}

const reload = (id: string) => testPrisma.maintenanceRequest.findUniqueOrThrow({ where: { id } });
const attention = async (user: User) => {
  const res = await apiFetch<{ data: { id: string; count: number }[] }>(
    '/api/v1/dashboard/attention',
    { cookie: await cookieOf(user) },
  );
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('repair follow-through: the vendor’s photos', () => {
  beforeAll(async () => {
    await resetDb();
    await setSettings({ requireTenantRepairConfirmation: true });
  });

  it('lets only the assigned vendor attach photos they uploaded', async () => {
    const w = await world();
    const mine = await uploadPhoto(w.cookies.vendor);

    const ok = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { beforePhotoUrls: [mine], afterPhotoUrls: [mine] },
    });
    expect(ok.status).toBe(200);
    const row = await reload(w.request.id);
    expect(row.beforePhotoUrls).toEqual([mine]);
    expect(row.afterPhotoUrls).toEqual([mine]);
    expect(row.status).toBe('IN_PROGRESS');

    const otherVendor = await createUser(Role.VENDOR);
    for (const cookie of [await cookieOf(otherVendor), w.cookies.manager, w.cookies.tenant]) {
      const res = await apiFetch(`${MR}/${w.request.id}`, {
        method: 'PATCH',
        cookie,
        body: { afterPhotoUrls: [mine] },
      });
      expect(res.status).toBe(403);
    }

    // A file someone else uploaded cannot be attached, or it would grant read access to it.
    const tenantsFile = await uploadPhoto(w.cookies.tenant);
    const stolen = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: [tenantsFile] },
    });
    expect(stolen.status).toBe(400);

    const tooMany = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: Array.from({ length: 13 }, () => mine) },
    });
    expect(tooMany.status).toBe(400);
  });

  it('shows the photos to the tenant and the property team, and to no one else', async () => {
    const w = await world();
    const photo = await uploadPhoto(w.cookies.vendor);
    await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: [photo] },
    });

    expect((await apiFetch(photo, { cookie: w.cookies.vendor })).status).toBe(200);
    expect((await apiFetch(photo, { cookie: w.cookies.tenant })).status).toBe(200);
    expect((await apiFetch(photo, { cookie: w.cookies.manager })).status).toBe(200);
    expect((await apiFetch(photo, { cookie: w.cookies.landlord })).status).toBe(200);

    const stranger = await createUser(Role.TENANT);
    const otherManager = await createUser(Role.MANAGER);
    expect((await apiFetch(photo, { cookie: await cookieOf(stranger) })).status).toBe(404);
    expect((await apiFetch(photo, { cookie: await cookieOf(otherManager) })).status).toBe(404);
    expect((await apiFetch(photo)).status).toBe(401);
  });

  it('locks the photos once the repair is approved', async () => {
    const w = await world();
    await finish(w);
    expect(
      (
        await apiFetch(`${MR}/${w.request.id}/review`, {
          method: 'POST',
          cookie: w.cookies.manager,
          body: { action: 'APPROVE' },
        })
      ).status,
    ).toBe(200);

    const more = await uploadPhoto(w.cookies.vendor);
    const res = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: [more] },
    });
    expect(res.status).toBe(409);
  });
});

describe('repair follow-through: finishing a job', () => {
  beforeAll(async () => {
    await resetDb();
    await setSettings({
      requireTenantRepairConfirmation: true,
      autoCompleteMaintenanceOnInvoice: true,
    });
  });

  it('will not close a job without a photo of the finished work', async () => {
    const w = await world();
    const none = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { status: 'COMPLETED', finalCost: 5000 },
    });
    expect(none.status).toBe(400);
    expect(none.body.code).toBe('EVIDENCE_REQUIRED');
    expect((await reload(w.request.id)).status).toBe('IN_PROGRESS');

    const { photo } = await finish(w, 5000);
    const row = await reload(w.request.id);
    expect(row.status).toBe('COMPLETED');
    expect(row.afterPhotoUrls).toEqual([photo]);
    expect(row.completionProofUrl).toBe(photo);
    expect(row.confirmationStatus).toBe('AWAITING_TENANT');
    expect(row.completedAt).not.toBeNull();
    expect(await testPrisma.invoice.count({ where: { maintenanceRequestId: w.request.id } })).toBe(
      1,
    );
  });

  it('asks the tenant to confirm, and tells them so', async () => {
    const w = await world();
    await finish(w);
    const note = await testPrisma.notification.findFirst({
      where: { recipientId: w.tenant.id, title: 'Is your repair fixed?' },
    });
    expect(note?.link).toBe(`/dashboard/tenant-maintenance?request=${w.request.id}`);
    expect((await attention(w.tenant)).find((r) => r.id === 'repairs-to-confirm')?.count).toBe(1);
  });

  it('closes a job from the vendor’s invoice only when the photos are there', async () => {
    const w = await world();
    const invoice = {
      maintenanceRequestId: w.request.id,
      type: 'MAINTENANCE',
      amount: 6000,
      dueDate: new Date().toISOString(),
    };
    const refused = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: w.cookies.vendor,
      body: invoice,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('EVIDENCE_REQUIRED');
    expect((await reload(w.request.id)).status).toBe('IN_PROGRESS');
    expect(await testPrisma.invoice.count({ where: { maintenanceRequestId: w.request.id } })).toBe(
      0,
    );

    const photo = await uploadPhoto(w.cookies.vendor);
    await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: [photo] },
    });
    const ok = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: w.cookies.vendor,
      body: invoice,
    });
    expect(ok.status).toBe(201);
    const row = await reload(w.request.id);
    expect(row.status).toBe('COMPLETED');
    expect(row.finalCost).toBe(6000);
    expect(row.confirmationStatus).toBe('AWAITING_TENANT');
  });

  it('does not ask the tenant when the admin has switched the step off', async () => {
    await setSettings({ requireTenantRepairConfirmation: false });
    try {
      const w = await world();
      await finish(w);
      const row = await reload(w.request.id);
      expect(row.status).toBe('COMPLETED');
      expect(row.confirmationStatus).toBe('NOT_REQUESTED');
      expect((await attention(w.tenant)).some((r) => r.id === 'repairs-to-confirm')).toBe(false);
    } finally {
      await setSettings({ requireTenantRepairConfirmation: true });
    }
  });

  it('keeps the tenant’s answer and the approval when a corrected invoice replaces a cancelled one', async () => {
    const w = await world();
    const photo = await uploadPhoto(w.cookies.vendor);
    await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { afterPhotoUrls: [photo] },
    });
    const post = (amount: number) =>
      apiFetch('/api/v1/invoices', {
        method: 'POST',
        cookie: w.cookies.vendor,
        body: {
          maintenanceRequestId: w.request.id,
          type: 'MAINTENANCE',
          amount,
          dueDate: new Date().toISOString(),
        },
      });
    const first = await post(6000);
    expect(first.status).toBe(201);
    const completedAt = (await reload(w.request.id)).completedAt;

    await apiFetch(`${MR}/${w.request.id}/confirmation`, {
      method: 'POST',
      cookie: w.cookies.tenant,
      body: { outcome: 'CONFIRMED' },
    });
    await testPrisma.invoice.update({
      where: { id: first.body.data.id },
      data: { status: 'CANCELLED' },
    });

    expect((await post(7000)).status).toBe(201);
    const row = await reload(w.request.id);
    expect(row.confirmationStatus).toBe('CONFIRMED');
    expect(row.completedAt?.getTime()).toBe(completedAt?.getTime());
    expect(row.finalCost).toBe(7000);
  });

  it('stops a finished or cancelled job being started, finished or cancelled again', async () => {
    const w = await world();
    await finish(w);

    for (const body of [{ status: 'IN_PROGRESS' }, { status: 'COMPLETED', finalCost: 1 }]) {
      const res = await apiFetch(`${MR}/${w.request.id}`, {
        method: 'PATCH',
        cookie: w.cookies.vendor,
        body,
      });
      expect(res.status).toBe(409);
    }
    // The tenant and the team cannot cancel work a vendor has already finished and billed.
    for (const cookie of [w.cookies.tenant, w.cookies.manager]) {
      const res = await apiFetch(`${MR}/${w.request.id}`, {
        method: 'PATCH',
        cookie,
        body: { status: 'CANCELLED' },
      });
      expect(res.status).toBe(409);
    }
    expect((await reload(w.request.id)).status).toBe('COMPLETED');

    const cancelled = await world();
    expect(
      (
        await apiFetch(`${MR}/${cancelled.request.id}`, {
          method: 'PATCH',
          cookie: cancelled.cookies.manager,
          body: { status: 'CANCELLED' },
        })
      ).status,
    ).toBe(200);
    const revive = await apiFetch(`${MR}/${cancelled.request.id}`, {
      method: 'PATCH',
      cookie: cancelled.cookies.vendor,
      body: { status: 'IN_PROGRESS' },
    });
    expect(revive.status).toBe(409);
    const bill = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: cancelled.cookies.manager,
      body: {
        maintenanceRequestId: cancelled.request.id,
        type: 'MAINTENANCE',
        amount: 100,
        dueDate: new Date().toISOString(),
      },
    });
    expect(bill.status).toBe(409);
  });
});

describe('repair follow-through: the tenant’s answer', () => {
  beforeAll(async () => {
    await resetDb();
    await setSettings({
      requireTenantRepairConfirmation: true,
      autoCompleteMaintenanceOnInvoice: true,
    });
  });

  const answer = (cookie: string, id: string, body: object) =>
    apiFetch(`${MR}/${id}/confirmation`, { method: 'POST', cookie, body });

  it('is only for the owning tenant, and only while the repair is waiting for an answer', async () => {
    const w = await world();
    // Not finished yet.
    expect((await answer(w.cookies.tenant, w.request.id, { outcome: 'CONFIRMED' })).status).toBe(
      409,
    );

    await finish(w);
    const stranger = await createUser(Role.TENANT);
    expect(
      (await answer(await cookieOf(stranger), w.request.id, { outcome: 'CONFIRMED' })).status,
    ).toBe(403);
    expect((await answer(w.cookies.vendor, w.request.id, { outcome: 'CONFIRMED' })).status).toBe(
      403,
    );
    expect((await answer(w.cookies.manager, w.request.id, { outcome: 'CONFIRMED' })).status).toBe(
      403,
    );

    const ok = await answer(w.cookies.tenant, w.request.id, { outcome: 'CONFIRMED' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.confirmationStatus).toBe('CONFIRMED');
    expect(ok.body.data.confirmationRespondedAt).not.toBeNull();
    expect(
      (
        await answer(w.cookies.tenant, w.request.id, {
          outcome: 'DISPUTED',
          reason: 'Changed my mind',
        })
      ).status,
    ).toBe(409);
    expect((await attention(w.tenant)).some((r) => r.id === 'repairs-to-confirm')).toBe(false);
  });

  it('needs a reason for a dispute, keeps its photos, and tells the property team', async () => {
    const w = await world();
    await finish(w);
    await testPrisma.maintenanceRequest.update({
      where: { id: w.request.id },
      data: { approvedAt: new Date(), approvedById: w.manager.id },
    });

    expect((await answer(w.cookies.tenant, w.request.id, { outcome: 'DISPUTED' })).status).toBe(
      400,
    );
    expect(
      (await answer(w.cookies.tenant, w.request.id, { outcome: 'DISPUTED', reason: 'no' })).status,
    ).toBe(400);

    const someoneElses = await uploadPhoto(w.cookies.vendor);
    const stolen = await answer(w.cookies.tenant, w.request.id, {
      outcome: 'DISPUTED',
      reason: 'It is still dripping',
      photoUrls: [someoneElses],
    });
    expect(stolen.status).toBe(400);

    const mine = await uploadPhoto(w.cookies.tenant);
    const ok = await answer(w.cookies.tenant, w.request.id, {
      outcome: 'DISPUTED',
      reason: '  It is still dripping under the sink  ',
      photoUrls: [mine],
    });
    expect(ok.status).toBe(200);
    const row = await reload(w.request.id);
    expect(row.confirmationStatus).toBe('DISPUTED');
    expect(row.disputeReason).toBe('It is still dripping under the sink');
    expect(row.disputePhotoUrls).toEqual([mine]);
    // A dispute puts the team's earlier sign-off back in question.
    expect(row.approvedAt).toBeNull();
    expect(row.approvedById).toBeNull();

    const told = await testPrisma.notification.findMany({
      where: { title: 'Repair not fixed: Leaking pipe' },
    });
    expect(told.map((n) => n.recipientId).sort()).toEqual([w.manager.id, w.landlord.id].sort());
    expect(told[0].body).toContain('It is still dripping under the sink');

    expect((await attention(w.manager)).find((r) => r.id === 'repairs-disputed')?.count).toBe(1);
    expect((await attention(w.landlord)).find((r) => r.id === 'repairs-disputed')?.count).toBe(1);

    // The vendor can read the tenant's dispute photo (it is on their job), a stranger cannot.
    expect((await apiFetch(mine, { cookie: w.cookies.vendor })).status).toBe(200);
    expect(
      (await apiFetch(mine, { cookie: await cookieOf(await createUser(Role.TENANT)) })).status,
    ).toBe(404);
  });

  it('can still be answered after the admin switches the step off', async () => {
    const w = await world();
    await finish(w);
    await setSettings({ requireTenantRepairConfirmation: false });
    try {
      const ok = await answer(w.cookies.tenant, w.request.id, { outcome: 'CONFIRMED' });
      expect(ok.status).toBe(200);
    } finally {
      await setSettings({ requireTenantRepairConfirmation: true });
    }
  });
});

describe('repair follow-through: the property team’s decision', () => {
  beforeAll(async () => {
    await resetDb();
    await setSettings({
      requireTenantRepairConfirmation: true,
      autoCompleteMaintenanceOnInvoice: true,
    });
  });

  const review = (cookie: string, id: string, body: object) =>
    apiFetch(`${MR}/${id}/review`, { method: 'POST', cookie, body });
  const dispute = (w: Awaited<ReturnType<typeof world>>) =>
    apiFetch(`${MR}/${w.request.id}/confirmation`, {
      method: 'POST',
      cookie: w.cookies.tenant,
      body: { outcome: 'DISPUTED', reason: 'It is still leaking badly' },
    });

  it('lets the property’s own team approve a finished repair, once', async () => {
    const w = await world();
    expect((await review(w.cookies.manager, w.request.id, { action: 'APPROVE' })).status).toBe(409); // not finished

    await finish(w);
    const otherManager = await createUser(Role.MANAGER);
    for (const cookie of [w.cookies.tenant, w.cookies.vendor, await cookieOf(otherManager)]) {
      expect((await review(cookie, w.request.id, { action: 'APPROVE' })).status).toBe(403);
    }

    const ok = await review(w.cookies.manager, w.request.id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
    const row = await reload(w.request.id);
    expect(row.approvedAt).not.toBeNull();
    expect(row.approvedById).toBe(w.manager.id);
    expect(row.confirmationStatus).toBe('AWAITING_TENANT'); // approving does not answer for the tenant
    expect((await review(w.cookies.landlord, w.request.id, { action: 'APPROVE' })).status).toBe(
      409,
    );

    // Approval is a sign-off only: the vendor's invoice stays payable.
    const invoice = await testPrisma.invoice.findFirstOrThrow({
      where: { maintenanceRequestId: w.request.id },
    });
    expect(invoice.status).toBe('UNPAID');
  });

  it('sends only a disputed repair back to the same vendor, who can finish it again without a new bill', async () => {
    const w = await world();
    await finish(w, 9000);
    expect((await review(w.cookies.manager, w.request.id, { action: 'REOPEN' })).status).toBe(409); // not disputed

    expect((await dispute(w)).status).toBe(200);
    const back = await review(w.cookies.manager, w.request.id, {
      action: 'REOPEN',
      note: 'Please check the joint',
    });
    expect(back.status).toBe(200);
    let row = await reload(w.request.id);
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.confirmationStatus).toBe('NOT_REQUESTED');
    expect(row.completedAt).toBeNull();
    expect(row.disputeReason).toBe('It is still leaking badly'); // kept so the vendor can read it
    expect(row.afterPhotoUrls.length).toBe(1);

    const told = await testPrisma.notification.findFirst({
      where: { recipientId: w.vendor.id, title: 'Repair sent back to you: Leaking pipe' },
    });
    expect(told?.body).toContain('It is still leaking badly');
    expect(told?.body).toContain('Please check the joint');
    expect((await attention(w.vendor)).find((r) => r.id === 'jobs-sent-back')?.count).toBe(1);
    expect((await attention(w.manager)).some((r) => r.id === 'repairs-disputed')).toBe(false);

    // Finishing again uses the cost already billed and creates no second invoice.
    const again = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.vendor,
      body: { status: 'COMPLETED' },
    });
    expect(again.status).toBe(200);
    row = await reload(w.request.id);
    expect(row.status).toBe('COMPLETED');
    expect(row.finalCost).toBe(9000);
    expect(row.confirmationStatus).toBe('AWAITING_TENANT');
    expect(row.disputeReason).toBeNull();
    expect(await testPrisma.invoice.count({ where: { maintenanceRequestId: w.request.id } })).toBe(
      1,
    );
    expect((await attention(w.vendor)).some((r) => r.id === 'jobs-sent-back')).toBe(false);
  });

  it('does not let an approved repair be sent back', async () => {
    const w = await world();
    await finish(w);
    await dispute(w);
    expect((await review(w.cookies.manager, w.request.id, { action: 'APPROVE' })).status).toBe(200);
    expect((await review(w.cookies.manager, w.request.id, { action: 'REOPEN' })).status).toBe(409);
  });

  it('gives a disputed repair to another verified vendor and cancels the first vendor’s unpaid bill', async () => {
    const w = await world();
    const { photo } = await finish(w);
    await dispute(w);

    // A thread opened while the first vendor was on the job.
    const thread = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: w.cookies.tenant,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: w.request.id },
    });
    expect([200, 201]).toContain(thread.status);

    const same = await review(w.cookies.manager, w.request.id, {
      action: 'REASSIGN',
      vendorId: w.vendor.id,
    });
    expect(same.status).toBe(400);

    const unverified = await createUser(Role.VENDOR);
    await testPrisma.vendorProfile.create({
      data: { userId: unverified.id, businessName: 'Pending Pipes', verificationStatus: 'PENDING' },
    });
    const refused = await review(w.cookies.manager, w.request.id, {
      action: 'REASSIGN',
      vendorId: unverified.id,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('VENDOR_NOT_VERIFIED');

    const next = await createUser(Role.VENDOR);
    const moved = await review(w.cookies.manager, w.request.id, {
      action: 'REASSIGN',
      vendorId: next.id,
    });
    expect(moved.status).toBe(200);

    const row = await reload(w.request.id);
    expect(row.vendorId).toBe(next.id);
    expect(row.status).toBe('SCHEDULED');
    expect(row.confirmationStatus).toBe('NOT_REQUESTED');
    expect(row.afterPhotoUrls).toEqual([]);
    expect(row.completionProofUrl).toBeNull();
    expect(row.finalCost).toBeNull();
    expect(row.disputeReason).toBe('It is still leaking badly'); // the new vendor reads what went wrong

    const invoices = await testPrisma.invoice.findMany({
      where: { maintenanceRequestId: w.request.id },
    });
    expect(invoices.map((i) => i.status)).toEqual(['CANCELLED']);
    expect(
      await testPrisma.auditLog.count({
        where: {
          action: 'INVOICE_CANCELLED_ON_REASSIGN',
          entityId: invoices[0].id,
          actorId: w.manager.id,
        },
      }),
    ).toBe(1);

    // The thread follows the job: the new vendor is in it and the old one is out.
    const members = await testPrisma.conversationParticipant.findMany({
      where: { conversation: { maintenanceRequestId: w.request.id } },
    });
    const ids = members.map((m) => m.userId);
    expect(ids).toContain(next.id);
    expect(ids).not.toContain(w.vendor.id);

    // The old vendor can no longer read the job or its photos; the new one can read the tenant's.
    expect((await apiFetch(`${MR}/${w.request.id}`, { cookie: w.cookies.vendor })).status).toBe(
      403,
    );
    expect((await apiFetch(photo, { cookie: await cookieOf(next) })).status).toBe(404);
    expect((await apiFetch(`${MR}/${w.request.id}`, { cookie: await cookieOf(next) })).status).toBe(
      200,
    );
    expect(
      await testPrisma.notification.count({
        where: { recipientId: next.id, title: 'New Job Assigned: Leaking pipe' },
      }),
    ).toBe(1);
  });

  it('will not move a disputed repair away from a vendor who has already been paid', async () => {
    const w = await world();
    await finish(w, 4000);
    await dispute(w);
    const invoice = await testPrisma.invoice.findFirstOrThrow({
      where: { maintenanceRequestId: w.request.id },
    });
    await testPrisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 1000,
        paymentMethod: 'BANK_TRANSFER',
        provider: 'BANK_TRANSFER',
        paidAt: new Date(),
      },
    });
    await testPrisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PARTIALLY_PAID' },
    });

    const next = await createUser(Role.VENDOR);
    const res = await review(w.cookies.manager, w.request.id, {
      action: 'REASSIGN',
      vendorId: next.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_HAS_PAYMENTS');
    const row = await reload(w.request.id);
    expect(row.vendorId).toBe(w.vendor.id);
    expect(row.confirmationStatus).toBe('DISPUTED');
  });
});

describe('repair follow-through: the admin switch', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('is on by default and can be turned off and on by an admin only', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const adminCookie = await cookieOf(admin);

    const first = await apiFetch('/api/v1/admin/settings', { cookie: adminCookie });
    expect(first.body.data.requireTenantRepairConfirmation).toBe(true);

    const off = await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { requireTenantRepairConfirmation: false },
    });
    expect(off.status).toBe(200);
    const after = await apiFetch('/api/v1/admin/settings', { cookie: adminCookie });
    expect(after.body.data.requireTenantRepairConfirmation).toBe(false);
    // Flipping one switch leaves the other as it was.
    expect(after.body.data.autoCompleteMaintenanceOnInvoice).toBe(true);

    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: adminCookie,
          body: {},
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await cookieOf(manager),
          body: { requireTenantRepairConfirmation: true },
        })
      ).status,
    ).toBe(403);

    await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { requireTenantRepairConfirmation: true },
    });
  });
});

describe('repair follow-through: what the repair page shows and who is in the thread', () => {
  beforeAll(async () => {
    await resetDb();
    await setSettings({ requireTenantRepairConfirmation: true });
  });

  it('never returns a password hash or other private fields, and keeps the tenant’s email from the vendor', async () => {
    const w = await world();
    const got = async (cookie: string) => {
      const res = await apiFetch<{ data: Record<string, unknown> }>(`${MR}/${w.request.id}`, {
        cookie,
      });
      expect(res.status).toBe(200);
      return res;
    };

    for (const cookie of [
      w.cookies.tenant,
      w.cookies.vendor,
      w.cookies.manager,
      w.cookies.landlord,
    ]) {
      const res = await got(cookie);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('idDocumentUrl');
      expect(text).not.toContain('emergencyContact');
    }

    const asVendor = (await got(w.cookies.vendor)).body.data as {
      tenant: { email: string; name: string };
    };
    expect(asVendor.tenant.name).toBe(w.tenant.name);
    expect(asVendor.tenant.email).toBe('');
    const asManager = (await got(w.cookies.manager)).body.data as { tenant: { email: string } };
    expect(asManager.tenant.email).toBe(w.tenant.email);
  });

  it('adds a vendor assigned after the message thread was opened', async () => {
    const w = await world({ vendorId: null, status: 'SCHEDULED' });
    const open = (cookie: string) =>
      apiFetch('/api/v1/conversations', {
        method: 'POST',
        cookie,
        body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: w.request.id },
      });
    const created = await open(w.cookies.tenant);
    expect(created.status).toBe(201);

    const assigned = await apiFetch(`${MR}/${w.request.id}`, {
      method: 'PATCH',
      cookie: w.cookies.manager,
      body: { vendorId: w.vendor.id },
    });
    expect(assigned.status).toBe(200);

    // Assigned through the page: already in the thread.
    const members = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: created.body.data.id },
    });
    expect(members.map((m) => m.userId)).toContain(w.vendor.id);

    // The vendor can open the thread and write in it.
    const again = await open(w.cookies.vendor);
    expect(again.status).toBe(200);
    const sent = await apiFetch(`/api/v1/conversations/${created.body.data.id}/messages`, {
      method: 'POST',
      cookie: w.cookies.vendor,
      body: { body: 'I can come on Thursday.' },
    });
    expect(sent.status).toBe(201);
  });

  it('adds a vendor who was put on the job directly (no page) the next time the thread is opened', async () => {
    const w = await world({ vendorId: null, status: 'SCHEDULED' });
    const open = (cookie: string) =>
      apiFetch('/api/v1/conversations', {
        method: 'POST',
        cookie,
        body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: w.request.id },
      });
    const created = await open(w.cookies.tenant);
    await testPrisma.maintenanceRequest.update({
      where: { id: w.request.id },
      data: { vendorId: w.vendor.id },
    });
    expect((await open(w.cookies.vendor)).status).toBe(200);
    const members = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: created.body.data.id },
    });
    expect(members.map((m) => m.userId)).toContain(w.vendor.id);
  });
});
