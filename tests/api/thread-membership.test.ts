import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createMaintenanceRequest,
  createConversation,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

// Who is in a message thread follows the link that put them there (ISS-142).

type Message = { id: string; body: string; sender?: { name: string } | null };

describe('a tenant whose tenancy ends keeps the history but not the conversation (ISS-142)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const neighbour = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const otherUnit = await createUnit(property.id);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    await createLease(otherUnit.id, neighbour.id, { status: 'ACTIVE' });
    const leaseThread = await createConversation('LEASE_THREAD', [manager.id, tenant.id], {
      leaseId: lease.id,
    });
    const board = await createConversation(
      'COMMUNITY_DISCUSSION',
      [manager.id, tenant.id, neighbour.id],
      { propertyId: property.id },
    );
    const managerCookie = await authCookie(manager.id, manager.role);
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const post = (cookie: string, conversationId: string, body: string) =>
      apiFetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        cookie,
        body: { body },
      });
    const read = (cookie: string, conversationId: string) =>
      apiFetch<{ data: Message[] }>(`/api/v1/conversations/${conversationId}/messages`, {
        cookie,
      });
    const patchLease = (status: string) =>
      apiFetch(`/api/v1/leases/${lease.id}`, {
        method: 'PATCH',
        cookie: managerCookie,
        body: { status },
      });
    return {
      manager,
      tenant,
      neighbour,
      property,
      lease,
      leaseThread,
      board,
      managerCookie,
      tenantCookie,
      post,
      read,
      patchLease,
    };
  }

  it('freezes the lease and community threads for them when the lease is terminated', async () => {
    const s = await setup();
    expect((await s.post(s.tenantCookie, s.leaseThread.id, 'before it ends')).status).toBe(201);
    expect((await s.post(s.tenantCookie, s.board.id, 'hello neighbours')).status).toBe(201);

    expect((await s.patchLease('TERMINATED')).status).toBe(200);

    // They cannot add to either thread...
    expect((await s.post(s.tenantCookie, s.leaseThread.id, 'after')).status).toBe(403);
    expect((await s.post(s.tenantCookie, s.board.id, 'after')).status).toBe(403);

    // ...the manager still can, and the tenant does not see it...
    expect((await s.post(s.managerCookie, s.leaseThread.id, 'after the move-out')).status).toBe(
      201,
    );
    expect((await s.post(s.managerCookie, s.board.id, 'new notice for the building')).status).toBe(
      201,
    );

    // ...but they still read what was said while they were a tenant.
    const mine = await s.read(s.tenantCookie, s.leaseThread.id);
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((m) => m.body)).toEqual(['before it ends']);
    const board = await s.read(s.tenantCookie, s.board.id);
    expect(board.body.data.map((m) => m.body)).toEqual(['hello neighbours']);

    // Their inbox shows the thread as it stood, with no unread count for what they cannot read.
    const inbox = await apiFetch<{
      data: { id: string; leftAt: string | null; unreadCount: number; lastMessage: Message }[];
    }>('/api/v1/conversations', { cookie: s.tenantCookie });
    const thread = inbox.body.data.find((c) => c.id === s.leaseThread.id);
    expect(thread?.leftAt).toBeTruthy();
    expect(thread?.lastMessage.body).toBe('before it ends');
    expect(thread?.unreadCount).toBe(0);
  });

  it('does not notify them of messages written after they left', async () => {
    const s = await setup();
    await s.patchLease('EXPIRED');
    await s.post(s.managerCookie, s.leaseThread.id, 'deposit is on its way');
    const notes = await testPrisma.notification.count({ where: { recipientId: s.tenant.id } });
    // Only the "lease expired" notice; nothing about the new message.
    expect(notes).toBe(1);
  });

  it('leaves the neighbours, and the tenant when a renewal keeps them in the unit, untouched', async () => {
    const s = await setup();
    const res = await apiFetch(`/api/v1/leases/${s.lease.id}`, {
      method: 'PATCH',
      cookie: s.managerCookie,
      body: {
        renew: {
          startDate: '2027-01-01',
          endDate: '2027-12-31',
          rentAmount: 1_000_000,
          deposit: 0,
        },
      },
    });
    expect(res.status).toBe(201);
    expect((await s.post(s.tenantCookie, s.board.id, 'still here')).status).toBe(201);
    const neighbourCookie = await authCookie(s.neighbour.id, 'TENANT');
    expect((await s.post(neighbourCookie, s.board.id, 'me too')).status).toBe(201);
  });

  it('keeps a tenant in the community board while another of their leases there is active', async () => {
    const s = await setup();
    const second = await createUnit(s.property.id);
    await createLease(second.id, s.tenant.id, { status: 'ACTIVE' });
    await s.patchLease('TERMINATED');
    expect((await s.post(s.tenantCookie, s.leaseThread.id, 'x')).status).toBe(403);
    expect((await s.post(s.tenantCookie, s.board.id, 'still a resident')).status).toBe(201);
  });

  it('lets them post again if the lease is set active again', async () => {
    const s = await setup();
    await s.patchLease('TERMINATED');
    expect((await s.post(s.tenantCookie, s.leaseThread.id, 'locked')).status).toBe(403);
    await s.patchLease('ACTIVE');
    expect((await s.post(s.tenantCookie, s.leaseThread.id, 'back')).status).toBe(201);
    expect((await s.post(s.tenantCookie, s.board.id, 'back too')).status).toBe(201);
  });
});

describe('a property that moves to another manager or landlord takes its old staff out of its threads (ISS-142)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('removes the old manager from every thread of the property and adds the new one', async () => {
    const admin = await createUser(Role.ADMIN);
    const oldManager = await createUser(Role.MANAGER, { name: 'Old Manager' });
    const newManager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const property = await createProperty({
      managerId: oldManager.id,
      landlordId: landlord.id,
    });
    const unit = await createUnit(property.id);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });

    const leaseThread = await createConversation(
      'LEASE_THREAD',
      [oldManager.id, tenant.id, landlord.id],
      {
        leaseId: lease.id,
      },
    );
    const board = await createConversation(
      'COMMUNITY_DISCUSSION',
      [oldManager.id, tenant.id, landlord.id],
      { propertyId: property.id },
    );
    const repair = await createConversation(
      'MAINTENANCE_THREAD',
      [oldManager.id, tenant.id, vendor.id, landlord.id],
      { maintenanceRequestId: request.id },
    );
    // Unrelated to the property: must not be touched.
    const direct = await createConversation('DIRECT', [oldManager.id, tenant.id]);
    await testPrisma.message.create({
      data: {
        conversationId: leaseThread.id,
        senderId: oldManager.id,
        senderType: 'USER',
        body: 'welcome',
      },
    });

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { managerId: newManager.id },
    });
    expect(res.status).toBe(200);

    const members = async (conversationId: string) =>
      (
        await testPrisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        })
      )
        .map((p) => p.userId)
        .sort();
    const sorted = (...ids: string[]) => ids.sort();

    expect(await members(leaseThread.id)).toEqual(sorted(newManager.id, tenant.id, landlord.id));
    expect(await members(board.id)).toEqual(sorted(newManager.id, tenant.id, landlord.id));
    expect(await members(repair.id)).toEqual(
      sorted(newManager.id, tenant.id, vendor.id, landlord.id),
    );
    expect(await members(direct.id)).toEqual(sorted(oldManager.id, tenant.id));

    // The old manager can no longer read the lease thread; the tenant still sees who wrote 'welcome'.
    const oldCookie = await authCookie(oldManager.id, oldManager.role);
    expect(
      (await apiFetch(`/api/v1/conversations/${leaseThread.id}/messages`, { cookie: oldCookie }))
        .status,
    ).toBe(403);
    const asTenant = await apiFetch<{ data: Message[] }>(
      `/api/v1/conversations/${leaseThread.id}/messages`,
      { cookie: await authCookie(tenant.id, tenant.role) },
    );
    expect(asTenant.body.data[0].sender?.name).toBe('Old Manager');
  });

  it('swaps the landlord the same way and leaves the manager in', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const oldLandlord = await createUser(Role.LANDLORD);
    const newLandlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ managerId: manager.id, landlordId: oldLandlord.id });
    const board = await createConversation('COMMUNITY_DISCUSSION', [manager.id, oldLandlord.id], {
      propertyId: property.id,
    });

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { landlordId: newLandlord.id },
    });
    expect(res.status).toBe(200);

    const ids = (
      await testPrisma.conversationParticipant.findMany({ where: { conversationId: board.id } })
    ).map((p) => p.userId);
    expect(ids.sort()).toEqual([manager.id, newLandlord.id].sort());
  });

  it('does not touch the threads when the same person is named again', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const board = await createConversation('COMMUNITY_DISCUSSION', [manager.id], {
      propertyId: property.id,
    });
    await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { managerId: manager.id, name: 'Renamed' },
    });
    expect(
      await testPrisma.conversationParticipant.count({ where: { conversationId: board.id } }),
    ).toBe(1);
  });
});
