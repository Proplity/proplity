import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createMaintenanceRequest,
  createNotification,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('notifications: GET /api/v1/notifications', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("only returns the caller's own notifications, newest first, with an accurate unreadCount", async () => {
    const owner = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    await createNotification(owner.id, { title: 'First', isRead: true });
    await createNotification(owner.id, { title: 'Second', isRead: false });
    await createNotification(stranger.id, { title: 'Not mine' });

    const cookie = await authCookie(owner.id, owner.role);
    const res = await apiFetch('/api/v1/notifications', { cookie });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].title).toBe('Second');
    expect(res.body.meta.unreadCount).toBe(1);
    expect(res.body.data.every((n: any) => n.recipientId === owner.id)).toBe(true);
  });

  it('paginates by cursor: hasMore and nextCursor advance correctly', async () => {
    const user = await createUser(Role.TENANT);
    for (let i = 0; i < 3; i++) {
      await createNotification(user.id, { title: `N${i}` });
    }
    const cookie = await authCookie(user.id, user.role);

    const firstPage = await apiFetch('/api/v1/notifications?limit=2', { cookie });
    expect(firstPage.body.data.length).toBe(2);
    expect(firstPage.body.meta.hasMore).toBe(true);
    expect(firstPage.body.meta.nextCursor).toBeTruthy();

    const secondPage = await apiFetch(
      `/api/v1/notifications?limit=2&cursor=${firstPage.body.meta.nextCursor}`,
      { cookie },
    );
    expect(secondPage.body.data.length).toBe(1);
    expect(secondPage.body.meta.hasMore).toBe(false);
    expect(secondPage.body.meta.nextCursor).toBeNull();

    const seenIds = new Set([
      ...firstPage.body.data.map((n: any) => n.id),
      ...secondPage.body.data.map((n: any) => n.id),
    ]);
    expect(seenIds.size).toBe(3);
  });
});

describe('notifications: PATCH /api/v1/notifications/[id]', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("marks a notification read (and back to unread), 404s an unknown id and another user's notification", async () => {
    const owner = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const notification = await createNotification(owner.id, { isRead: false });
    const theirs = await createNotification(stranger.id, { isRead: false });

    const cookie = await authCookie(owner.id, owner.role);

    const markRead = await apiFetch(`/api/v1/notifications/${notification.id}`, {
      method: 'PATCH',
      cookie,
      body: { isRead: true },
    });
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.isRead).toBe(true);

    const markUnread = await apiFetch(`/api/v1/notifications/${notification.id}`, {
      method: 'PATCH',
      cookie,
      body: { isRead: false },
    });
    expect(markUnread.body.data.isRead).toBe(false);

    const unknown = await apiFetch('/api/v1/notifications/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      cookie,
      body: { isRead: true },
    });
    expect(unknown.status).toBe(404);

    const notMine = await apiFetch(`/api/v1/notifications/${theirs.id}`, {
      method: 'PATCH',
      cookie,
      body: { isRead: true },
    });
    expect(notMine.status).toBe(404);
    const stillUnread = await testPrisma.notification.findUnique({ where: { id: theirs.id } });
    expect(stillUnread?.isRead).toBe(false);
  });
});

describe('notifications: POST /api/v1/notifications/mark-all-read', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('marks every unread notification read for the caller only, leaving other users untouched', async () => {
    const owner = await createUser(Role.TENANT);
    const other = await createUser(Role.TENANT);
    await createNotification(owner.id, { isRead: false });
    await createNotification(owner.id, { isRead: false });
    await createNotification(owner.id, { isRead: true });
    await createNotification(other.id, { isRead: false });

    const cookie = await authCookie(owner.id, owner.role);
    const res = await apiFetch('/api/v1/notifications/mark-all-read', {
      method: 'POST',
      cookie,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(2);

    const ownerUnread = await testPrisma.notification.count({
      where: { recipientId: owner.id, isRead: false },
    });
    expect(ownerUnread).toBe(0);

    const otherUnread = await testPrisma.notification.count({
      where: { recipientId: other.id, isRead: false },
    });
    expect(otherUnread).toBe(1);
  });
});

describe('notifications: DELETE /api/v1/notifications/[id]', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("deletes the caller's own notification, 404s another user's", async () => {
    const owner = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const mine = await createNotification(owner.id);
    const theirs = await createNotification(stranger.id);

    const cookie = await authCookie(owner.id, owner.role);

    const forbidden = await apiFetch(`/api/v1/notifications/${theirs.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(forbidden.status).toBe(404);

    const ok = await apiFetch(`/api/v1/notifications/${mine.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(ok.status).toBe(200);
    expect(await testPrisma.notification.findUnique({ where: { id: mine.id } })).toBeNull();
  });
});

describe('notifications: announcement trigger', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('notifies every tenant with an ACTIVE lease on the property, and nobody else', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, name: 'Sunset Court' });
    const unit1 = await createUnit(property.id);
    const unit2 = await createUnit(property.id);
    const unit3 = await createUnit(property.id);
    const activeTenant = await createUser(Role.TENANT);
    const anotherActiveTenant = await createUser(Role.TENANT);
    const formerTenant = await createUser(Role.TENANT);
    const unrelatedUser = await createUser(Role.TENANT);
    await createLease(unit1.id, activeTenant.id, { status: 'ACTIVE' });
    await createLease(unit2.id, anotherActiveTenant.id, { status: 'ACTIVE' });
    await createLease(unit3.id, formerTenant.id, { status: 'TERMINATED' });

    const managerCookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}/announcements`, {
      method: 'POST',
      cookie: managerCookie,
      body: { title: 'Water shutoff Tuesday', body: 'Maintenance from 9am-12pm' },
    });
    expect(res.status).toBe(201);

    const notified = await testPrisma.notification.findMany({ where: { type: 'ANNOUNCEMENT' } });
    const recipientIds = notified.map((n) => n.recipientId).sort();
    expect(recipientIds).toEqual([activeTenant.id, anotherActiveTenant.id].sort());
    expect(recipientIds).not.toContain(formerTenant.id);
    expect(recipientIds).not.toContain(unrelatedUser.id);
    expect(notified[0].title).toContain('Sunset Court');
    expect(notified[0].body).toBe('Water shutoff Tuesday');
    expect(notified[0].link).toBe(`/dashboard/properties/${property.id}`);
  });
});

describe('notifications: maintenance status trigger', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('notifies the tenant when a manager assigns a vendor, but not when the tenant cancels their own request', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id);

    const managerCookie = await authCookie(manager.id, manager.role);
    const assign = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { vendorId: vendor.id },
    });
    expect(assign.status).toBe(200);

    const afterAssign = await testPrisma.notification.findMany({
      where: { recipientId: tenant.id, type: 'MAINTENANCE_STATUS' },
    });
    expect(afterAssign.length).toBe(1);
    expect(afterAssign[0].body).toContain('vendor');

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const cancel = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { status: 'CANCELLED' },
    });
    expect(cancel.status).toBe(200);

    // Still just the one notification from the vendor assignment -- the
    // tenant cancelling their own request shouldn't notify themselves.
    const afterSelfCancel = await testPrisma.notification.count({
      where: { recipientId: tenant.id, type: 'MAINTENANCE_STATUS' },
    });
    expect(afterSelfCancel).toBe(1);
  });

  it('notifies the tenant when the assigned vendor moves the request to IN_PROGRESS and COMPLETED', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    const vendorCookie = await authCookie(vendor.id, vendor.role);

    const inProgress = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: { status: 'IN_PROGRESS' },
    });
    expect(inProgress.status).toBe(200);

    const completed = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie: vendorCookie,
      body: {
        status: 'COMPLETED',
        completionProofUrl: 'https://example.com/proof.jpg',
        finalCost: 5000,
      },
    });
    expect(completed.status).toBe(200);

    const notifications = await testPrisma.notification.findMany({
      where: { recipientId: tenant.id, type: 'MAINTENANCE_STATUS' },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications.length).toBe(2);
    expect(notifications[0].body).toContain('started');
    expect(notifications[1].body).toContain('completed');
    expect(notifications.every((n) => n.link === `/dashboard/maintenance/${request.id}`)).toBe(
      true,
    );
  });
});
