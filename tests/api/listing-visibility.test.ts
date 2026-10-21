import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  bookableViewingTime,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { PRIVATE_UNIT_FLAG } from '../../lib/api/propertyAccess';

// Applying for a unit and booking or looking up a viewing need a listing someone can see (ISS-143).

describe('applications and viewings need a listed property (ISS-143)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup(property: Parameters<typeof createProperty>[0]) {
    const manager = await createUser(Role.MANAGER);
    const prospect = await createUser(Role.TENANT);
    const prop = await createProperty({ managerId: manager.id, ...property });
    const unit = await createUnit(prop.id);
    return {
      manager,
      prospect,
      prop,
      unit,
      prospectCookie: await authCookie(prospect.id, prospect.role),
      managerCookie: await authCookie(manager.id, manager.role),
    };
  }

  const apply = (cookie: string, unitId: string) =>
    apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie,
      body: { unitId, details: {} },
    });
  const book = (cookie: string, propertyId: string, unitId?: string) =>
    apiFetch(`/api/v1/properties/${propertyId}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: bookableViewingTime(), unitId },
    });
  const taken = (cookie: string, propertyId: string) =>
    apiFetch(`/api/v1/properties/${propertyId}/viewings/availability?date=2030-01-07`, { cookie });

  it('answers not found for a property that is not published', async () => {
    const s = await setup({ isPublished: false });
    expect((await apply(s.prospectCookie, s.unit.id)).status).toBe(404);
    expect((await book(s.prospectCookie, s.prop.id)).status).toBe(404);
    expect((await taken(s.prospectCookie, s.prop.id)).status).toBe(404);
    expect(await testPrisma.application.count({ where: { unitId: s.unit.id } })).toBe(0);
    expect(await testPrisma.propertyViewing.count({ where: { propertyId: s.prop.id } })).toBe(0);
  });

  it('answers not found for a listing an admin has not approved', async () => {
    const s = await setup({ isPublished: true, moderationStatus: 'PENDING_REVIEW' });
    expect((await apply(s.prospectCookie, s.unit.id)).status).toBe(404);
    expect((await book(s.prospectCookie, s.prop.id)).status).toBe(404);
    expect((await taken(s.prospectCookie, s.prop.id)).status).toBe(404);
  });

  it('answers not found for a unit marked private, but not for the public ones beside it', async () => {
    const s = await setup({ isPublished: true });
    const privateUnit = await createUnit(s.prop.id, { amenities: [PRIVATE_UNIT_FLAG] });
    expect((await apply(s.prospectCookie, privateUnit.id)).status).toBe(404);
    expect((await book(s.prospectCookie, s.prop.id, privateUnit.id)).status).toBe(404);
    expect((await apply(s.prospectCookie, s.unit.id)).status).toBe(201);
    expect((await book(s.prospectCookie, s.prop.id, s.unit.id)).status).toBe(201);
  });

  it('answers not found for a building whose units are all private', async () => {
    const s = await setup({ isPublished: true });
    await testPrisma.unit.update({
      where: { id: s.unit.id },
      data: { amenities: [PRIVATE_UNIT_FLAG] },
    });
    expect((await book(s.prospectCookie, s.prop.id)).status).toBe(404);
    expect((await taken(s.prospectCookie, s.prop.id)).status).toBe(404);
  });

  it('refuses a unit that belongs to another property', async () => {
    const s = await setup({ isPublished: true });
    const other = await setup({ isPublished: true });
    expect((await book(s.prospectCookie, s.prop.id, other.unit.id)).status).toBe(404);
  });

  it('works as before on a published, approved listing', async () => {
    const s = await setup({ isPublished: true });
    expect((await apply(s.prospectCookie, s.unit.id)).status).toBe(201);
    expect((await book(s.prospectCookie, s.prop.id)).status).toBe(201);
    expect((await taken(s.prospectCookie, s.prop.id)).status).toBe(200);
  });

  it('lets the property team and the people living there use an unlisted property', async () => {
    const s = await setup({ isPublished: false });
    expect((await book(s.managerCookie, s.prop.id)).status).toBe(201);
    expect((await taken(s.managerCookie, s.prop.id)).status).toBe(200);

    const resident = await createUser(Role.TENANT);
    await createLease(s.unit.id, resident.id, { status: 'ACTIVE' });
    const residentCookie = await authCookie(resident.id, resident.role);
    expect((await taken(residentCookie, s.prop.id)).status).toBe(200);
    expect((await apply(residentCookie, s.unit.id)).status).toBe(201);
  });
});
