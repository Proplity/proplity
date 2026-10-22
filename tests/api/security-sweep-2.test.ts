import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createInvoice,
  createMaintenanceRequest,
  bookableViewingTime,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { PRIVATE_UNIT_FLAG } from '../../lib/api/propertyAccess';

// Second pass of the 2026-10-21 security sweep (ISS-136), line by line. Each finding is pinned here.

/** True when `key` appears anywhere in a JSON value. */
function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => hasKey(v, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => k === key || hasKey(v, key));
  }
  return false;
}

describe('private notes on a lease belong to the property team (ISS-144)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('keeps one manager out of the notes on another manager’s lease', async () => {
    const owner = await createUser(Role.MANAGER);
    const stranger = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: owner.id });
    const unit = await createUnit(property.id);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const ownerCookie = await authCookie(owner.id, owner.role);
    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const url = `/api/v1/leases/${lease.id}/notes`;

    const written = await apiFetch(url, {
      method: 'POST',
      cookie: ownerCookie,
      body: { body: 'Pays late; call before the 5th' },
    });
    expect(written.status).toBe(201);

    expect((await apiFetch(url, { cookie: strangerCookie })).status).toBe(403);
    expect(
      (await apiFetch(url, { method: 'POST', cookie: strangerCookie, body: { body: 'x' } })).status,
    ).toBe(403);
    expect(await testPrisma.note.count({ where: { leaseId: lease.id } })).toBe(1);

    const own = await apiFetch<{ data: unknown[] }>(url, { cookie: ownerCookie });
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
  });
});

describe('a tenant sees only the notices the property team has sent (ISS-145)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('hides drafts from the notice list and the lease, and refuses answers to them', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const draft = await testPrisma.notice.create({
      data: {
        leaseId: lease.id,
        type: 'TERMINATION_NOTICE',
        status: 'DRAFT',
        content: 'Not sent yet',
      },
    });
    const sent = await testPrisma.notice.create({
      data: { leaseId: lease.id, type: 'RENT_INCREASE', status: 'SENT', content: 'From March' },
    });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const managerCookie = await authCookie(manager.id, manager.role);

    const list = await apiFetch<{ data: { id: string }[] }>(`/api/v1/leases/${lease.id}/notices`, {
      cookie: tenantCookie,
    });
    expect(list.body.data.map((n) => n.id)).toEqual([sent.id]);

    const detail = await apiFetch<{ data: { notices: { id: string }[] } }>(
      `/api/v1/leases/${lease.id}`,
      { cookie: tenantCookie },
    );
    expect(detail.body.data.notices.map((n) => n.id)).toEqual([sent.id]);

    const answer = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: tenantCookie,
      body: { id: draft.id, status: 'ACCEPTED' },
    });
    expect(answer.status).toBe(404);
    expect((await testPrisma.notice.findUnique({ where: { id: draft.id } }))?.status).toBe('DRAFT');

    // The property team still sees both.
    const team = await apiFetch<{ data: { id: string }[] }>(`/api/v1/leases/${lease.id}/notices`, {
      cookie: managerCookie,
    });
    expect(team.body.data).toHaveLength(2);
  });

  it('will not attach a notice to an invoice of another lease', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const other = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const lease = await createLease((await createUnit(property.id)).id, tenant.id);
    const otherLease = await createLease((await createUnit(property.id)).id, other.id);
    const foreign = await createInvoice({ leaseId: otherLease.id });
    const res = await apiFetch(`/api/v1/leases/${lease.id}/notices`, {
      method: 'POST',
      cookie: await authCookie(manager.id, manager.role),
      body: { type: 'PAYMENT_REMINDER', invoiceId: foreign.id },
    });
    expect(res.status).toBe(400);
  });
});

describe('units and reports of a property follow the listing rule (ISS-146)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('does not list private units, or any units of an unpublished property, to the public', async () => {
    const manager = await createUser(Role.MANAGER);
    const listed = await createProperty({ managerId: manager.id, isPublished: true });
    const publicUnit = await createUnit(listed.id);
    const privateUnit = await createUnit(listed.id, { amenities: [PRIVATE_UNIT_FLAG] });
    const hidden = await createProperty({ managerId: manager.id, isPublished: false });
    const hiddenUnit = await createUnit(hidden.id);
    await testPrisma.neighbourhoodReport.create({ data: { propertyId: hidden.id } });

    const anon = await apiFetch<{ data: { id: string }[] }>(
      `/api/v1/properties/${listed.id}/units`,
    );
    expect(anon.body.data.map((u) => u.id)).toEqual([publicUnit.id]);
    expect((await apiFetch(`/api/v1/properties/${listed.id}/units/${privateUnit.id}`)).status).toBe(
      404,
    );
    expect((await apiFetch(`/api/v1/properties/${hidden.id}/units`)).status).toBe(404);
    expect((await apiFetch(`/api/v1/properties/${hidden.id}/units/${hiddenUnit.id}`)).status).toBe(
      404,
    );
    expect((await apiFetch(`/api/v1/properties/${hidden.id}/neighbourhood-report`)).status).toBe(
      404,
    );

    // The property team still sees everything.
    const cookie = await authCookie(manager.id, manager.role);
    const team = await apiFetch<{ data: { id: string }[] }>(
      `/api/v1/properties/${listed.id}/units`,
      {
        cookie,
      },
    );
    expect(team.body.data).toHaveLength(2);
    expect((await apiFetch(`/api/v1/properties/${hidden.id}/units`, { cookie })).status).toBe(200);
  });
});

describe('who can be named on a new property (ISS-147)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const create = (cookie: string, extra: Record<string, unknown>) =>
    apiFetch('/api/v1/properties', {
      method: 'POST',
      cookie,
      body: { name: 'Sunrise Court', address: '1 Marina', city: 'Lagos', ...extra },
    });

  it('does not let a manager put another account on their new property', async () => {
    const manager = await createUser(Role.MANAGER);
    const victim = await createUser(Role.LANDLORD);
    const cookie = await authCookie(manager.id, manager.role);

    expect((await create(cookie, { landlordId: victim.id })).status).toBe(403);
    expect((await create(cookie, { managerId: victim.id })).status).toBe(403);
    expect(await testPrisma.property.count({ where: { landlordId: victim.id } })).toBe(0);
  });

  it('lets an admin name a manager and a landlord, but only real ones', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(admin.id, admin.role);

    expect((await create(cookie, { managerId: tenant.id })).status).toBe(400);
    expect((await create(cookie, { landlordId: manager.id })).status).toBe(400);
    const ok = await create(cookie, { managerId: manager.id, landlordId: landlord.id });
    expect(ok.status).toBe(201);
  });

  it('still lets a manager or landlord name themselves', async () => {
    const manager = await createUser(Role.MANAGER);
    const res = await create(await authCookie(manager.id, manager.role), {
      managerId: manager.id,
    });
    expect(res.status).toBe(201);
  });
});

describe('the property record is not sent to people who only need the lease, repair or invoice (ISS-148)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('leaves out moderation notes and staged edits', async () => {
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const property = await createProperty({
      managerId: manager.id,
      isPublished: true,
      metadata: { pendingChanges: { status: 'PENDING_REVIEW', property: { name: 'Draft name' } } },
    });
    await testPrisma.property.update({
      where: { id: property.id },
      data: { moderationNotes: 'Possible duplicate of: Other Court (abc)' },
    });
    const unit = await createUnit(property.id);
    const lease = await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const invoice = await createInvoice({ leaseId: lease.id });
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    const application = await testPrisma.application.create({
      data: { unitId: unit.id, applicantId: tenant.id, details: {} },
    });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const vendorCookie = await authCookie(vendor.id, vendor.role);

    const seen = [
      await apiFetch('/api/v1/leases', { cookie: tenantCookie }),
      await apiFetch(`/api/v1/leases/${lease.id}`, { cookie: tenantCookie }),
      await apiFetch(`/api/v1/invoices/${invoice.id}`, { cookie: tenantCookie }),
      await apiFetch('/api/v1/maintenance/requests', { cookie: tenantCookie }),
      await apiFetch(`/api/v1/maintenance/requests/${request.id}`, { cookie: tenantCookie }),
      await apiFetch(`/api/v1/maintenance/requests/${request.id}`, { cookie: vendorCookie }),
      await apiFetch(`/api/v1/applications/${application.id}`, { cookie: tenantCookie }),
      await apiFetch('/api/v1/applications', { cookie: tenantCookie }),
    ];
    for (const res of seen) {
      expect(res.status).toBe(200);
      expect(hasKey(res.body, 'moderationNotes')).toBe(false);
      expect(hasKey(res.body, 'pendingChanges')).toBe(false);
    }
    // The property is still named, so screens that show it keep working.
    expect(JSON.stringify(seen[1].body)).toContain(property.name);
  }, 90_000); // touches eight routes, which a cold dev server compiles one by one
});

describe('a review is one person’s opinion of a property they do not run (ISS-149)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('accepts one review per person and refuses the people who run the property', async () => {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const guest = await createUser(Role.TENANT);
    const property = await createProperty({
      managerId: manager.id,
      landlordId: landlord.id,
      isPublished: true,
    });
    const post = (userId: string, role: Role, rating: number) =>
      authCookie(userId, role).then((cookie) =>
        apiFetch(`/api/v1/properties/${property.id}/reviews`, {
          method: 'POST',
          cookie,
          body: { rating },
        }),
      );

    expect((await post(guest.id, guest.role, 1)).status).toBe(201);
    expect((await post(guest.id, guest.role, 1)).status).toBe(409);
    expect((await post(manager.id, manager.role, 5)).status).toBe(403);
    expect((await post(landlord.id, landlord.role, 5)).status).toBe(403);
    expect(await testPrisma.propertyReview.count({ where: { propertyId: property.id } })).toBe(1);
  });

  it('keeps two reviews at once from the same person to one', async () => {
    const guest = await createUser(Role.TENANT);
    const property = await createProperty({ isPublished: true });
    const cookie = await authCookie(guest.id, guest.role);
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        apiFetch(`/api/v1/properties/${property.id}/reviews`, {
          method: 'POST',
          cookie,
          body: { rating: 5 },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await testPrisma.propertyReview.count({ where: { propertyId: property.id } })).toBe(1);
  });
});

describe('two reviewers cannot both decide one application (ISS-150)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lets exactly one of two simultaneous decisions through', async () => {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const cookies = [
      await authCookie(manager.id, manager.role),
      await authCookie(landlord.id, landlord.role),
    ];
    for (let round = 0; round < 5; round++) {
      const applicant = await createUser(Role.TENANT);
      const application = await testPrisma.application.create({
        data: { unitId: unit.id, applicantId: applicant.id, details: {} },
      });
      const results = await Promise.all(
        (['APPROVED', 'REJECTED'] as const).map((status, i) =>
          apiFetch(`/api/v1/applications/${application.id}`, {
            method: 'PATCH',
            cookie: cookies[i],
            body: { status },
          }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(1);
      const notices = await testPrisma.notification.count({ where: { recipientId: applicant.id } });
      expect(notices).toBe(1);
    }
  });
});

describe('the audit log filters stack (ISS-151)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('keeps the action filter when a search word is also given', async () => {
    const admin = await createUser(Role.ADMIN);
    await testPrisma.auditLog.createMany({
      data: [
        { actorId: admin.id, action: 'USER_SUSPENDED', entityType: 'User', entityId: 'a' },
        { actorId: admin.id, action: 'USER_REACTIVATED', entityType: 'User', entityId: 'b' },
        { actorId: admin.id, action: 'INVOICE_EDITED', entityType: 'Invoice', entityId: 'c' },
      ],
    });
    const res = await apiFetch<{ data: { action: string }[] }>(
      '/api/v1/admin/audit-logs?action=USER_SUSPENDED&q=USER',
      { cookie: await authCookie(admin.id, admin.role) },
    );
    expect(res.body.data.map((l) => l.action)).toEqual(['USER_SUSPENDED']);
  });
});

describe('a unit waits for an admin before the public sees it (ISS-153)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const admin = await createUser(Role.ADMIN);
    const guest = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id, isPublished: true });
    const approvedUnit = await createUnit(property.id, { rentAmount: 500_000 });
    return {
      manager,
      property,
      approvedUnit,
      managerCookie: await authCookie(manager.id, manager.role),
      adminCookie: await authCookie(admin.id, admin.role),
      guestCookie: await authCookie(guest.id, guest.role),
    };
  }

  async function addUnit(s: Awaited<ReturnType<typeof setup>>) {
    const res = await apiFetch<{ data: { id: string; amenities: string[] } }>(
      `/api/v1/properties/${s.property.id}/units`,
      {
        method: 'POST',
        cookie: s.managerCookie,
        body: { unitNumber: 'New 7', bedrooms: 3, bathrooms: 2, rentAmount: 9_000_000 },
      },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.amenities).toContain('approval:pending');
    return res.body.data;
  }

  it('keeps a new unit out of the property page, the unit list, applications and viewings', async () => {
    const s = await setup();
    const unit = await addUnit(s);
    const listUrl = `/api/v1/properties/${s.property.id}/units`;

    const publicUnits = async (cookie?: string) =>
      (await apiFetch<{ data: { id: string }[] }>(listUrl, { cookie })).body.data.map((u) => u.id);
    expect(await publicUnits()).toEqual([s.approvedUnit.id]);
    expect(await publicUnits(s.guestCookie)).toEqual([s.approvedUnit.id]);
    expect(await publicUnits(s.managerCookie)).toHaveLength(2);

    const page = await apiFetch<{ data: { units: { id: string }[] } }>(
      `/api/v1/properties/${s.property.id}`,
    );
    expect(page.body.data.units.map((u) => u.id)).toEqual([s.approvedUnit.id]);
    expect((await apiFetch(`${listUrl}/${unit.id}`)).status).toBe(404);
    expect((await apiFetch(`${listUrl}/${unit.id}`, { cookie: s.managerCookie })).status).toBe(200);

    const apply = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: s.guestCookie,
      body: { unitId: unit.id, details: {} },
    });
    expect(apply.status).toBe(404);
    const book = await apiFetch(`/api/v1/properties/${s.property.id}/viewings`, {
      method: 'POST',
      cookie: s.guestCookie,
      body: { scheduledAt: bookableViewingTime(), unitId: unit.id },
    });
    expect(book.status).toBe(404);
  });

  it('keeps the property out of a price search that only the new unit matches', async () => {
    const s = await setup();
    await addUnit(s);
    const search = async (minPrice: number) =>
      (
        await apiFetch<{ data: { id: string }[] }>(`/api/v1/properties?minPrice=${minPrice}`)
      ).body.data.map((p) => p.id);
    expect(await search(8_000_000)).not.toContain(s.property.id);
    expect(await search(400_000)).toContain(s.property.id);
  });

  it('lets a manager neither clear the marker nor add it back by sending their own amenities', async () => {
    const s = await setup();
    const unit = await addUnit(s);
    const url = `/api/v1/properties/${s.property.id}/units/${unit.id}`;

    const edited = await apiFetch<{ data: { amenities: string[] } }>(url, {
      method: 'PATCH',
      cookie: s.managerCookie,
      body: { amenities: ['Parking'] },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.amenities).toEqual(
      expect.arrayContaining(['Parking', 'approval:pending']),
    );
    expect((await apiFetch(url)).status).toBe(404);

    // An approved unit cannot be pushed back behind the marker either.
    const approvedUrl = `/api/v1/properties/${s.property.id}/units/${s.approvedUnit.id}`;
    const same = await apiFetch<{ data: { amenities: string[] } }>(approvedUrl, {
      method: 'PATCH',
      cookie: s.managerCookie,
      body: { amenities: ['Gym', 'approval:pending'] },
    });
    expect(same.body.data.amenities).toEqual(['Gym']);
  });

  it('shows the unit to the public once an admin approves it', async () => {
    const s = await setup();
    const unit = await addUnit(s);
    const url = `/api/v1/properties/${s.property.id}/units/${unit.id}`;
    const approved = await apiFetch(url, {
      method: 'PATCH',
      cookie: s.adminCookie,
      body: { action: 'APPROVE' },
    });
    expect(approved.status).toBe(200);
    expect((await apiFetch(url)).status).toBe(200);
    const apply = await apiFetch('/api/v1/applications', {
      method: 'POST',
      cookie: s.guestCookie,
      body: { unitId: unit.id, details: {} },
    });
    expect(apply.status).toBe(201);
  });
});
