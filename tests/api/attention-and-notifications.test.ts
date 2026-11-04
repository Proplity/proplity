import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  createMaintenanceRequest,
  createInvoice,
  createConversation,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';
const DAY = 24 * 60 * 60 * 1000;

type Row = { id: string; count: number; severity: string; href: string; detail: string | null };
const attention = async (user: { id: string; role: Role }) => {
  const cookie = await authCookie(user.id, user.role);
  const res = await apiFetch<{ data: Row[] }>('/api/v1/dashboard/attention', { cookie });
  expect(res.status).toBe(200);
  return res.body.data;
};
const notices = (recipientId: string) =>
  testPrisma.notification.findMany({ where: { recipientId }, orderBy: { createdAt: 'asc' } });

describe('dashboard: needs your attention', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('gives the property team one list of what is waiting, most urgent first, scoped to their own properties', async () => {
    const manager = await createUser(Role.MANAGER);
    const other = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { status: 'PENDING' });
    await createMaintenanceRequest(unit.id, tenant.id, { title: 'Broken gate' });
    await createInvoice({
      rentId: rent.id,
      status: 'OVERDUE',
      dueDate: new Date(Date.now() - DAY),
    });

    const rows = await attention(manager);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['rent-overdue']).toMatchObject({ count: 1, severity: 'high' });
    expect(byId['repairs-unassigned']).toMatchObject({ count: 1, detail: 'Broken gate' });
    expect(byId['rents-unsigned']).toMatchObject({
      count: 1,
      href: `/dashboard/tenants/${rent.id}`,
    });
    // High before medium.
    expect(rows.findIndex((r) => r.id === 'rent-overdue')).toBeLessThan(
      rows.findIndex((r) => r.id === 'repairs-unassigned'),
    );

    expect(await attention(other)).toEqual([]);
  });

  it('tells a tenant about a rent to sign, an overdue payment and an unfinished profile', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { status: 'PENDING' });
    await createInvoice({
      rentId: rent.id,
      status: 'OVERDUE',
      dueDate: new Date(Date.now() - DAY),
    });

    const rows = await attention(tenant);
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(['rent-to-sign', 'invoices-overdue', 'profile-incomplete']),
    );
    expect(rows.find((r) => r.id === 'profile-incomplete')?.href).toBe(
      '/dashboard/settings?tab=completion',
    );

    // Once signed, the rent drops off the list.
    await apiFetch(`/api/v1/rents/${rent.id}/sign`, {
      method: 'POST',
      cookie: await authCookie(tenant.id, tenant.role),
      body: { fullName: 'T Enant' },
    });
    expect((await attention(tenant)).map((r) => r.id)).not.toContain('rent-to-sign');
  });

  it('shows a vendor new jobs and finished jobs with no invoice, and an admin the review queue', async () => {
    const vendor = await createUser(Role.VENDOR);
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    await createMaintenanceRequest(unit.id, tenant.id, {
      title: 'Fix sink',
      vendorId: vendor.id,
      status: 'SCHEDULED',
    });
    await createMaintenanceRequest(unit.id, tenant.id, {
      title: 'Fix roof',
      vendorId: vendor.id,
      status: 'COMPLETED',
    });
    const vendorRows = await attention(vendor);
    expect(vendorRows.find((r) => r.id === 'jobs-new')?.detail).toBe('Fix sink');
    expect(vendorRows.find((r) => r.id === 'jobs-to-invoice')?.severity).toBe('high');

    const admin = await createUser(Role.ADMIN);
    await createProperty({ moderationStatus: 'PENDING_REVIEW' });
    expect((await attention(admin)).find((r) => r.id === 'admin-listings')?.count).toBeGreaterThan(
      0,
    );
  });
});

describe('notifications: actions that need someone', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('tells the other side when a rent is signed, and both when it is fully signed', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { status: 'PENDING' });

    await apiFetch(`/api/v1/rents/${rent.id}/sign`, {
      method: 'POST',
      cookie: await authCookie(tenant.id, tenant.role),
      body: { fullName: 'T Enant' },
    });
    expect((await notices(manager.id)).map((n) => n.title)).toContain('Tenant signed the rent');

    await apiFetch(`/api/v1/rents/${rent.id}/sign`, {
      method: 'POST',
      cookie: await authCookie(manager.id, manager.role),
      body: { fullName: 'M Anager' },
    });
    expect((await notices(tenant.id)).map((n) => n.title)).toContain('Rent fully signed');
    const mgr = await notices(manager.id);
    expect(mgr.find((n) => n.title === 'Rent fully signed')?.link).toBe(
      `/dashboard/tenants/${rent.id}`,
    );
  });

  it('tells a tenant when staff create a rent and when its status changes', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const created = await apiFetch<{ data: { id: string } }>('/api/v1/rents', {
      method: 'POST',
      cookie,
      body: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        rentAmount: 1_200_000,
        deposit: 0,
      },
    });
    expect(created.status).toBe(201);
    const titles = (await notices(tenant.id)).map((n) => n.title);
    expect(titles).toContain('Rent ready to sign');
    expect(titles.some((t) => t.startsWith('Invoice INV-'))).toBe(true);

    await apiFetch(`/api/v1/rents/${created.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'ACTIVE' },
    });
    expect((await notices(tenant.id)).map((n) => n.title)).toContain('Rent active');
  });

  it('tells the property team about a vendor invoice and asks the tenant to confirm the repair', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const request = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'IN_PROGRESS',
      // The invoice closes the job, which needs a photo of the finished work.
      afterPhotoUrls: ['/api/v1/files/after-photo'],
    });

    const res = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: await authCookie(vendor.id, vendor.role),
      body: {
        maintenanceRequestId: request.id,
        type: 'MAINTENANCE',
        amount: 48_375,
        dueDate: new Date(Date.now() + 14 * DAY).toISOString(),
        description: 'Replace trap',
      },
    });
    expect(res.status).toBe(201);
    const team = await notices(manager.id);
    expect(team.map((n) => n.title)).toContain('Job done, vendor invoice to pay');
    // Finishing a repair asks the tenant whether it is really fixed.
    expect((await notices(tenant.id)).map((n) => n.title)).toContain('Is your repair fixed?');
  });

  it('tells the vendor about a rating, and a violation or condition report reaches the tenant', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    await createRent(unit.id, tenant.id);
    const request = await createMaintenanceRequest(unit.id, tenant.id, {
      vendorId: vendor.id,
      status: 'COMPLETED',
    });

    await apiFetch(`/api/v1/maintenance/requests/${request.id}/rating`, {
      method: 'POST',
      cookie: await authCookie(tenant.id, tenant.role),
      body: { rating: 5, comment: 'Quick and tidy' },
    });
    expect((await notices(vendor.id)).map((n) => n.title)).toContain('You were rated 5/5');

    await apiFetch(`/api/v1/properties/${property.id}/units/${unit.id}/violations`, {
      method: 'POST',
      cookie: await authCookie(manager.id, manager.role),
      body: { description: 'Loud music after 11pm', severity: 'MINOR' },
    });
    expect((await notices(tenant.id)).map((n) => n.title)).toContain(
      'A violation was recorded for your unit',
    );
  });

  it('notifies the other person in a conversation once, until they read it', async () => {
    const a = await createUser(Role.TENANT);
    const b = await createUser(Role.MANAGER);
    const conversation = await createConversation('DIRECT', [a.id, b.id]);
    const cookie = await authCookie(a.id, a.role);
    const send = (body: string) =>
      apiFetch(`/api/v1/conversations/${conversation.id}/messages`, {
        method: 'POST',
        cookie,
        body: { body },
      });

    expect((await send('Hello')).status).toBe(201);
    expect((await send('Are you there?')).status).toBe(201);
    const got = (await notices(b.id)).filter(
      (n) => n.link === `/dashboard/messages?c=${conversation.id}`,
    );
    expect(got).toHaveLength(1);
    expect(got[0].body).toBe('Hello');
    expect(await notices(a.id)).toHaveLength(0);
  });

  it('the daily reminders job warns about rent due soon and rents ending, once each', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, {
      endDate: new Date(Date.now() + 30 * DAY),
    });
    await createInvoice({
      rentId: rent.id,
      dueDate: new Date(Date.now() + 2 * DAY),
      status: 'UNPAID',
    });

    const run = () =>
      apiFetch<{ result: { dueSoon: number; rentsEnding: number } }>('/api/v1/cron/reminders', {
        method: 'POST',
        headers: { 'x-cron-secret': CRON_SECRET },
      });
    const first = await run();
    expect(first.status).toBe(200);
    expect(first.body.result).toEqual({ dueSoon: 1, rentsEnding: 1 });
    const second = await run();
    expect(second.body.result).toEqual({ dueSoon: 0, rentsEnding: 0 });

    const titles = (await notices(tenant.id)).map((n) => n.title);
    expect(titles.some((t) => t.startsWith('Payment due soon: INV-'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Rent ending'))).toBe(true);
    expect((await notices(manager.id)).some((n) => n.title.startsWith('Rent ending'))).toBe(true);
  });

  it('the overdue job tells the tenant and the property team', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id, { gracePeriodDays: 0 });
    const invoice = await createInvoice({
      rentId: rent.id,
      dueDate: new Date(Date.now() - 3 * DAY),
      status: 'UNPAID',
    });

    await apiFetch('/api/v1/cron/overdue-flagger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect((await notices(tenant.id)).map((n) => n.title)).toContain(
      `Invoice ${invoice.invoiceNumber} is overdue`,
    );
    expect((await notices(manager.id)).map((n) => n.title)).toContain(
      `Rent overdue: ${invoice.invoiceNumber}`,
    );
  });
});
