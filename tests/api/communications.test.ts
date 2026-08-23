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

describe('conversations: create -- MAINTENANCE_THREAD', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires maintenanceRequestId, 404s unknown, forbids a stranger, and derives participants', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    const stranger = await createUser(Role.TENANT);

    const tenantCookie = await authCookie(tenant.id, tenant.role);

    const missing = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: tenantCookie,
      body: { type: 'MAINTENANCE_THREAD' },
    });
    expect(missing.status).toBe(400);

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: strangerCookie,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: request.id },
    });
    expect(forbidden.status).toBe(403);

    const created = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: tenantCookie,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: request.id },
    });
    expect(created.status).toBe(201);

    const participants = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: created.body.data.id },
    });
    const participantIds = participants.map((p) => p.userId).sort();
    expect(participantIds).toEqual([tenant.id, vendor.id, manager.id].sort());
  });

  it('is idempotent: a second POST for the same request returns the existing thread, not a duplicate', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const request = await createMaintenanceRequest(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);

    const first = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: request.id },
    });
    const second = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie,
      body: { type: 'MAINTENANCE_THREAD', maintenanceRequestId: request.id },
    });
    expect(second.body.data.id).toBe(first.body.data.id);

    const count = await testPrisma.conversation.count({ where: { maintenanceRequestId: request.id } });
    expect(count).toBe(1);
  });
});

describe('conversations: create -- LEASE_THREAD and COMMUNITY_DISCUSSION', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('LEASE_THREAD forbids a stranger and derives tenant + manager + landlord as participants', async () => {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const stranger = await createUser(Role.TENANT);

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: strangerCookie,
      body: { type: 'LEASE_THREAD', leaseId: lease.id },
    });
    expect(forbidden.status).toBe(403);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const created = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: tenantCookie,
      body: { type: 'LEASE_THREAD', leaseId: lease.id },
    });
    expect(created.status).toBe(201);

    const participants = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: created.body.data.id },
    });
    expect(participants.map((p) => p.userId).sort()).toEqual([tenant.id, manager.id, landlord.id].sort());
  });

  it('COMMUNITY_DISCUSSION requires an active lease or management on the property, and includes every active tenant', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit1 = await createUnit(property.id);
    const unit2 = await createUnit(property.id);
    const tenant1 = await createUser(Role.TENANT);
    const tenant2 = await createUser(Role.TENANT);
    await createLease(unit1.id, tenant1.id);
    await createLease(unit2.id, tenant2.id);
    const outsider = await createUser(Role.TENANT);

    const outsiderCookie = await authCookie(outsider.id, outsider.role);
    const forbidden = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: outsiderCookie,
      body: { type: 'COMMUNITY_DISCUSSION', propertyId: property.id },
    });
    expect(forbidden.status).toBe(403);

    const tenant1Cookie = await authCookie(tenant1.id, tenant1.role);
    const created = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: tenant1Cookie,
      body: { type: 'COMMUNITY_DISCUSSION', propertyId: property.id, title: 'Building Chat' },
    });
    expect(created.status).toBe(201);

    const participants = await testPrisma.conversationParticipant.findMany({
      where: { conversationId: created.body.data.id },
    });
    const ids = participants.map((p) => p.userId);
    expect(ids).toEqual(expect.arrayContaining([tenant1.id, tenant2.id, manager.id]));
  });
});

describe('conversations: create -- DIRECT dedup, and list', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('DIRECT requires participantIds, auto-includes the caller, and dedups a repeat 1:1 thread', async () => {
    const userA = await createUser(Role.TENANT);
    const userB = await createUser(Role.MANAGER);
    const cookieA = await authCookie(userA.id, userA.role);

    const empty = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: cookieA,
      body: { type: 'DIRECT', participantIds: [] },
    });
    expect(empty.status).toBe(400);

    const first = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: cookieA,
      body: { type: 'DIRECT', participantIds: [userB.id] },
    });
    expect(first.status).toBe(201);

    const second = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      cookie: cookieA,
      body: { type: 'DIRECT', participantIds: [userB.id] },
    });
    expect(second.body.data.id).toBe(first.body.data.id);

    const count = await testPrisma.conversation.count({ where: { type: 'DIRECT' } });
    expect(count).toBe(1);
  });

  it('GET /conversations only returns conversations the caller participates in', async () => {
    const member = await createUser(Role.TENANT);
    const nonMember = await createUser(Role.TENANT);
    const other = await createUser(Role.MANAGER);
    await createConversation('DIRECT', [member.id, other.id]);

    const memberCookie = await authCookie(member.id, member.role);
    const memberRes = await apiFetch('/api/v1/conversations', { cookie: memberCookie });
    expect(memberRes.body.data.length).toBe(1);

    const nonMemberCookie = await authCookie(nonMember.id, nonMember.role);
    const nonMemberRes = await apiFetch('/api/v1/conversations', { cookie: nonMemberCookie });
    expect(nonMemberRes.body.data.length).toBe(0);
  });
});

describe('messages: participant gating, and the unreadCount lifecycle (Phase 9.5 fix)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('forbids a non-participant from reading or sending messages', async () => {
    const memberA = await createUser(Role.TENANT);
    const memberB = await createUser(Role.MANAGER);
    const outsider = await createUser(Role.TENANT);
    const conversation = await createConversation('DIRECT', [memberA.id, memberB.id]);

    const outsiderCookie = await authCookie(outsider.id, outsider.role);
    const getRes = await apiFetch(`/api/v1/conversations/${conversation.id}/messages`, { cookie: outsiderCookie });
    expect(getRes.status).toBe(403);

    const postRes = await apiFetch(`/api/v1/conversations/${conversation.id}/messages`, {
      method: 'POST',
      cookie: outsiderCookie,
      body: { body: 'sneaky' },
    });
    expect(postRes.status).toBe(403);
  });

  it('unreadCount grows for the recipient on a new message, then clears once they read it, and flips back on a reply', async () => {
    const sender = await createUser(Role.TENANT);
    const recipient = await createUser(Role.MANAGER);
    const conversation = await createConversation('DIRECT', [sender.id, recipient.id]);
    const senderCookie = await authCookie(sender.id, sender.role);
    const recipientCookie = await authCookie(recipient.id, recipient.role);

    const sent = await apiFetch(`/api/v1/conversations/${conversation.id}/messages`, {
      method: 'POST',
      cookie: senderCookie,
      body: { body: 'Hello there' },
    });
    expect(sent.status).toBe(201);

    const recipientList = await apiFetch('/api/v1/conversations', { cookie: recipientCookie });
    const recipientView = recipientList.body.data.find((c: any) => c.id === conversation.id);
    expect(recipientView.unreadCount).toBe(1);

    // Reading the thread marks it read (the Phase 9.5 fix).
    const read = await apiFetch(`/api/v1/conversations/${conversation.id}/messages`, { cookie: recipientCookie });
    expect(read.status).toBe(200);
    expect(read.body.data.map((m: any) => m.body)).toContain('Hello there');

    const afterRead = await apiFetch('/api/v1/conversations', { cookie: recipientCookie });
    expect(afterRead.body.data.find((c: any) => c.id === conversation.id).unreadCount).toBe(0);

    // A reply from the recipient should now show up as unread for the
    // original sender.
    await apiFetch(`/api/v1/conversations/${conversation.id}/messages`, {
      method: 'POST',
      cookie: recipientCookie,
      body: { body: 'Hi back' },
    });
    const senderList = await apiFetch('/api/v1/conversations', { cookie: senderCookie });
    expect(senderList.body.data.find((c: any) => c.id === conversation.id).unreadCount).toBe(1);
  });
});
