import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb } from '../helpers/db';
import { createUser, createProperty } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { upcomingViewingDays, fromLocalDateKey } from '../../lib/viewingSlots';

describe('viewing slots (ISS-042)', () => {
  it('offers only future days, Monday to Saturday, starting tomorrow', () => {
    const from = new Date(2026, 9, 13); // Tue 13 Oct 2026
    const days = upcomingViewingDays(from, 8);
    expect(days).toHaveLength(8);
    expect(days[0].date).toBe('2026-10-14');
    expect(days.every((d) => d.day !== 'Sunday')).toBe(true);
    expect(days.every((d) => fromLocalDateKey(d.date) > from)).toBe(true);
    expect(days.every((d) => d.slots.length > 0)).toBe(true);
  });

  it('skips Sundays', () => {
    const days = upcomingViewingDays(new Date(2026, 9, 17), 3); // Sat -> Mon, Tue, Wed
    expect(days.map((d) => d.day)).toEqual(['Monday', 'Tuesday', 'Wednesday']);
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
    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await apiFetch(`/api/v1/properties/${property.id}/viewings`, {
      method: 'POST',
      cookie,
      body: { scheduledAt: when },
    });
    expect(res.status).toBe(201);
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
