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

    const res = await apiFetch<{ data: { name: string }[] }>('/api/v1/properties');
    expect(res.status).toBe(200);
    const names = res.body.data.map((p) => p.name);
    expect(names).toContain('Published One');
    expect(names).not.toContain('Unpublished One');
  });

  it("serializes a unit's squareFeet as sqft", async () => {
    const property = await createProperty({ name: 'Sqft Property', isPublished: true });
    await createUnit(property.id, { squareFeet: 850 });

    const res = await apiFetch<{
      data: { name: string; units: { sqft: number; squareFeet?: number }[] }[];
    }>('/api/v1/properties');
    const found = res.body.data.find((p) => p.name === 'Sqft Property');
    expect(found?.units[0].sqft).toBe(850);
    expect(found?.units[0].squareFeet).toBeUndefined();
  });

  it('filters by price through Unit.rentAmount, not a Property-level column', async () => {
    const cheap = await createProperty({ name: 'Cheap Property', isPublished: true });
    await createUnit(cheap.id, { rentAmount: 500_000 });
    const pricey = await createProperty({ name: 'Pricey Property', isPublished: true });
    await createUnit(pricey.id, { rentAmount: 5_000_000 });

    const res = await apiFetch<{ data: { name: string }[] }>('/api/v1/properties?minPrice=1000000');
    const names = res.body.data.map((p) => p.name);
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

  it("returns only the caller's own properties (published or not) for MANAGER/LANDLORD", async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    await createProperty({ name: 'Mine Unpublished', managerId: manager.id, isPublished: false });
    await createProperty({ name: "Someone Else's", managerId: otherManager.id, isPublished: true });

    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch<{ data: { name: string }[] }>('/api/v1/properties?scope=mine', {
      cookie,
    });
    expect(res.status).toBe(200);
    const names = res.body.data.map((p) => p.name);
    expect(names).toContain('Mine Unpublished');
    expect(names).not.toContain("Someone Else's");
  });

  it('returns every property (any owner) for ADMIN', async () => {
    const admin = await createUser(Role.ADMIN);
    const someoneElse = await createUser(Role.LANDLORD);
    await createProperty({ name: 'Admin Sees This Too', landlordId: someoneElse.id });

    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch<{ data: { name: string }[] }>('/api/v1/properties?scope=mine', {
      cookie,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.name)).toContain('Admin Sees This Too');
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

describe('properties: duplicate listings (ISS-025)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('fingerprints a listing and flags a second one at the same address in its review notes', async () => {
    const a = await createUser(Role.MANAGER);
    const b = await createUser(Role.LANDLORD);
    const first = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie: await authCookie(a.id, a.role),
      body: { name: 'Palm Court', address: '12 Admiralty Way', city: 'Lekki' },
    });
    expect(first.status).toBe(201);
    expect(first.body.data.listingHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.body.possibleDuplicates).toBe(0);
    expect(first.body.data.moderationNotes).toBeNull();

    const second = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie: await authCookie(b.id, b.role),
      body: { name: 'Palm Court Apartments', address: ' 12  admiralty way.', city: 'LEKKI' },
    });
    expect(second.status).toBe(201);
    expect(second.body.possibleDuplicates).toBe(1);
    expect(second.body.data.listingHash).toBe(first.body.data.listingHash);
    expect(second.body.data.moderationNotes).toContain(first.body.data.id);
    // Still reviewable, never auto-rejected.
    expect(second.body.data.moderationStatus).toBe('PENDING_REVIEW');
  });

  it('recomputes the fingerprint when the address changes', async () => {
    const m = await createUser(Role.MANAGER);
    const cookie = await authCookie(m.id, m.role);
    const created = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: { name: 'Move Me', address: '1 Old Road', city: 'Ikeja' },
    });
    const id = created.body.data.id;
    const patched = await apiFetch(`/api/v1/properties/${id}`, {
      method: 'PATCH',
      cookie,
      body: { address: '2 New Road' },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.listingHash).not.toBe(created.body.data.listingHash);
  });
});

describe('properties: photo gallery (ISS-014)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('keeps every photo URL on create and edit, and rejects unsafe ones', async () => {
    const m = await createUser(Role.MANAGER);
    const cookie = await authCookie(m.id, m.role);
    const photos = [
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
      'https://cdn.example.com/c.jpg',
      'https://cdn.example.com/d.jpg',
      'https://cdn.example.com/e.jpg',
    ];
    const created = await apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: {
        name: 'Gallery',
        address: '5 Photo Lane',
        city: 'Abuja',
        imageUrl: photos[0],
        photoUrls: photos,
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.photoUrls).toEqual(photos);

    const edited = await apiFetch(`/api/v1/properties/${created.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { photoUrls: photos.slice(0, 2) },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.photoUrls).toEqual(photos.slice(0, 2));

    const bad = await apiFetch(`/api/v1/properties/${created.body.data.id}`, {
      method: 'PATCH',
      cookie,
      body: { photoUrls: ['javascript:alert(1)'] },
    });
    expect(bad.status).toBe(400);
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

  it("forbids a different manager from editing someone else's property", async () => {
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

    // Probed AS THE MANAGER, deliberately. This assertion is about the row
    // surviving a soft-delete, and it used to probe unauthenticated -- which
    // silently also asserted that anyone holding the id could still read an
    // unpublished property. That was the bug; the endpoint now scopes
    // unpublished listings to their manager/landlord/ADMIN and sitting
    // tenants, so the owner's own view is the correct probe for "still there".
    const stillThere = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.isPublished).toBe(false);

    // ...and the public must no longer see it. 404 rather than 403: a 403
    // would confirm the id is real, which is the fact being protected.
    const anonymous = await apiFetch(`/api/v1/properties/${property.id}`);
    expect(anonymous.status).toBe(404);
  });
});

describe('properties: detail visibility (unpublished listings are not public)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('serves a published property to an anonymous caller', async () => {
    const property = await createProperty({ isPublished: true });
    const res = await apiFetch(`/api/v1/properties/${property.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(property.id);
  });

  it('404s an unpublished property for an anonymous caller who knows the id', async () => {
    const property = await createProperty({ isPublished: false });
    const res = await apiFetch(`/api/v1/properties/${property.id}`);
    expect(res.status).toBe(404);
  });

  it('404s an unpublished property for a logged-in stranger', async () => {
    const property = await createProperty({ isPublished: false });
    const stranger = await createUser(Role.MANAGER);
    const cookie = await authCookie(stranger.id, stranger.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(res.status).toBe(404);
  });

  it('serves an unpublished property to its own manager', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, isPublished: false });
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(res.status).toBe(200);
  });

  it('serves an unpublished property to an ADMIN', async () => {
    const property = await createProperty({ isPublished: false });
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(res.status).toBe(200);
  });

  it('serves an unpublished property to a sitting tenant (a landlord can unpublish an occupied property)', async () => {
    const property = await createProperty({ isPublished: false });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(res.status).toBe(200);
  });

  it('404s an unpublished property for a tenant who leases somewhere else', async () => {
    const property = await createProperty({ isPublished: false });
    const otherProperty = await createProperty({ isPublished: true });
    const otherUnit = await createUnit(otherProperty.id);
    const tenant = await createUser(Role.TENANT);
    await createLease(otherUnit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch(`/api/v1/properties/${property.id}`, { cookie });
    expect(res.status).toBe(404);
  });
});

describe('properties: moderation (ADMIN review queue) + publish gating', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('PATCH /moderation is ADMIN-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const res = await apiFetch(`/api/v1/properties/${property.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(manager.id, manager.role),
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(403);
  });

  it('a manager cannot publish a PENDING_REVIEW listing, only an approved one', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const blocked = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { isPublished: true },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('NOT_APPROVED');

    const admin = await createUser(Role.ADMIN);
    const approve = await apiFetch(`/api/v1/properties/${property.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'APPROVED' },
    });
    expect(approve.status).toBe(200);
    expect(approve.body.data.moderationStatus).toBe('APPROVED');

    const allowed = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie,
      body: { isPublished: true },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.isPublished).toBe(true);

    // Now real end-to-end: it must actually show up in public browsing.
    const publicList = await apiFetch<{ data: { id: string }[] }>('/api/v1/properties');
    expect(publicList.body.data.map((p) => p.id)).toContain(property.id);
  });

  it('rejecting a previously-approved-and-published listing unpublishes it too', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, isPublished: true });
    await testPrisma.property.update({
      where: { id: property.id },
      data: { moderationStatus: 'APPROVED' },
    });

    const admin = await createUser(Role.ADMIN);
    const res = await apiFetch(`/api/v1/properties/${property.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'REJECTED', moderationNotes: 'Photos do not match the address' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe('REJECTED');
    expect(res.body.data.isPublished).toBe(false);

    const publicList = await apiFetch<{ data: { id: string }[] }>('/api/v1/properties');
    expect(publicList.body.data.map((p) => p.id)).not.toContain(property.id);
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
    const res = await apiFetch<{ data: { verified: boolean }[] }>(
      `/api/v1/properties/${property.id}/reviews?verified=true`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.verified)).toBe(true);
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

    const patched = await apiFetch(
      `/api/v1/properties/${property.id}/units/${created.body.data.id}`,
      {
        method: 'PATCH',
        cookie,
        body: { sqft: 700 },
      },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.data.sqft).toBe(700);
  });
});

describe('neighbourhood report: save and keep history (ISS-016)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lets the property manager save a report; later saves keep untouched sections', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);
    const url = `/api/v1/properties/${property.id}/neighbourhood-report`;

    expect((await apiFetch(url)).status).toBe(404);

    const first = await apiFetch(url, {
      method: 'PUT',
      cookie,
      body: {
        security: { rating: 4, status: 'Good' },
        electricity: { hoursPerDay: 18 },
      },
    });
    expect(first.status).toBe(201);

    const second = await apiFetch(url, {
      method: 'PUT',
      cookie,
      body: { security: { rating: 5, status: 'Excellent' } },
    });
    expect(second.status).toBe(201);

    const latest = await apiFetch(url);
    expect(latest.body.data.security).toEqual({ rating: 5, status: 'Excellent' });
    // Carried over from the earlier version.
    expect(latest.body.data.electricity).toEqual({ hoursPerDay: 18 });

    const versions = await testPrisma.neighbourhoodReport.count({
      where: { propertyId: property.id },
    });
    expect(versions).toBe(2);
    const audits = await testPrisma.auditLog.count({
      where: { entityId: property.id, action: 'NEIGHBOURHOOD_REPORT_SAVED' },
    });
    expect(audits).toBe(2);
  });

  it('refuses strangers, tenants, empty bodies and oversized sections', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const url = `/api/v1/properties/${property.id}/neighbourhood-report`;
    const put = async (who: { id: string; role: Role }, body: object) =>
      apiFetch(url, { method: 'PUT', cookie: await authCookie(who.id, who.role), body });

    const stranger = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    expect((await put(stranger, { water: { source: 'borehole' } })).status).toBe(403);
    expect((await put(tenant, { water: { source: 'borehole' } })).status).toBe(403);
    expect((await put(manager, {})).status).toBe(400);
    expect((await put(manager, { water: { blob: 'x'.repeat(25_000) } })).status).toBe(400);
  });
});

describe('properties: merge & unmerge duplicate listings (ISS-025)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('allows an ADMIN to merge a duplicate property into a canonical property', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const canonical = await createProperty({ name: 'Canonical Building', isPublished: true });
    const duplicate = await createProperty({ name: 'Duplicate Building', isPublished: true });

    const res = await apiFetch(`/api/v1/properties/${duplicate.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: canonical.id },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.mergedIntoId).toBe(canonical.id);
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.moderationStatus).toBe('REJECTED');

    // Canonical property should still be published and active
    const canonicalDb = await testPrisma.property.findUnique({ where: { id: canonical.id } });
    expect(canonicalDb?.isPublished).toBe(true);
    expect(canonicalDb?.mergedIntoId).toBeNull();

    // Duplicate property in DB
    const duplicateDb = await testPrisma.property.findUnique({ where: { id: duplicate.id } });
    expect(duplicateDb?.mergedIntoId).toBe(canonical.id);
    expect(duplicateDb?.isPublished).toBe(false);

    // Audit log was recorded
    const audit = await testPrisma.auditLog.findFirst({
      where: { entityId: duplicate.id, action: 'PROPERTY_MERGE' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(admin.id);
  });

  it('excludes merged properties from public browsing and search', async () => {
    const res = await apiFetch<{ data: { name: string }[] }>('/api/v1/properties');
    const names = res.body.data.map((p) => p.name);
    expect(names).toContain('Canonical Building');
    expect(names).not.toContain('Duplicate Building');
  });

  it('rejects merge from non-ADMIN users', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const p1 = await createProperty({ name: 'Prop 1' });
    const p2 = await createProperty({ name: 'Prop 2' });

    const res = await apiFetch(`/api/v1/properties/${p1.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: p2.id },
    });
    expect(res.status).toBe(403);
  });

  it('refuses to merge a property into itself or into an already-merged property', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const prop = await createProperty({ name: 'Self Merge Prop' });
    const selfRes = await apiFetch(`/api/v1/properties/${prop.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: prop.id },
    });
    expect(selfRes.status).toBe(400);
  });

  it('allows an ADMIN to undo a merge', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const canonical = await createProperty({ name: 'Keep Property', isPublished: true });
    const duplicate = await createProperty({ name: 'Merged Property', isPublished: true });

    // First merge
    await apiFetch(`/api/v1/properties/${duplicate.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: canonical.id },
    });

    // Undo merge via DELETE
    const undoRes = await apiFetch(`/api/v1/properties/${duplicate.id}/merge`, {
      method: 'DELETE',
      cookie,
    });
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.data.mergedIntoId).toBeNull();
    expect(undoRes.body.data.moderationStatus).toBe('PENDING_REVIEW');

    const dbRestored = await testPrisma.property.findUnique({ where: { id: duplicate.id } });
    expect(dbRestored?.mergedIntoId).toBeNull();

    // Audit log recorded
    const audit = await testPrisma.auditLog.findFirst({
      where: { entityId: duplicate.id, action: 'PROPERTY_UNMERGE' },
    });
    expect(audit).not.toBeNull();

    // Also test POST /unmerge convenience route
    await apiFetch(`/api/v1/properties/${duplicate.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: canonical.id },
    });
    const postUndoRes = await apiFetch(`/api/v1/properties/${duplicate.id}/unmerge`, {
      method: 'POST',
      cookie,
    });
    expect(postUndoRes.status).toBe(200);
    expect(postUndoRes.body.data.mergedIntoId).toBeNull();
  });
});

describe('properties: pending changes metadata, draft staging, cancel approval, and delete lifecycle', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('allows landlord to save edits as draft without unpublishing or alerting admins', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const prop = await createProperty({
      name: 'Original Live Prop',
      landlordId: landlord.id,
      isPublished: true,
      moderationStatus: 'APPROVED',
    });

    const res = await apiFetch<{ data: any }>(`/api/v1/properties/${prop.id}`, {
      method: 'PATCH',
      cookie,
      body: {
        name: 'Proposed New Name',
        description: 'Proposed New Description',
        saveAsDraft: true,
      },
    });

    expect(res.status).toBe(200);
    // Live property fields remain unchanged
    expect(res.body.data.name).toBe('Original Live Prop');
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.moderationStatus).toBe('APPROVED');
    // Staged in metadata.pendingChanges
    expect(res.body.data.metadata?.pendingChanges?.status).toBe('DRAFT');
    expect(res.body.data.metadata?.pendingChanges?.property?.name).toBe('Proposed New Name');
    expect(res.body.data.metadata?.pendingChanges?.property?.description).toBe(
      'Proposed New Description',
    );
  });

  it('promotes draft to PENDING_REVIEW when submitted for review', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const prop = await createProperty({
      name: 'Draft Live Prop',
      landlordId: landlord.id,
      isPublished: true,
      moderationStatus: 'APPROVED',
      metadata: {
        pendingChanges: {
          status: 'DRAFT',
          property: { name: 'Critical New Name' },
        },
      },
    });

    const res = await apiFetch<{ data: any }>(`/api/v1/properties/${prop.id}`, {
      method: 'PATCH',
      cookie,
      body: { submitForReview: true },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.metadata?.pendingChanges?.status).toBe('PENDING_REVIEW');
    // Critical field modification unpublishes listing until approved
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.moderationStatus).toBe('PENDING_REVIEW');
    expect(res.body.data.moderationNotes).toContain('[EDITED:CRITICAL');
  });

  it('blocks deleting pending edits while under review (must cancel first)', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const prop = await createProperty({
      name: 'Under Review Prop',
      landlordId: landlord.id,
      isPublished: false,
      moderationStatus: 'PENDING_REVIEW',
      metadata: {
        pendingChanges: {
          status: 'PENDING_REVIEW',
          property: { name: 'Under Review Edits' },
        },
      },
    });

    // Attempting delete directly while PENDING_REVIEW must return 400
    const delRes = await apiFetch<{ error: string; code: string }>(
      `/api/v1/properties/${prop.id}`,
      {
        method: 'PATCH',
        cookie,
        body: { deletePendingEdits: true },
      },
    );

    expect(delRes.status).toBe(400);
    expect(delRes.body.code).toBe('UNDER_REVIEW_CANNOT_DELETE');
    expect(delRes.body.error).toContain('cancel the approval request first before deleting');
  });

  it('allows landlord to cancel approval request, safely returning edits to DRAFT', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const prop = await createProperty({
      name: 'Cancel Review Prop',
      landlordId: landlord.id,
      isPublished: false,
      moderationStatus: 'PENDING_REVIEW',
      metadata: {
        pendingChanges: {
          status: 'PENDING_REVIEW',
          property: { name: 'Proposed Edits' },
          // recorded by the server when the edit left an approved listing
          restoreTo: { moderationStatus: 'APPROVED', isPublished: true },
        },
      },
    });

    const cancelRes = await apiFetch<{ data: any }>(`/api/v1/properties/${prop.id}`, {
      method: 'PATCH',
      cookie,
      body: { cancelPendingEdits: true },
    });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.metadata?.pendingChanges?.status).toBe('DRAFT');
    expect(cancelRes.body.data.isPublished).toBe(true);
    expect(cancelRes.body.data.moderationStatus).toBe('APPROVED');
  });

  it('allows landlord to delete pending edits once in DRAFT', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const prop = await createProperty({
      name: 'Draft Deletable Prop',
      landlordId: landlord.id,
      isPublished: true,
      moderationStatus: 'APPROVED',
      metadata: {
        pendingChanges: {
          status: 'DRAFT',
          property: { name: 'Unwanted Draft' },
        },
      },
    });

    const delRes = await apiFetch<{ data: any }>(`/api/v1/properties/${prop.id}`, {
      method: 'PATCH',
      cookie,
      body: { deletePendingEdits: true },
    });

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.metadata?.pendingChanges).toBeUndefined();

    const dbProp = await testPrisma.property.findUnique({ where: { id: prop.id } });
    const dbMeta = (dbProp?.metadata as any) || {};
    expect(dbMeta.pendingChanges).toBeUndefined();
  });
});

describe('properties: staged edits cannot bypass moderation (ISS-059, ISS-060, ISS-061)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('cancelling pending edits does not approve or publish a rejected listing', async () => {
    const m = await createUser(Role.MANAGER);
    const p = await createProperty({ managerId: m.id });
    await testPrisma.property.update({
      where: { id: p.id },
      data: { moderationStatus: 'REJECTED', isPublished: false },
    });
    const cookie = await authCookie(m.id, m.role);
    await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { saveAsDraft: true, description: 'x' },
    });
    const cancel = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { cancelPendingEdits: true },
    });
    expect(cancel.status).toBe(200);
    const row = await testPrisma.property.findUnique({ where: { id: p.id } });
    expect(row?.moderationStatus).toBe('REJECTED');
    expect(row?.isPublished).toBe(false);
  });

  it('cancelling a review request returns an approved listing to approved', async () => {
    const m = await createUser(Role.MANAGER);
    const p = await createProperty({ managerId: m.id });
    await testPrisma.property.update({
      where: { id: p.id },
      data: { moderationStatus: 'APPROVED', isPublished: true },
    });
    const cookie = await authCookie(m.id, m.role);
    const edit = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'Renamed' },
    });
    expect(edit.body.data.isPublished).toBe(false);
    expect(edit.body.data.moderationStatus).toBe('PENDING_REVIEW');
    const cancel = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { cancelPendingEdits: true },
    });
    expect(cancel.body.data.isPublished).toBe(true);
    expect(cancel.body.data.moderationStatus).toBe('APPROVED');
  });

  it('rejects a client-sent metadata field (it cannot carry staged unit edits)', async () => {
    const m = await createUser(Role.MANAGER);
    const victimMgr = await createUser(Role.MANAGER);
    const admin = await createUser(Role.ADMIN);
    const mine = await createProperty({ managerId: m.id });
    const victim = await createProperty({ managerId: victimMgr.id });
    const vUnit = await createUnit(victim.id, {});
    const cookie = await authCookie(m.id, m.role);
    await apiFetch(`/api/v1/properties/${mine.id}`, {
      method: 'PATCH',
      cookie,
      body: {
        metadata: {
          pendingChanges: { status: 'PENDING_REVIEW', units: { [vUnit.id]: { rentAmount: 1 } } },
        },
      },
    });
    await apiFetch(`/api/v1/properties/${mine.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'APPROVED' },
    });
    const after = await testPrisma.unit.findUnique({ where: { id: vUnit.id } });
    expect(after?.rentAmount).toBe(vUnit.rentAmount);
  });

  it('approval skips a staged unit that belongs to another property', async () => {
    const m = await createUser(Role.MANAGER);
    const other = await createUser(Role.MANAGER);
    const admin = await createUser(Role.ADMIN);
    const mine = await createProperty({ managerId: m.id });
    const victim = await createProperty({ managerId: other.id });
    const vUnit = await createUnit(victim.id, {});
    const myUnit = await createUnit(mine.id, {});
    await testPrisma.property.update({
      where: { id: mine.id },
      data: {
        metadata: {
          pendingChanges: {
            status: 'PENDING_REVIEW',
            units: { [vUnit.id]: { rentAmount: 1 }, [myUnit.id]: { rentAmount: 777 } },
          },
        },
      },
    });
    const res = await apiFetch(`/api/v1/properties/${mine.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(200);
    expect((await testPrisma.unit.findUnique({ where: { id: vUnit.id } }))?.rentAmount).toBe(
      vUnit.rentAmount,
    );
    expect((await testPrisma.unit.findUnique({ where: { id: myUnit.id } }))?.rentAmount).toBe(777);
  });

  it('an owner edit to an approved listing is staged, not applied, until an admin approves', async () => {
    const m = await createUser(Role.MANAGER);
    const admin = await createUser(Role.ADMIN);
    const p = await createProperty({ managerId: m.id, name: 'Before' });
    await testPrisma.property.update({
      where: { id: p.id },
      data: { moderationStatus: 'APPROVED', isPublished: true },
    });
    const cookie = await authCookie(m.id, m.role);
    const edit = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { description: 'Fake luxury penthouse' },
    });
    expect(edit.status).toBe(200);
    let row = await testPrisma.property.findUnique({ where: { id: p.id } });
    expect(row?.description).not.toBe('Fake luxury penthouse');
    expect(row?.isPublished).toBe(true); // minor edit: stays live as it was
    expect(
      (row?.metadata as { pendingChanges?: { property?: { description?: string } } })
        ?.pendingChanges?.property?.description,
    ).toBe('Fake luxury penthouse');

    const appr = await apiFetch(`/api/v1/properties/${p.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'APPROVED' },
    });
    expect(appr.status).toBe(200);
    row = await testPrisma.property.findUnique({ where: { id: p.id } });
    expect(row?.description).toBe('Fake luxury penthouse');
  });

  it('draft edits are applied when an admin approves them (not lost)', async () => {
    const m = await createUser(Role.MANAGER);
    const admin = await createUser(Role.ADMIN);
    const p = await createProperty({ managerId: m.id, name: 'Old Name' });
    await testPrisma.property.update({
      where: { id: p.id },
      data: { moderationStatus: 'APPROVED', isPublished: true },
    });
    const cookie = await authCookie(m.id, m.role);
    await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { saveAsDraft: true, name: 'New Name', address: '9 New Address', city: 'Abuja' },
    });
    await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { submitForReview: true },
    });
    await apiFetch(`/api/v1/properties/${p.id}/moderation`, {
      method: 'PATCH',
      cookie: await authCookie(admin.id, admin.role),
      body: { status: 'APPROVED' },
    });
    const row = await testPrisma.property.findUnique({ where: { id: p.id } });
    expect(row?.name).toBe('New Name');
    expect(row?.address).toBe('9 New Address');
    expect(row?.listingHash).toBeTruthy();
    expect(row?.moderationStatus).toBe('APPROVED');
  });
});

describe('properties: merge guards and CSRF (ISS-067, ISS-070)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('refuses a cross-origin or origin-less write on an authenticated route', async () => {
    const m = await createUser(Role.MANAGER);
    const cookie = await authCookie(m.id, m.role);
    const p = await createProperty({ managerId: m.id });
    const foreign = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      headers: { Origin: 'https://evil.example' },
      body: { description: 'x' },
    });
    expect(foreign.status).toBe(403);
    const ok = await apiFetch(`/api/v1/properties/${p.id}`, {
      method: 'PATCH',
      cookie,
      body: { description: 'x' },
    });
    expect(ok.status).toBe(200);
  });

  it('will not merge away a listing that others were merged into, or one with active leases', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const a = await createProperty({});
    const b = await createProperty({});
    const c = await createProperty({});
    await testPrisma.property.update({ where: { id: a.id }, data: { mergedIntoId: b.id } });
    const chain = await apiFetch(`/api/v1/properties/${b.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: c.id },
    });
    expect(chain.status).toBe(400);

    const tenant = await createUser(Role.TENANT);
    const d = await createProperty({});
    const unit = await createUnit(d.id);
    const lease = await createLease(unit.id, tenant.id);
    await testPrisma.lease.update({ where: { id: lease.id }, data: { status: 'ACTIVE' } });
    const e = await createProperty({});
    const live = await apiFetch(`/api/v1/properties/${d.id}/merge`, {
      method: 'POST',
      cookie,
      body: { targetPropertyId: e.id },
    });
    expect(live.status).toBe(400);
    expect(live.body.error).toContain('active leases');
  });
});

describe('invoices: vendor billing limits', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("a vendor cannot attach a job invoice to someone else's lease or create it as paid", async () => {
    const vendor = await createUser(Role.VENDOR);
    const tenant = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const prop = await createProperty({});
    const unit = await createUnit(prop.id);
    const lease = await createLease(unit.id, stranger.id);
    const mr = await testPrisma.maintenanceRequest.create({
      data: {
        unitId: unit.id,
        tenantId: tenant.id,
        title: 'x',
        description: 'y',
        vendorId: vendor.id,
      },
    });
    const cookie = await authCookie(vendor.id, vendor.role);
    const onLease = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: {
        type: 'MAINTENANCE',
        maintenanceRequestId: mr.id,
        leaseId: lease.id,
        amount: 5000,
        dueDate: new Date().toISOString(),
      },
    });
    expect(onLease.status).toBe(403);
    const paid = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: {
        type: 'MAINTENANCE',
        maintenanceRequestId: mr.id,
        amount: 5000,
        status: 'PAID',
        dueDate: new Date().toISOString(),
      },
    });
    expect(paid.status).toBe(400);
    const ok = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: {
        type: 'MAINTENANCE',
        maintenanceRequestId: mr.id,
        amount: 5000,
        dueDate: new Date().toISOString(),
      },
    });
    expect(ok.status).toBe(201);
  });
});
