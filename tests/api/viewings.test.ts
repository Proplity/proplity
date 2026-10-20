import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb } from '../helpers/db';
import { createUser, createProperty, bookableViewingTime } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import {
  VIEWING_TIMES,
  isSunday,
  toLocalDateKey,
  viewingDateKey,
  viewingDateRange,
  viewingDayBounds,
  viewingInstant,
  viewingTimeKey,
  viewingTimeProblem,
} from '../../lib/viewingSlots';

describe('viewing times (ISS-042)', () => {
  it('offers half-hour starts from 9:00 AM to 5:00 PM', () => {
    expect(VIEWING_TIMES[0]).toEqual({ value: '09:00', label: '9:00 AM' });
    expect(VIEWING_TIMES.at(-1)).toEqual({ value: '17:00', label: '5:00 PM' });
    expect(VIEWING_TIMES.find((t) => t.value === '12:30')?.label).toBe('12:30 PM');
    expect(VIEWING_TIMES).toHaveLength(17);
  });

  it('allows dates from tomorrow up to 60 days ahead', () => {
    const range = viewingDateRange(new Date(2026, 9, 13)); // Tue 13 Oct 2026
    expect(range).toEqual({ min: '2026-10-14', max: '2026-12-12' });
  });

  it('knows which days are Sundays', () => {
    expect(isSunday('2026-10-18')).toBe(true);
    expect(isSunday('2026-10-19')).toBe(false);
  });

  it('reads a booked time in Lagos time, whatever zone the browser is in', () => {
    // 10:00 in Lagos (UTC+1) is 09:00 UTC.
    expect(viewingInstant('2026-10-20', '10:00').toISOString()).toBe('2026-10-20T09:00:00.000Z');
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '09:00'))).toBeNull();
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '17:00'))).toBeNull();
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '08:30'))).toMatch(
      /9:00 AM and 5:00 PM/,
    );
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '17:30'))).toMatch(
      /9:00 AM and 5:00 PM/,
    );
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '03:00'))).not.toBeNull();
    expect(viewingTimeProblem(viewingInstant('2026-10-25', '10:00'))).toMatch(/Sundays/);
  });

  it('only accepts the half-hour starts the form offers (ISS-104)', () => {
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '10:30'))).toBeNull();
    expect(viewingTimeProblem(viewingInstant('2026-10-20', '10:15'))).toMatch(/half hour/);
    expect(viewingTimeProblem(new Date('2026-10-20T09:00:30.000Z'))).toMatch(/half hour/);
    expect(viewingTimeProblem(new Date('2026-10-20T09:00:00.500Z'))).toMatch(/half hour/);
  });

  it('reads the Lagos day and start time of an instant, and where a day begins and ends', () => {
    // 23:30 UTC on the 20th is 00:30 on the 21st in Lagos.
    const late = new Date('2026-10-20T23:30:00.000Z');
    expect(viewingDateKey(late)).toBe('2026-10-21');
    expect(viewingTimeKey(late)).toBe('00:30');
    expect(viewingTimeKey(viewingInstant('2026-10-20', '14:30'))).toBe('14:30');
    const day = viewingDayBounds('2026-10-20');
    expect(day.start.toISOString()).toBe('2026-10-19T23:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-10-20T23:00:00.000Z');
  });
});

describe('viewings: POST', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a time in the past', async () => {
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty();
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: '2026-05-14T10:00:00.000Z' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAST_DATE');
  });

  it('books a future slot', async () => {
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty();
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: bookableViewingTime() },
    });
    expect(res.status).toBe(201);
  });

  it('rejects a time outside viewing hours or on a Sunday', async () => {
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty();
    const cookie = await authCookie(tenant.id, tenant.role);
    const day = new Date();
    day.setDate(day.getDate() + 10);
    while (day.getDay() !== 0) day.setDate(day.getDate() + 1); // next Sunday
    const monday = new Date(day);
    monday.setDate(monday.getDate() + 1);

    const sunday = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: viewingInstant(toLocalDateKey(day), '10:00').toISOString() },
    });
    expect(sunday.status).toBe(400);
    expect(sunday.body.code).toBe('OUTSIDE_VIEWING_HOURS');

    const night = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: viewingInstant(toLocalDateKey(monday), '03:00').toISOString() },
    });
    expect(night.status).toBe(400);
    expect(night.body.code).toBe('OUTSIDE_VIEWING_HOURS');
  });
});

describe('viewings: who is coming', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('shows the property team a short profile of the visitor, without the ID link', async () => {
    const { testPrisma } = await import('../helpers/db');
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    await testPrisma.user.update({
      where: { id: tenant.id },
      data: { phoneNumber: '+2348035551234', idDocumentUrl: 'https://files.test/id.pdf' },
    });
    const property = await createProperty({ managerId: manager.id });
    const tCookie = await authCookie(tenant.id, tenant.role);
    const mCookie = await authCookie(manager.id, manager.role);
    await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie: tCookie,
      body: { scheduledAt: bookableViewingTime() },
    });

    const team = await apiFetch(`/api/v1/properties/${property.id}/viewings`, { cookie: mCookie });
    const visitor = team.body.data[0].requestedBy;
    expect(visitor.phoneNumber).toBe('+2348035551234');
    expect(visitor.hasIdOnFile).toBe(true);
    expect(visitor.kycStatus).toBe('UNVERIFIED');
    expect(visitor.idDocumentUrl).toBeUndefined();

    // The requester sees their own bookings, with no visitor block.
    const own = await apiFetch(`/api/v1/properties/${property.id}/viewings`, { cookie: tCookie });
    expect(own.body.data[0].requestedBy).toBeUndefined();
  });
});

describe('viewings: one booking per property and start time (ISS-104)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const [first, second] = await Promise.all([createUser(Role.TENANT), createUser(Role.TENANT)]);
    const property = await createProperty({ managerId: manager.id });
    return {
      manager,
      property,
      mCookie: await authCookie(manager.id, manager.role),
      aCookie: await authCookie(first.id, first.role),
      bCookie: await authCookie(second.id, second.role),
    };
  }

  const book = (propertyId: string, cookie: string, scheduledAt: string) =>
    apiFetch(`/api/v1/properties/${propertyId}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt },
    });

  const available = (propertyId: string, cookie: string, date: string) =>
    apiFetch(`/api/v1/properties/${propertyId}/viewings/availability?date=${date}`, { cookie });

  it('refuses a second person the same property and time, with a clear message', async () => {
    const { property, aCookie, bCookie } = await setup();
    const when = bookableViewingTime();
    expect((await book(property.id, aCookie, when)).status).toBe(201);

    const second = await book(property.id, bCookie, when);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SLOT_TAKEN');
    expect(second.body.error).toMatch(/already booked.*another time/i);

    const { testPrisma } = await import('../helpers/db');
    expect(await testPrisma.propertyViewing.count({ where: { propertyId: property.id } })).toBe(1);
  });

  it('still allows another time at the same property and the same time at another property', async () => {
    const { property, aCookie, bCookie } = await setup();
    const other = await createProperty();
    const when = bookableViewingTime();
    const later = viewingInstant(viewingDateKey(new Date(when)), '11:00').toISOString();

    expect((await book(property.id, aCookie, when)).status).toBe(201);
    expect((await book(property.id, bCookie, later)).status).toBe(201);
    expect((await book(other.id, bCookie, when)).status).toBe(201);
  });

  it('lets only one of two people who choose the same time at once have it', async () => {
    const { property, aCookie, bCookie } = await setup();
    const when = bookableViewingTime(5);
    const results = await Promise.all([
      book(property.id, aCookie, when),
      book(property.id, bCookie, when),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('SLOT_TAKEN');
  });

  it('cannot be dodged with a time that is a few seconds off the start', async () => {
    const { property, aCookie, bCookie } = await setup();
    const when = bookableViewingTime(6);
    expect((await book(property.id, aCookie, when)).status).toBe(201);
    const sneaky = await book(
      property.id,
      bCookie,
      new Date(Date.parse(when) + 30_000).toISOString(),
    );
    expect(sneaky.status).toBe(400);
    expect(sneaky.body.error).toMatch(/half hour/);
  });

  it('keeps one booking per person per property per day', async () => {
    const { property, aCookie } = await setup();
    const when = bookableViewingTime(7);
    const later = viewingInstant(viewingDateKey(new Date(when)), '15:00').toISOString();
    expect((await book(property.id, aCookie, when)).status).toBe(201);
    const again = await book(property.id, aCookie, later);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('DUPLICATE_BOOKING');
  });

  it('lists the booked times of a day, and nothing about who booked them', async () => {
    const { property, mCookie, aCookie, bCookie } = await setup();
    const when = bookableViewingTime(8);
    const date = viewingDateKey(new Date(when));
    const afternoon = viewingInstant(date, '14:30').toISOString();

    const empty = await available(property.id, bCookie, date);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({ date, taken: [] });

    const first = await book(property.id, aCookie, when);
    await book(property.id, bCookie, afternoon);
    // A confirmed booking holds its time too.
    await apiFetch(`/api/v1/properties/${property.id}/viewings/${first.body.data.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CONFIRMED' },
    });

    const res = await available(property.id, bCookie, date);
    expect(res.body.data).toEqual({ date, taken: ['10:00', '14:30'] });
    expect(JSON.stringify(res.body)).not.toMatch(/requestedBy|email|name/i);

    const nextDay = viewingDateKey(new Date(Date.parse(when) + 24 * 60 * 60 * 1000));
    expect((await available(property.id, bCookie, nextDay)).body.data.taken).toEqual([]);
  });

  it('needs a signed-in person, a real date and a real property', async () => {
    const { property, aCookie } = await setup();
    const date = viewingDateKey(new Date(bookableViewingTime()));
    expect(
      (await apiFetch(`/api/v1/properties/${property.id}/viewings/availability?date=${date}`))
        .status,
    ).toBe(401);
    expect((await available(property.id, aCookie, 'tomorrow')).status).toBe(400);
    expect((await available(property.id, aCookie, '2026-13-45')).status).toBe(400);
    expect((await available('missing-property', aCookie, date)).status).toBe(404);
  });

  it('gives the time back when the team declines it or the person cancels', async () => {
    const { property, mCookie, aCookie, bCookie } = await setup();
    const when = bookableViewingTime(9);
    const date = viewingDateKey(new Date(when));

    const declined = await book(property.id, aCookie, when);
    await apiFetch(`/api/v1/properties/${property.id}/viewings/${declined.body.data.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CANCELLED' },
    });
    expect((await available(property.id, bCookie, date)).body.data.taken).toEqual([]);

    const retaken = await book(property.id, bCookie, when);
    expect(retaken.status).toBe(201);
    await apiFetch(`/api/v1/properties/${property.id}/viewings/${retaken.body.data.id}`, {
      method: 'PATCH',
      cookie: bCookie,
      body: { status: 'CANCELLED' },
    });
    expect((await available(property.id, aCookie, date)).body.data.taken).toEqual([]);
    expect((await book(property.id, aCookie, when)).status).toBe(201);
  });

  it('lets someone whose booking was cancelled book another time the same day', async () => {
    const { property, mCookie, aCookie } = await setup();
    const when = bookableViewingTime(10);
    const later = viewingInstant(viewingDateKey(new Date(when)), '16:00').toISOString();
    const first = await book(property.id, aCookie, when);
    await apiFetch(`/api/v1/properties/${property.id}/viewings/${first.body.data.id}`, {
      method: 'PATCH',
      cookie: mCookie,
      body: { status: 'CANCELLED' },
    });
    expect((await book(property.id, aCookie, later)).status).toBe(201);
  });
});

describe('vendor registration saves the business profile (ISS-043)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('creates a VendorProfile from the sign-up form and links an existing category', async () => {
    const { testPrisma } = await import('../helpers/db');
    await testPrisma.maintenanceCategory.create({ data: { name: 'Plumbing' } });

    const email = `vendor_${Date.now()}@test.local`;
    const res = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email,
        password: 'Password123!',
        name: 'Tunde Bakare',
        role: 'vendor',
        vendor: {
          businessName: 'Bakare Plumbing Ltd',
          serviceCategory: 'Plumbing',
          coverageStates: ['Lagos', 'Ogun'],
          cacNumber: 'RC123456',
        },
      },
    });
    expect(res.status).toBe(200);

    const user = await testPrisma.user.findUnique({
      where: { email },
      include: { vendorProfile: { include: { serviceCategories: true } } },
    });
    expect(user?.vendorProfile?.businessName).toBe('Bakare Plumbing Ltd');
    expect(user?.vendorProfile?.coverageArea).toBe('Lagos, Ogun');
    expect(user?.vendorProfile?.licenseNumber).toBe('RC123456');
    expect(user?.vendorProfile?.serviceCategories.map((c) => c.name)).toEqual(['Plumbing']);
  });

  it('still creates the profile when the category matches nothing, and ignores vendor data for other roles', async () => {
    const { testPrisma } = await import('../helpers/db');
    const vendorEmail = `vendor2_${Date.now()}@test.local`;
    const a = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: vendorEmail,
        password: 'Password123!',
        name: 'Ada Eze',
        role: 'vendor',
        vendor: { businessName: 'Eze Works', serviceCategory: 'Underwater Welding' },
      },
    });
    expect(a.status).toBe(200);
    const v = await testPrisma.user.findUnique({
      where: { email: vendorEmail },
      include: { vendorProfile: { include: { serviceCategories: true } } },
    });
    expect(v?.vendorProfile?.businessName).toBe('Eze Works');
    expect(v?.vendorProfile?.serviceCategories).toHaveLength(0);

    const tenantEmail = `tenant_${Date.now()}@test.local`;
    const b = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: tenantEmail,
        password: 'Password123!',
        name: 'Not A Vendor',
        role: 'tenant',
        vendor: { businessName: 'Sneaky' },
      },
    });
    expect(b.status).toBe(200);
    const t = await testPrisma.user.findUnique({
      where: { email: tenantEmail },
      include: { vendorProfile: true },
    });
    expect(t?.vendorProfile).toBeNull();
  });
});
