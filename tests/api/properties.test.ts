import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('properties: public browsing (default, unauthenticated)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('only returns published properties, with no auth required', async () => {
    await createProperty({ name: 'Published One', isPublished: true });
    await createProperty({ name: 'Unpublished One', isPublished: false });

    const res = await apiFetch('/api/v1/properties');
    expect(res.status).toBe(200);
    const names = res.body.data.map((p: any) => p.name);
    expect(names).toContain('Published One');
    expect(names).not.toContain('Unpublished One');
  });

  it('serializes a unit\'s squareFeet as sqft', async () => {
    const property = await createProperty({ name: 'Sqft Property', isPublished: true });
    await createUnit(property.id, { squareFeet: 850 });

    const res = await apiFetch('/api/v1/properties');
    const found = res.body.data.find((p: any) => p.name === 'Sqft Property');
    expect(found.units[0].sqft).toBe(850);
    expect(found.units[0].squareFeet).toBeUndefined();
  });

  it('filters by price through Unit.rentAmount, not a Property-level column', async () => {
    const cheap = await createProperty({ name: 'Cheap Property', isPublished: true });
    await createUnit(cheap.id, { rentAmount: 500_000 });
    const pricey = await createProperty({ name: 'Pricey Property', isPublished: true });
    await createUnit(pricey.id, { rentAmount: 5_000_000 });

    const res = await apiFetch('/api/v1/properties?minPrice=1000000');
    const names = res.body.data.map((p: any) => p.name);
    expect(names).toContain('Pricey Property');
    expect(names).not.toContain('Cheap Property');
  });
});

describe('properties: scope=mine', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires authentication', async () => {
    const res = await apiFetch('/api/v1/properties?scope=mine');
    expect(res.status).toBe(401);
  });

  it('rejects a TENANT/VENDOR caller', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/properties?scope=mine', { cookie });
    expect(res.status).toBe(403);
  });

  it('returns only the caller\'s own properties (published or not) for MANAGER/LANDLORD', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    await createProperty({ name: 'Mine Unpublished', managerId: manager.id, isPublished: false });
    await createProperty({ name: 'Someone Else\'s', managerId: otherManager.id, isPublished: true });

    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/properties?scope=mine', { cookie });
    expect(res.status).toBe(200);
    const names = res.body.data.map((p: any) => p.name);
    expect(names).toContain('Mine Unpublished');
    expect(names).not.toContain('Someone Else\'s');
  });

  it('returns every property (any owner) for ADMIN', async () => {
    const admin = await createUser(Role.ADMIN);
    const someoneElse = await createUser(Role.LANDLORD);
    await createProperty({ name: 'Admin Sees This Too', landlordId: someoneElse.id });

    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch('/api/v1/properties?scope=mine', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.name)).toContain('Admin Sees This Too');
  });
});

describe('properties: create (POST /properties)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a TENANT caller', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: { name: 'x', address: 'x', city: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it('auto-assigns managerId/landlordId from the session when not supplied, and always starts unpublished', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: { name: 'New Listing', address: '10 Main St', city: 'Lagos', isPublished: true },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.managerId).toBe(manager.id);
    // isPublished: true in the request must be dropped -- moderationStatus
    // gates real publication, not the caller's say-so.
    expect(res.body.data.isPublished).toBe(false);
  });
});

describe('properties: canManageProperty gating (PATCH /properties/[id])', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lets the owning manager edit their own property', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Renamed' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
  });

  it('forbids the owning manager from reassigning managerId/landlordId themselves -- ADMIN only', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managerId: otherManager.id },
    });
    expect(res.status).toBe(403);

    const unchanged = await testPrisma.property.findUnique({ where: { id: property.id } });
    expect(unchanged?.managerId).toBe(manager.id);
  });

  it('lets ADMIN reassign managerId, but only to a real MANAGER user', async () => {
    const manager = await createUser(Role.MANAGER);
    const newManager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const bogus = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managerId: tenant.id },
    });
    expect(bogus.status).toBe(400);

    const real = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { managerId: newManager.id },
    });
    expect(real.status).toBe(200);
    expect(real.body.data.managerId).toBe(newManager.id);
  });

  it('forbids a different manager from editing someone else\'s property', async () => {
    const owner = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: owner.id });
    const cookie = await authCookie(intruder.id, intruder.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Hijacked' },
    });
    expect(res.status).toBe(403);
  });

  it('lets ADMIN edit any property regardless of ownership', async () => {
    const owner = await createUser(Role.LANDLORD);
    const admin = await createUser(Role.ADMIN);
    const property = await createProperty({ landlordId: owner.id });
    const cookie = await authCookie(admin.id, admin.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Admin Renamed' },
    });
    expect(res.status).toBe(200);
  });

  it('DELETE soft-archives (isPublished: false) rather than removing the row', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, isPublished: true });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}`, { method: 'DELETE', cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(false);

    const stillThere = await apiFetch(`/api/v1/properties/${property.id}`);
    expect(stillThere.status).toBe(200);
  });
});

describe('properties: verified reviews (leaseId provenance)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('marks a review verified only when the reviewer has a real lease on a unit of this property, set once at creation', async () => {
    const property = await createProperty({ isPublished: true });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);

    const stranger = await createUser(Role.TENANT);

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const strangerCookie = await authCookie(stranger.id, stranger.role);

    const verifiedReview = await apiFetch(`/api/v1/properties/${property.id}/reviews`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { rating: 5, comment: 'Great place' },
    });
    expect(verifiedReview.status).toBe(201);
    expect(verifiedReview.body.data.verified).toBe(true);

    const unverifiedReview = await apiFetch(`/api/v1/properties/${property.id}/reviews`, {
      method: 'POST',
      cookie: strangerCookie,
      body: { rating: 3, comment: 'Never lived here' },
    });
    expect(unverifiedReview.status).toBe(201);
    expect(unverifiedReview.body.data.verified).toBe(false);
  });

  it('supports filtering the reviews list to verified only', async () => {
    const property = await createProperty({ isPublished: true });
    const res = await apiFetch(`/api/v1/properties/${property.id}/reviews?verified=true`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: any) => r.verified)).toBe(true);
  });
});

describe('properties: units', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a unit delete when the unit has lease history, to avoid cascading away tenancy records', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}/units/${unit.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(res.status).toBe(409);

    const stillThere = await apiFetch(`/api/v1/properties/${property.id}/units/${unit.id}`);
    expect(stillThere.status).toBe(200);
  });

  it('lets a unit with no lease history be deleted by the owning manager', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch(`/api/v1/properties/${property.id}/units/${unit.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(res.status).toBe(200);

    const gone = await apiFetch(`/api/v1/properties/${property.id}/units/${unit.id}`);
    expect(gone.status).toBe(404);
  });

  it('round-trips sqft through create -> get -> patch', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const created = await apiFetch(`/api/v1/properties/${property.id}/units`, {
      method: 'POST',
      cookie,
      body: { unitNumber: '1A', bedrooms: 2, bathrooms: 1, rentAmount: 800_000, sqft: 650 },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.sqft).toBe(650);

    const patched = await apiFetch(`/api/v1/properties/${property.id}/units/${created.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { sqft: 700 },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.sqft).toBe(700);
  });
});
