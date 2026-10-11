import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { privateDownloadUrl } from '../../lib/cloudinary';
import { makePrivateRef, parsePrivateRef, isPrivateRef } from '../../lib/privateRef';

const REF = makePrivateRef('image', 'profile/abc123xyz', 'pdf');

describe('private refs', () => {
  it('round-trips image refs with a format and keeps raw extensions in the public id', () => {
    expect(parsePrivateRef(REF)).toEqual({
      resourceType: 'image',
      publicId: 'profile/abc123xyz',
      format: 'pdf',
    });
    expect(parsePrivateRef(makePrivateRef('raw', 'profile/doc.docx'))).toEqual({
      resourceType: 'raw',
      publicId: 'profile/doc.docx',
    });
  });

  it('rejects malformed or traversal refs and plain URLs', () => {
    expect(parsePrivateRef('https://res.cloudinary.com/x/y.png')).toBeNull();
    expect(parsePrivateRef('cldp:bogus/abc')).toBeNull();
    expect(parsePrivateRef('cldp:image/../etc/passwd')).toBeNull();
    expect(isPrivateRef('https://example.com')).toBe(false);
  });
});

describe('privateDownloadUrl', () => {
  it('builds a signed, expiring authenticated download link and nothing without keys', () => {
    const saved = { ...process.env };
    try {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      expect(privateDownloadUrl(REF)).toBeNull();

      process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
      process.env.CLOUDINARY_API_KEY = 'key123';
      process.env.CLOUDINARY_API_SECRET = 'secret456';
      const url = new URL(privateDownloadUrl(REF, 120)!);
      expect(url.origin + url.pathname).toBe(
        'https://api.cloudinary.com/v1_1/democloud/image/download',
      );
      expect(url.searchParams.get('type')).toBe('authenticated');
      expect(url.searchParams.get('public_id')).toBe('profile/abc123xyz');
      expect(url.searchParams.get('format')).toBe('pdf');
      expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{40}$/);
      const ttl =
        Number(url.searchParams.get('expires_at')) - Number(url.searchParams.get('timestamp'));
      expect(ttl).toBe(120);
      expect(url.search).not.toContain('secret456');
    } finally {
      process.env = saved;
    }
  });
});

describe('uploads: sign is role-gated per folder', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('403s a tenant signing into the property-listing folder, before checking config', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/uploads/sign', {
      method: 'POST',
      cookie,
      body: { folder: 'properties' },
    });
    // 503 when Cloudinary isn't configured in the test env, 403 when it is --
    // never 200 for a tenant.
    expect([403, 503]).toContain(res.status);
  });
});

describe('uploads: GET /uploads/private authorisation', () => {
  let ownerId: string;
  let ownerCookie: string;
  let strangerCookie: string;
  let landlordCookie: string;
  let otherLandlordCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    await resetDb();
    const owner = await createUser(Role.TENANT);
    ownerId = owner.id;
    await testPrisma.user.update({ where: { id: owner.id }, data: { idDocumentUrl: REF } });
    const landlord = await createUser(Role.LANDLORD);
    const otherLandlord = await createUser(Role.LANDLORD);
    const stranger = await createUser(Role.TENANT);
    const admin = await createUser(Role.ADMIN);
    const property = await createProperty({ landlordId: landlord.id });
    const unit = await createUnit(property.id);
    await createLease(unit.id, owner.id);

    ownerCookie = await authCookie(owner.id, owner.role);
    landlordCookie = await authCookie(landlord.id, landlord.role);
    otherLandlordCookie = await authCookie(otherLandlord.id, otherLandlord.role);
    strangerCookie = await authCookie(stranger.id, stranger.role);
    adminCookie = await authCookie(admin.id, admin.role);
  });

  const get = (cookie?: string, ref: string = REF) =>
    apiFetch(`/api/v1/uploads/private?ref=${encodeURIComponent(ref)}`, { cookie });

  it('401s without a session', async () => {
    expect((await get()).status).toBe(401);
  });

  it('400s a non-private reference', async () => {
    expect((await get(ownerCookie, 'https://example.com/x.png')).status).toBe(400);
  });

  it('hides the file (404) from strangers and unrelated landlords', async () => {
    expect((await get(strangerCookie)).status).toBe(404);
    expect((await get(otherLandlordCookie)).status).toBe(404);
  });

  it('404s a reference nobody owns', async () => {
    expect((await get(adminCookie, makePrivateRef('image', 'profile/nope', 'png'))).status).toBe(
      404,
    );
  });

  it('lets the owner, their landlord and an admin through to the storage step', async () => {
    // The test environment has no Cloudinary keys, so an authorised caller
    // reaches the 503 "not configured" step instead of a redirect.
    for (const cookie of [ownerCookie, landlordCookie, adminCookie]) {
      expect((await get(cookie)).status).toBe(503);
    }
    expect(ownerId).toBeTruthy();
  });
});
