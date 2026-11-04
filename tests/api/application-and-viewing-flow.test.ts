import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, bookableViewingTime } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const rent = (unitId: string, extra: Record<string, unknown> = {}) => ({
  unitId,
  startDate: '2027-01-01',
  endDate: '2027-12-31',
  rentAmount: 1_200_000,
  deposit: 0,
  ...extra,
});

describe('application review: notifications and tenancy (ISS-046)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id, isPublished: true });
    const unit = await createUnit(property.id);
    return {
      manager,
      tenant,
      property,
      unit,
      mCookie: await authCookie(manager.id, manager.role),
      tCookie: await authCookie(tenant.id, tenant.role),
    };
  }

  it('tells the manager about a new application and the applicant about the decision', async () => {
    const { manager, tenant, unit, mCookie, tCookie } = await setup();
    const created = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: tCookie,
      body: { unitId: unit.id, details: { firstName: 'Ada' } },
    });
    expect(created.status).toBe(201);
    const forManager = await testPrisma.notification.findMany({
      where: { recipientId: manager.id, title: 'New rental application' },
    });
    expect(forManager).toHaveLength(1);

    const reviewed = await apiFetch(`/api/v1/applications/${created.body.data.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'APPROVED' },
    });
    expect(reviewed.status).toBe(200);
    const forApplicant = await testPrisma.notification.findMany({
      where: { recipientId: tenant.id, title: 'Application approved' },
    });
    expect(forApplicant).toHaveLength(1);
  });

  it('creates the tenancy from an approved application and links it', async () => {
    const { tenant, unit, mCookie, tCookie } = await setup();
    const app = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: tCookie,
      body: { unitId: unit.id, details: {} },
    });
    const id = app.body.data.id as string;

    // Not approved yet -> refused.
    const early = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie: mCookie,
      body: rent(unit.id, { applicationId: id }),
    });
    expect(early.status).toBe(409);

    await apiFetch(`/api/v1/applications/${id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'APPROVED' },
    });
    const res = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie: mCookie,
      body: rent(unit.id, { applicationId: id }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant.id);
    const linked = await testPrisma.application.findUnique({ where: { id } });
    expect(linked?.rentId).toBe(res.body.data.id);

    // Same application cannot start a second tenancy.
    const again = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie: mCookie,
      body: rent(unit.id, { applicationId: id }),
    });
    expect(again.status).toBe(409);
  });

  it('rejects an application that belongs to a different unit', async () => {
    const { property, unit, mCookie, tCookie } = await setup();
    const other = await createUnit(property.id);
    const app = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: tCookie,
      body: { unitId: unit.id, details: {} },
    });
    const res = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie: mCookie,
      body: rent(other.id, { applicationId: app.body.data.id }),
    });
    expect(res.status).toBe(404);
  });
});

describe('viewing requests: confirm / decline / cancel (ISS-047)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function booked() {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id, isPublished: true });
    const mCookie = await authCookie(manager.id, manager.role);
    const tCookie = await authCookie(tenant.id, tenant.role);
    const when = bookableViewingTime();
    const res = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie: tCookie,
      body: { scheduledAt: when },
    });
    return { manager, tenant, property, mCookie, tCookie, viewing: res.body.data, res };
  }

  it('starts as a request and notifies the manager', async () => {
    const { manager, viewing, res } = await booked();
    expect(res.status).toBe(201);
    expect(viewing.status).toBe('REQUESTED');
    const n = await testPrisma.notification.findMany({
      where: { recipientId: manager.id, title: 'New viewing request' },
    });
    expect(n).toHaveLength(1);
  });

  it('lets the manager confirm, and tells the requester', async () => {
    const { tenant, property, mCookie, viewing } = await booked();
    const res = await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CONFIRMED' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
    const n = await testPrisma.notification.findMany({
      where: { recipientId: tenant.id, title: 'Viewing confirmed' },
    });
    expect(n).toHaveLength(1);
  });

  it('does not let the requester confirm their own viewing, but lets them cancel it', async () => {
    const { property, tCookie, viewing, manager } = await booked();
    const forbidden = await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: tCookie,
      body: { status: 'CONFIRMED' },
    });
    expect(forbidden.status).toBe(403);

    const cancel = await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: tCookie,
      body: { status: 'CANCELLED' },
    });
    expect(cancel.status).toBe(200);
    const n = await testPrisma.notification.findMany({
      where: { recipientId: manager.id, title: 'Viewing cancelled' },
    });
    expect(n).toHaveLength(1);
  });

  it('refuses a stranger and an already-decided viewing', async () => {
    const { property, mCookie, viewing } = await booked();
    const stranger = await createUser(Role.TENANT);
    const sCookie = await authCookie(stranger.id, stranger.role);
    const no = await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: sCookie,
      body: { status: 'CANCELLED' },
    });
    expect(no.status).toBe(403);

    await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CANCELLED' },
    });
    const again = await apiFetch(`/api/v1/properties/${property.id}/viewings/${viewing.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CONFIRMED' },
    });
    expect(again.status).toBe(409);
  });
});
