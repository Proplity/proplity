import { beforeAll, describe, expect, it } from 'vitest';
import { Role, ViewingStatus } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createRent } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

// Owner decision of 2026-10-22 on ISS-149: only people who have rented or viewed a property review it.

const HOUR = 60 * 60 * 1000;

describe('only people who have been to a property can review it (ISS-149)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const property = await createProperty({ isPublished: true });
    const unit = await createUnit(property.id);
    const review = async (userId: string, rating = 4) => {
      const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
      return apiFetch(`/api/v1/properties/${property.id}/reviews`, {
        method: 'POST',
        cookie: await authCookie(user.id, user.role),
        body: { rating, comment: 'Seen it' },
      });
    };
    const viewing = (userId: string, status: ViewingStatus, offsetMs: number) =>
      testPrisma.propertyViewing.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          requestedById: userId,
          scheduledAt: new Date(Date.now() + offsetMs),
          status,
        },
      });
    return { property, unit, review, viewing };
  }

  it('refuses someone with no rent and no viewing, and stores nothing', async () => {
    const s = await setup();
    const stranger = await createUser(Role.TENANT);
    const res = await s.review(stranger.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REVIEW_NOT_ELIGIBLE');
    expect(await testPrisma.propertyReview.count({ where: { propertyId: s.property.id } })).toBe(0);
  });

  it('lets a tenant review, labelled Tenant and verified, even after the rent ended', async () => {
    const s = await setup();
    const tenant = await createUser(Role.TENANT);
    const rent = await createRent(s.unit.id, tenant.id);
    await testPrisma.rent.update({ where: { id: rent.id }, data: { status: 'TERMINATED' } });
    const res = await s.review(tenant.id, 5);
    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe('TENANT');
    expect(res.body.data.verified).toBe(true);
  });

  it('lets someone with a confirmed viewing that has passed review, labelled Visited', async () => {
    const s = await setup();
    const guest = await createUser(Role.TENANT);
    await s.viewing(guest.id, 'CONFIRMED', -2 * HOUR);
    const res = await s.review(guest.id, 3);
    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe('VISITOR');
    expect(res.body.data.verified).toBe(false);
  });

  it('counts a completed viewing too', async () => {
    const s = await setup();
    const guest = await createUser(Role.TENANT);
    await s.viewing(guest.id, 'COMPLETED', -2 * HOUR);
    expect((await s.review(guest.id)).status).toBe(201);
  });

  it('does not count a viewing that is still ahead, was only requested, or did not happen', async () => {
    const s = await setup();
    const future = await createUser(Role.TENANT);
    await s.viewing(future.id, 'CONFIRMED', 2 * HOUR);
    const requested = await createUser(Role.TENANT);
    await s.viewing(requested.id, 'REQUESTED', -2 * HOUR);
    const cancelled = await createUser(Role.TENANT);
    await s.viewing(cancelled.id, 'CANCELLED', -2 * HOUR);
    const noShow = await createUser(Role.TENANT);
    await s.viewing(noShow.id, 'NO_SHOW', -2 * HOUR);
    for (const user of [future, requested, cancelled, noShow]) {
      expect((await s.review(user.id)).status).toBe(403);
    }
  });

  it('does not count a viewing or rent at a different property', async () => {
    const s = await setup();
    const other = await createProperty({ isPublished: true });
    const otherUnit = await createUnit(other.id);
    const guest = await createUser(Role.TENANT);
    await testPrisma.propertyViewing.create({
      data: {
        propertyId: other.id,
        unitId: otherUnit.id,
        requestedById: guest.id,
        scheduledAt: new Date(Date.now() - 2 * HOUR),
        status: 'CONFIRMED',
      },
    });
    const tenant = await createUser(Role.TENANT);
    await createRent(otherUnit.id, tenant.id);
    expect((await s.review(guest.id)).status).toBe(403);
    expect((await s.review(tenant.id)).status).toBe(403);
  });

  it('shows the label on the review list and the property page', async () => {
    const s = await setup();
    const tenant = await createUser(Role.TENANT);
    await createRent(s.unit.id, tenant.id);
    const guest = await createUser(Role.TENANT);
    await s.viewing(guest.id, 'CONFIRMED', -2 * HOUR);
    await s.review(tenant.id, 5);
    await s.review(guest.id, 2);

    const list = await apiFetch<{ data: { kind: string }[] }>(
      `/api/v1/properties/${s.property.id}/reviews`,
    );
    expect(list.body.data.map((r) => r.kind).sort()).toEqual(['TENANT', 'VISITOR']);

    const page = await apiFetch<{ data: { reviews: { kind: string }[] } }>(
      `/api/v1/properties/${s.property.id}`,
    );
    expect(page.body.data.reviews.map((r) => r.kind).sort()).toEqual(['TENANT', 'VISITOR']);
  });
});
