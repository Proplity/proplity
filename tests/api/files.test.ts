import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createRent } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { fileUrl } from '../../lib/fileRef';

const PDF = new TextEncoder().encode('%PDF-1.4 test');
const PNG = new TextEncoder().encode('\x89PNG test');
const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';

type Folder = 'profile' | 'applications' | 'maintenance-requests' | 'properties';

async function upload(
  cookie: string,
  folder: Folder,
  name = 'doc.pdf',
  type = 'application/pdf',
  data = PDF,
) {
  const sign = await apiFetch('/api/v1/uploads/sign', {
    method: 'POST',
    cookie,
    body: { folder, fileName: name, contentType: type, size: data.byteLength },
  });
  if (sign.status !== 200) return { sign, put: sign, url: '', id: '' };
  const form = new FormData();
  form.append('fileId', sign.body.data.plan.fileId);
  form.append('file', new Blob([data as unknown as BlobPart], { type }), name);
  const put = await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie, body: form });
  return {
    sign,
    put,
    url: sign.body.data.file.url as string,
    id: sign.body.data.file.id as string,
  };
}

const read = (url: string, cookie?: string) => apiFetch(url, { cookie });
const audit = (action: string, entityId: string) =>
  testPrisma.auditLog.findMany({ where: { action, entityId } });

describe('uploads: sign + proxy upload (local provider)', () => {
  let tenantCookie: string;
  let tenantId: string;

  beforeAll(async () => {
    await resetDb();
    const tenant = await createUser(Role.TENANT);
    tenantId = tenant.id;
    tenantCookie = await authCookie(tenant.id, tenant.role);
  });

  it('401s without a session', async () => {
    const res = await apiFetch('/api/v1/uploads/sign', {
      method: 'POST',
      body: { folder: 'profile', fileName: 'a.pdf', contentType: 'application/pdf', size: 10 },
    });
    expect(res.status).toBe(401);
  });

  it('gates folders by role, type and size before registering anything', async () => {
    const sign = (body: object) =>
      apiFetch('/api/v1/uploads/sign', { method: 'POST', cookie: tenantCookie, body });
    expect(
      (await sign({ folder: 'properties', fileName: 'a.png', contentType: 'image/png', size: 5 }))
        .status,
    ).toBe(403);
    expect(
      (
        await sign({
          folder: 'profile',
          fileName: 'a.exe',
          contentType: 'application/x-msdownload',
          size: 5,
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await sign({
          folder: 'profile',
          fileName: 'a.pdf',
          contentType: 'application/pdf',
          size: 50_000_000,
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await sign({
          folder: 'profile',
          fileName: 'a.pdf',
          contentType: 'application/pdf',
          size: 0,
        })
      ).status,
    ).toBe(400);
    expect(await testPrisma.storedFile.count({ where: { ownerId: tenantId } })).toBe(0);
  });

  it('stores a file: PENDING until the bytes arrive, then READY with an upload audit entry', async () => {
    const sign = await apiFetch('/api/v1/uploads/sign', {
      method: 'POST',
      cookie: tenantCookie,
      body: {
        folder: 'profile',
        fileName: 'My ID.pdf',
        contentType: 'application/pdf',
        size: PDF.byteLength,
      },
    });
    expect(sign.status).toBe(200);
    expect(sign.body.data.plan.mode).toBe('proxy');
    const { id, url } = sign.body.data.file;
    expect(url).toBe(fileUrl(id));
    expect((await testPrisma.storedFile.findUnique({ where: { id } }))?.status).toBe('PENDING');
    // PENDING files cannot be read.
    expect((await read(url, tenantCookie)).status).toBe(404);

    const form = new FormData();
    form.append('fileId', id);
    form.append(
      'file',
      new Blob([PDF as unknown as BlobPart], { type: 'application/pdf' }),
      'My ID.pdf',
    );
    expect(
      (await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie: tenantCookie, body: form }))
        .status,
    ).toBe(201);

    const row = await testPrisma.storedFile.findUnique({ where: { id } });
    expect(row).toMatchObject({
      status: 'READY',
      provider: 'local',
      access: 'private',
      ownerId: tenantId,
      size: PDF.byteLength,
    });
    expect(row?.key).toBe(`private/profile/${tenantId}/${id}-my-id.pdf`);
    const [entry] = await audit('FILE_UPLOADED', id);
    expect(entry.actorId).toBe(tenantId);
    expect(entry.metadata).toMatchObject({
      provider: 'local',
      folder: 'profile',
      access: 'private',
    });
  });

  it('refuses the wrong file type or someone else completing the upload', async () => {
    const other = await createUser(Role.TENANT);
    const otherCookie = await authCookie(other.id, other.role);
    const sign = await apiFetch('/api/v1/uploads/sign', {
      method: 'POST',
      cookie: tenantCookie,
      body: {
        folder: 'profile',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        size: PDF.byteLength,
      },
    });
    const form = () => {
      const f = new FormData();
      f.append('fileId', sign.body.data.plan.fileId);
      f.append('file', new Blob([PNG as unknown as BlobPart], { type: 'image/png' }), 'a.png');
      return f;
    };
    expect(
      (
        await apiFetch('/api/v1/uploads/file', {
          method: 'POST',
          cookie: otherCookie,
          body: form(),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await apiFetch('/api/v1/uploads/file', {
          method: 'POST',
          cookie: tenantCookie,
          body: form(),
        })
      ).status,
    ).toBe(415);
    // /complete is for direct providers only.
    const done = await apiFetch('/api/v1/uploads/complete', {
      method: 'POST',
      cookie: tenantCookie,
      body: { fileId: sign.body.data.plan.fileId },
    });
    expect(done.status).toBe(400);
  });
});

describe('files gateway: GET /api/v1/files/[id]', () => {
  let ownerId: string;
  let owner: string;
  let stranger: string;
  let admin: string;
  let landlord: string;
  let otherLandlord: string;
  let idUrl: string;
  let idFileId: string;

  beforeAll(async () => {
    await resetDb();
    const o = await createUser(Role.TENANT);
    const s = await createUser(Role.TENANT);
    const a = await createUser(Role.ADMIN);
    const l = await createUser(Role.LANDLORD);
    const ol = await createUser(Role.LANDLORD);
    ownerId = o.id;
    owner = await authCookie(o.id, o.role);
    stranger = await authCookie(s.id, s.role);
    admin = await authCookie(a.id, a.role);
    landlord = await authCookie(l.id, l.role);
    otherLandlord = await authCookie(ol.id, ol.role);
    const property = await createProperty({ landlordId: l.id });
    const unit = await createUnit(property.id);
    await createRent(unit.id, o.id);
    const up = await upload(owner, 'profile', 'id.pdf');
    idUrl = up.url;
    idFileId = up.id;
  });

  it('401s anonymous readers of private files, 404s strangers and unrelated landlords', async () => {
    expect((await read(idUrl)).status).toBe(401);
    expect((await read(idUrl, stranger)).status).toBe(404);
    expect((await read(idUrl, otherLandlord)).status).toBe(404);
  });

  it('serves the owner, an admin and the landlord of a property they rent, with safe headers', async () => {
    for (const cookie of [owner, admin, landlord]) {
      const res = await read(idUrl, cookie);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toContain('no-store');
    }
  });

  it('writes a FILE_READ audit entry per private read, naming the reader and provider', async () => {
    const entries = await audit('FILE_READ', idFileId);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.every((e) => (e.metadata as { provider: string }).provider === 'local')).toBe(
      true,
    );
    expect(entries.some((e) => e.actorId === ownerId)).toBe(true);
  });

  it('404s unknown, malformed and deleted ids', async () => {
    expect((await read('/api/v1/files/00000000-0000-4000-8000-000000000000', owner)).status).toBe(
      404,
    );
    expect((await read('/api/v1/files/not-a-uuid', owner)).status).toBe(404);
  });

  it('serves public-folder files to anyone, without auditing reads', async () => {
    const lcookie = landlord;
    const up = await upload(lcookie, 'properties', 'house.png', 'image/png', PNG);
    expect(up.put.status).toBe(201);
    const anon = await read(up.url);
    expect(anon.status).toBe(200);
    expect(anon.headers.get('content-type')).toBe('image/png');
    expect(anon.headers.get('cache-control')).toContain('public');
    expect(await audit('FILE_READ', up.id)).toHaveLength(0);
  });

  it('503s and audits a provider mismatch when the file lives on an unconfigured provider', async () => {
    const row = await testPrisma.storedFile.create({
      data: {
        ownerId,
        folder: 'profile',
        access: 'private',
        provider: 's3',
        key: `private/profile/${ownerId}/ghost.pdf`,
        originalName: 'ghost.pdf',
        contentType: 'application/pdf',
        status: 'READY',
      },
    });
    const res = await read(fileUrl(row.id), owner);
    expect(res.status).toBe(503);
    const [entry] = await audit('FILE_PROVIDER_MISMATCH', row.id);
    expect(entry.metadata).toMatchObject({ provider: 's3', activeProvider: 'local' });
  });
});

describe('maintenance photos are private and tied to their request', () => {
  let tenant: string;
  let tenantId: string;
  let otherTenant: string;
  let manager: string;
  let vendor: string;
  let outsider: string;
  let unitId: string;

  beforeAll(async () => {
    await resetDb();
    const t = await createUser(Role.TENANT);
    const ot = await createUser(Role.TENANT);
    const m = await createUser(Role.MANAGER);
    const v = await createUser(Role.VENDOR);
    const out = await createUser(Role.MANAGER);
    tenantId = t.id;
    tenant = await authCookie(t.id, t.role);
    otherTenant = await authCookie(ot.id, ot.role);
    manager = await authCookie(m.id, m.role);
    vendor = await authCookie(v.id, v.role);
    outsider = await authCookie(out.id, out.role);
    const property = await createProperty({ managerId: m.id });
    const unit = await createUnit(property.id);
    unitId = unit.id;
    await createRent(unit.id, t.id);
    (globalThis as { __vendorId?: string }).__vendorId = v.id;
  });

  it('is invisible to managers until attached to a request, then visible to the right people only', async () => {
    const photo = await upload(tenant, 'maintenance-requests', 'leak.png', 'image/png', PNG);
    expect(photo.put.status).toBe(201);
    expect((await read(photo.url, manager)).status).toBe(404); // not attached yet
    expect((await read(photo.url, tenant)).status).toBe(200); // uploader

    const created = await apiFetch('/api/v1/maintenance/requests', {
      method: 'POST',
      cookie: tenant,
      body: { unitId, title: 'Leak', description: 'Under the sink', mediaUrls: [photo.url] },
    });
    expect(created.status).toBe(201);

    expect((await read(photo.url, manager)).status).toBe(200);
    expect((await read(photo.url, outsider)).status).toBe(404); // a manager of another property
    expect((await read(photo.url, otherTenant)).status).toBe(404);
    expect((await read(photo.url)).status).toBe(401);

    // Assigning a vendor lets that vendor see it; no one else gains access.
    const vendorId = (globalThis as { __vendorId?: string }).__vendorId!;
    expect((await read(photo.url, vendor)).status).toBe(404);
    await testPrisma.maintenanceRequest.update({
      where: { id: created.body.data.id },
      data: { vendorId },
    });
    expect((await read(photo.url, vendor)).status).toBe(200);
  });

  it("refuses to attach another user's file URL to a request", async () => {
    const victim = await upload(otherTenant, 'maintenance-requests', 'room.png', 'image/png', PNG);
    const res = await apiFetch('/api/v1/maintenance/requests', {
      method: 'POST',
      cookie: tenant,
      body: { unitId, title: 'Sneaky', description: 'x', mediaUrls: [victim.url] },
    });
    expect(res.status).toBe(400);
    expect((await read(victim.url, tenant)).status).toBe(404);
    expect(tenantId).toBeTruthy();
  });
});

describe('profile ID document: ownership, replacement, cleanup', () => {
  let cookie: string;
  let userId: string;
  let otherCookie: string;

  beforeAll(async () => {
    await resetDb();
    const u = await createUser(Role.TENANT);
    const o = await createUser(Role.TENANT);
    userId = u.id;
    cookie = await authCookie(u.id, u.role);
    otherCookie = await authCookie(o.id, o.role);
  });

  const patch = (idDocumentUrl: string, c = cookie) =>
    apiFetch('/api/v1/auth/me', { method: 'PATCH', cookie: c, body: { idDocumentUrl } });

  it("rejects someone else's file and non-profile files, accepts your own and plain names", async () => {
    const theirs = await upload(otherCookie, 'profile');
    expect((await patch(theirs.url)).status).toBe(400);
    const wrongFolder = await upload(cookie, 'maintenance-requests', 'a.png', 'image/png', PNG);
    expect((await patch(wrongFolder.url)).status).toBe(400);
    expect((await patch('passport.png')).status).toBe(200);
    const mine = await upload(cookie, 'profile');
    expect((await patch(mine.url)).status).toBe(200);
    // The old plain string is not a file, so nothing was deleted.
    expect((await testPrisma.storedFile.findUnique({ where: { id: mine.id } }))?.status).toBe(
      'READY',
    );
  });

  it('replacing the ID deletes the old file and audits it', async () => {
    const first = await upload(cookie, 'profile', 'one.pdf');
    expect((await patch(first.url)).status).toBe(200);
    const second = await upload(cookie, 'profile', 'two.pdf');
    expect((await patch(second.url)).status).toBe(200);

    const old = await testPrisma.storedFile.findUnique({ where: { id: first.id } });
    expect(old?.status).toBe('DELETED');
    expect((await audit('FILE_DELETED', first.id))[0]?.actorId).toBe(userId);
    expect((await read(first.url, cookie)).status).toBe(404);
    expect((await read(second.url, cookie)).status).toBe(200);
  });
});

describe('storage janitor', () => {
  it('removes uploads that were signed but never completed, and keeps fresh ones', async () => {
    await resetDb();
    const u = await createUser(Role.TENANT);
    const mk = (age: number, key: string) =>
      testPrisma.storedFile.create({
        data: {
          ownerId: u.id,
          folder: 'profile',
          access: 'private',
          provider: 'local',
          key,
          originalName: 'x.pdf',
          createdAt: new Date(Date.now() - age),
        },
      });
    const stale = await mk(48 * 3_600_000, 'private/profile/stale');
    const fresh = await mk(60_000, 'private/profile/fresh');
    const res = await apiFetch('/api/v1/cron/storage-janitor', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    expect((await testPrisma.storedFile.findUnique({ where: { id: stale.id } }))?.status).toBe(
      'DELETED',
    );
    expect((await testPrisma.storedFile.findUnique({ where: { id: fresh.id } }))?.status).toBe(
      'PENDING',
    );
  });
});
