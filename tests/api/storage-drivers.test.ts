import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageDriver } from '../../lib/storage/providers/local';
import { S3CompatibleStorageDriver } from '../../lib/storage/providers/s3';
import { cloudinaryDriver } from '../../lib/storage/providers/cloudinary';
import { getStorage, getStorageByName } from '../../lib/storage';
import { fileUrl, parseFileUrl, FOLDER_ACCESS } from '../../lib/fileRef';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = async (stream: ReadableStream<Uint8Array>) => new Response(stream).text();
const ID = '0b0e3d6e-5a52-4a52-9a64-0d5d2f4d9d11';

describe('file URLs', () => {
  it('round-trips a gateway URL and rejects everything else', () => {
    expect(parseFileUrl(fileUrl(ID))).toBe(ID);
    expect(parseFileUrl(fileUrl(ID.toUpperCase()))).toBe(ID);
    for (const bad of [
      '',
      'passport.png',
      `/api/v1/files/${ID}/extra`,
      `/api/v1/files/${ID}?x=1`,
      `https://evil.example/api/v1/files/${ID}`,
      '/api/v1/files/not-a-uuid',
    ]) {
      expect(parseFileUrl(bad)).toBeNull();
    }
    expect(parseFileUrl(null)).toBeNull();
  });

  it('makes every upload folder choose private or public, with maintenance photos private', () => {
    expect(FOLDER_ACCESS['maintenance-requests']).toBe('private');
    expect(FOLDER_ACCESS.profile).toBe('private');
    expect(FOLDER_ACCESS.applications).toBe('private');
    expect(FOLDER_ACCESS.properties).toBe('public');
  });
});

describe('LocalStorageDriver', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proplity-storage-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const loc = (key: string) => ({ key, access: 'private' as const });

  it('builds owner-namespaced keys under the access directory', () => {
    const key = new LocalStorageDriver(dir).makeKey({
      folder: 'profile',
      ownerId: 'u1',
      fileId: 'f1',
      fileName: 'My ID.PDF',
      access: 'private',
    });
    expect(key).toBe('private/profile/u1/f1-my-id.pdf');
  });

  it('puts, reads and removes', async () => {
    const driver = new LocalStorageDriver(dir);
    const l = loc('private/profile/u1/a.txt');
    await driver.put(l, bytes('secret'), 'text/plain');
    const got = await driver.read(l);
    expect(got?.contentType).toBe('text/plain');
    expect(got?.size).toBe(6);
    expect(await text(got!.stream)).toBe('secret');
    await driver.remove(l);
    expect(await driver.read(l)).toBeNull();
  });

  it('refuses path traversal', async () => {
    const driver = new LocalStorageDriver(dir);
    await expect(driver.put(loc('../../escape.txt'), bytes('x'), 'text/plain')).rejects.toThrow(
      /traversal/,
    );
  });
});

describe('S3CompatibleStorageDriver (fake client and presigner)', () => {
  const presign = vi.fn(async (_c: unknown, cmd: unknown, o: { expiresIn: number }) => {
    const input = (cmd as { input: Record<string, unknown> }).input;
    return `https://signed.example/${input.Key}?ttl=${o.expiresIn}`;
  });
  const make = (
    send: (c: unknown) => Promise<unknown> = vi.fn().mockResolvedValue({}),
    extra = {},
  ) =>
    new S3CompatibleStorageDriver(
      { name: 's3', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', ...extra },
      { send },
      presign,
    );
  const l = { key: 'private/profile/u/f-id.pdf', access: 'private' as const };

  it('uploads directly with a presigned PUT that pins the content type', async () => {
    const driver = make();
    expect(driver.upload).toBe('direct');
    const plan = await driver.prepareDirectUpload({
      key: l.key,
      contentType: 'application/pdf',
    });
    expect(plan).toEqual({
      kind: 'put',
      url: `https://signed.example/${l.key}?ttl=300`,
      headers: { 'Content-Type': 'application/pdf' },
    });
  });

  it('verifies an upload with HeadObject and reports a missing object as null', async () => {
    const ok = make(
      vi.fn().mockResolvedValue({ ContentLength: 42, ContentType: 'application/pdf' }),
    );
    expect(await ok.verifyUpload(l)).toEqual({ size: 42, contentType: 'application/pdf' });
    const missing = make(
      vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotFound' })),
    );
    expect(await missing.verifyUpload(l)).toBeNull();
    const broken = make(vi.fn().mockRejectedValue(new Error('boom')));
    await expect(broken.verifyUpload(l)).rejects.toThrow('boom');
  });

  it('reads through a presigned GET, or a public base URL for public objects', async () => {
    const driver = make();
    const url = await driver.signedUrl(l, {
      ttlSeconds: 120,
      fileName: 'id.pdf',
      contentType: 'application/pdf',
    });
    expect(url).toBe(`https://signed.example/${l.key}?ttl=120`);

    const cdn = make(undefined, { publicUrlBase: 'https://cdn.example.com/' });
    const pub = await cdn.signedUrl(
      { key: 'public/properties/u/f.png', access: 'public' },
      { ttlSeconds: 60, fileName: 'f.png', contentType: 'image/png' },
    );
    expect(pub).toBe('https://cdn.example.com/public/properties/u/f.png');
    // Private objects never use the public base.
    const priv = await cdn.signedUrl(l, {
      ttlSeconds: 60,
      fileName: 'id.pdf',
      contentType: 'application/pdf',
    });
    expect(priv).toContain('signed.example');
  });

  it('removes with DeleteObject and reports configuration', async () => {
    const send = vi.fn().mockResolvedValue({});
    await make(send).remove(l);
    expect((send.mock.calls[0][0] as { input: { Key: string } }).input.Key).toBe(l.key);
    expect(make().isConfigured()).toBe(true);
    expect(
      new S3CompatibleStorageDriver({
        name: 's3',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
      }).isConfigured(),
    ).toBe(false);
  });
});

describe('cloudinaryDriver', () => {
  const saved = { ...process.env };
  beforeAll(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
  });
  afterAll(() => {
    process.env = saved;
  });

  it('fixes the public_id, type and allowed formats inside the signature', () => {
    const key = cloudinaryDriver.makeKey({
      folder: 'profile',
      ownerId: 'u1',
      fileId: 'f1',
      fileName: 'x.pdf',
      access: 'private',
    });
    expect(key).toBe('profile/u1/f1');
    const plan = cloudinaryDriver.prepareDirectUpload!({
      key,
      access: 'private',
      folder: 'profile',
      contentType: 'application/pdf',
    }) as { kind: string; url: string; fields: Record<string, string> };
    expect(plan.kind).toBe('form-post');
    expect(plan.url).toBe('https://api.cloudinary.com/v1_1/demo/auto/upload');
    expect(plan.fields).toMatchObject({ public_id: key, type: 'authenticated', api_key: 'key' });
    expect(plan.fields.allowed_formats).not.toContain('mp4');
    expect(plan.fields.signature).toMatch(/^[0-9a-f]{40}$/);
    expect(JSON.stringify(plan)).not.toContain('secret');

    const video = cloudinaryDriver.prepareDirectUpload!({
      key: 'properties/u1/f2',
      access: 'public',
      folder: 'properties',
      contentType: 'video/mp4',
    }) as { fields: Record<string, string> };
    expect(video.fields.allowed_formats).toContain('mp4');
    expect(video.fields.type).toBe('upload');
  });

  it('accepts only resource types and formats the signature allowed', async () => {
    const loc = { key: 'profile/u1/f1', access: 'private' as const };
    expect(
      await cloudinaryDriver.verifyUpload!(loc, {
        resource_type: 'image',
        format: 'PDF',
        bytes: 9,
      }),
    ).toEqual({
      size: 9,
      meta: { resourceType: 'image', format: 'pdf' },
    });
    expect(
      await cloudinaryDriver.verifyUpload!(loc, { resource_type: 'raw', format: 'exe' }),
    ).toBeNull();
    expect(
      await cloudinaryDriver.verifyUpload!(loc, { resource_type: 'zip', format: 'png' }),
    ).toBeNull();
  });

  it('builds a signed expiring download URL for private assets and a plain URL for public ones', async () => {
    const priv = await cloudinaryDriver.signedUrl!(
      { key: 'profile/u1/f1', access: 'private', meta: { resourceType: 'image', format: 'pdf' } },
      { ttlSeconds: 120, fileName: 'id.pdf', contentType: 'application/pdf' },
    );
    const url = new URL(priv!);
    expect(url.origin + url.pathname).toBe('https://api.cloudinary.com/v1_1/demo/image/download');
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{40}$/);
    expect(
      Number(url.searchParams.get('expires_at')) - Number(url.searchParams.get('timestamp')),
    ).toBe(120);
    expect(url.search).not.toContain('secret');

    const pub = await cloudinaryDriver.signedUrl!(
      { key: 'properties/u1/f2', access: 'public', meta: { resourceType: 'image', format: 'png' } },
      { ttlSeconds: 60, fileName: 'f.png', contentType: 'image/png' },
    );
    expect(pub).toBe('https://res.cloudinary.com/demo/image/upload/properties/u1/f2.png');
  });

  it('posts a signed destroy request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await cloudinaryDriver.remove({
        key: 'profile/u1/f1',
        access: 'private',
        meta: { resourceType: 'image' },
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy');
      const body = new URLSearchParams(String(init.body));
      expect(body.get('public_id')).toBe('profile/u1/f1');
      expect(body.get('type')).toBe('authenticated');
      expect(String(init.body)).not.toContain('secret');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('provider selection', () => {
  it('selects by name, caches, and rejects unknown or production-local', () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local');
    expect(getStorage().name).toBe('local');
    for (const [name, expected] of [
      ['s3', 's3'],
      ['r2', 'r2'],
      ['minio', 'minio'],
      ['supabase', 'supabase'],
      ['imagekit', 'imagekit'],
      ['vercel-blob', 'vercel-blob'],
      ['cloudinary', 'cloudinary'],
    ] as const) {
      expect(getStorageByName(name).name).toBe(expected);
    }
    vi.stubEnv('STORAGE_PROVIDER', '');
    expect(getStorage().name).toBe('cloudinary'); // default
    expect(() => getStorageByName('s4')).toThrow(/Unknown STORAGE_PROVIDER/);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getStorageByName('local')).toThrow(/development only/);
    vi.unstubAllEnvs();
  });
});
