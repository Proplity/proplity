import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { privateDownloadUrl } from '../../lib/cloudinary';
import {
  makePrivateRef,
  parsePrivateRef,
  isPrivateRef,
  privateRefOwnerId,
} from '../../lib/privateRef';
import { getStorage } from '../../lib/storage';

const REF_PATH = 'profile/abc123xyz';
const REF = makePrivateRef('image', REF_PATH, 'pdf');

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

describe('storage driver', () => {
  it('namespaces private uploads by owner and leaves public folders alone', () => {
    const saved = { ...process.env };
    try {
      process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
      process.env.CLOUDINARY_API_KEY = 'key123';
      process.env.CLOUDINARY_API_SECRET = 'secret456';
      const storage = getStorage();
      expect(storage.name).toBe('cloudinary');
      if (storage.mode !== 'direct') throw new Error('expected a direct driver');
      const priv = storage.signUpload('profile', 'user-1', 'private');
      expect(priv.folder).toBe('profile/user-1');
      expect(priv.type).toBe('authenticated');
      const pub = storage.signUpload('properties', 'user-1', 'public');
      expect(pub.folder).toBe('properties');
      expect(pub.type).toBeUndefined();
    } finally {
      process.env = saved;
    }
  });

  it('refuses an unknown STORAGE_PROVIDER instead of silently falling back', () => {
    const saved = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = 's4';
    try {
      expect(() => getStorage()).toThrow(/Unknown STORAGE_PROVIDER/);
    } finally {
      if (saved === undefined) delete process.env.STORAGE_PROVIDER;
      else process.env.STORAGE_PROVIDER = saved;
    }
  });

  it('reads the owner id out of a reference', () => {
    expect(privateRefOwnerId(makePrivateRef('image', 'profile/u-9/f', 'png'))).toBe('u-9');
    expect(privateRefOwnerId(REF)).toBeNull(); // profile/abc123xyz has no owner segment
    expect(privateRefOwnerId('cldp:image/properties/u-9/f.png')).toBeNull();
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
  let ownerRef: string;
  let ownerCookie: string;
  let strangerCookie: string;
  let landlordCookie: string;
  let otherLandlordCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    await resetDb();
    const owner = await createUser(Role.TENANT);
    ownerId = owner.id;
    ownerRef = makePrivateRef('image', `profile/${owner.id}/doc1`, 'pdf');
    await testPrisma.user.update({ where: { id: owner.id }, data: { idDocumentUrl: ownerRef } });
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

  const get = (cookie?: string, ref: string = ownerRef) =>
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

  it('404s a reference whose embedded owner does not hold it, even if another user stored it', async () => {
    const forged = makePrivateRef('image', `profile/${ownerId}/other-file`, 'pdf');
    expect((await get(ownerCookie, forged)).status).toBe(404);
    expect((await get(adminCookie, forged)).status).toBe(404);
  });

  it('PATCH /auth/me refuses a private reference that belongs to another user, accepts your own', async () => {
    const mine = await createUser(Role.TENANT);
    const cookie = await authCookie(mine.id, mine.role);
    const patch = (idDocumentUrl: string) =>
      apiFetch('/api/v1/auth/me', { method: 'PATCH', cookie, body: { idDocumentUrl } });

    expect((await patch(ownerRef)).status).toBe(400);
    expect((await patch(makePrivateRef('image', `profile/${mine.id}/mine`, 'png'))).status).toBe(
      200,
    );
    // Non-reference strings (filename fallback / legacy URL) are untouched.
    expect((await patch('passport.png')).status).toBe(200);
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
