import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageDriver } from '../../lib/storage/providers/local';
import { S3CompatibleStorageDriver } from '../../lib/storage/providers/s3';
import { cloudinaryDriver } from '../../lib/storage/providers/cloudinary';
import {
  isSafeKey,
  makeStoredRef,
  parseStoredRef,
  privateRefOwnerId,
  isPrivateRef,
} from '../../lib/privateRef';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = async (stream: ReadableStream<Uint8Array>) => new Response(stream).text();

describe('stored refs and keys', () => {
  it('round-trips a stored ref and reads its owner', () => {
    const ref = makeStoredRef('profile/user-7/170-abc-id.pdf');
    expect(parseStoredRef(ref)).toEqual({ key: 'profile/user-7/170-abc-id.pdf' });
    expect(privateRefOwnerId(ref)).toBe('user-7');
    expect(isPrivateRef(ref)).toBe(true);
  });

  it('rejects unsafe keys', () => {
    for (const bad of ['', '/abs', 'a/../b', 'a//b', 'a\\b', '../x', 'a/./b']) {
      expect(isSafeKey(bad)).toBe(false);
    }
    expect(parseStoredRef('stor:private:profile/../../etc/passwd')).toBeNull();
    expect(privateRefOwnerId('stor:private:properties/u/x.png')).toBeNull();
  });
});

describe('LocalStorageDriver', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proplity-storage-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('puts, gets and deletes', async () => {
    const driver = new LocalStorageDriver(dir);
    await driver.put('private/profile/u1/a.txt', bytes('secret'), {
      access: 'private',
      contentType: 'text/plain',
    });
    const got = await driver.get('private/profile/u1/a.txt', { access: 'private' });
    expect(got?.contentType).toBe('text/plain');
    expect(got?.size).toBe(6);
    expect(await text(got!.stream)).toBe('secret');

    // The same logical key in the public namespace is a different file.
    expect(await driver.get('public/profile/u1/a.txt', { access: 'public' })).toBeNull();

    await driver.delete('private/profile/u1/a.txt', { access: 'private' });
    expect(await driver.get('private/profile/u1/a.txt', { access: 'private' })).toBeNull();
  });

  it('refuses path traversal', async () => {
    const driver = new LocalStorageDriver(dir);
    await expect(
      driver.put('../../escape.txt', bytes('x'), { access: 'private', contentType: 'text/plain' }),
    ).rejects.toThrow(/traversal/);
  });
});

describe('S3CompatibleStorageDriver (fake client)', () => {
  const make = (send: (c: unknown) => Promise<unknown>, extra = {}) =>
    new S3CompatibleStorageDriver(
      {
        name: 's3',
        bucket: 'b',
        accessKeyId: 'k',
        secretAccessKey: 's',
        publicUrlBase: 'https://cdn.example.com/',
        ...extra,
      },
      { send },
    );

  it('reports configuration and sends a PutObject with key, type and body', async () => {
    const send = vi.fn().mockResolvedValue({});
    const driver = make(send);
    expect(driver.isConfigured()).toBe(true);
    const res = await driver.put('public/properties/u/a.png', bytes('png'), {
      access: 'public',
      contentType: 'image/png',
    });
    const input = (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input).toMatchObject({
      Bucket: 'b',
      Key: 'public/properties/u/a.png',
      ContentType: 'image/png',
    });
    expect(res.url).toBe('https://cdn.example.com/public/properties/u/a.png');
  });

  it('gives no direct URL for private objects', async () => {
    const driver = make(vi.fn().mockResolvedValue({}));
    const res = await driver.put('private/profile/u/a.pdf', bytes('x'), {
      access: 'private',
      contentType: 'application/pdf',
    });
    expect(res.url).toBeUndefined();
  });

  it('treats NoSuchKey as missing and rethrows other errors', async () => {
    const missing = make(
      vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NoSuchKey' })),
    );
    expect(await missing.get('k', { access: 'private' })).toBeNull();
    const broken = make(vi.fn().mockRejectedValue(new Error('boom')));
    await expect(broken.get('k', { access: 'private' })).rejects.toThrow('boom');
  });

  it('is unconfigured without credentials', () => {
    const driver = new S3CompatibleStorageDriver({
      name: 's3',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
    });
    expect(driver.isConfigured()).toBe(false);
  });
});

describe('cloudinary deleteRef', () => {
  it('posts a signed destroy request for the authenticated asset', async () => {
    const saved = { ...process.env };
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      process.env.CLOUDINARY_CLOUD_NAME = 'demo';
      process.env.CLOUDINARY_API_KEY = 'key';
      process.env.CLOUDINARY_API_SECRET = 'secret';
      if (cloudinaryDriver.mode !== 'direct') throw new Error('expected direct');
      await cloudinaryDriver.deleteRef('cldp:image/profile/u1/file.pdf');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy');
      const body = new URLSearchParams(String(init.body));
      expect(body.get('public_id')).toBe('profile/u1/file');
      expect(body.get('type')).toBe('authenticated');
      expect(body.get('signature')).toMatch(/^[0-9a-f]{40}$/);
      expect(String(init.body)).not.toContain('secret');
    } finally {
      vi.unstubAllGlobals();
      process.env = saved;
    }
  });
});

describe('getStorage and file helpers (local provider)', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proplity-files-'));
    vi.stubEnv('STORAGE_PROVIDER', 'local');
    vi.stubEnv('LOCAL_STORAGE_PATH', dir);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('selects providers by name and rejects unknown or production-local', async () => {
    const { getStorage } = await import('../../lib/storage');
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
      vi.stubEnv('STORAGE_PROVIDER', name);
      expect(getStorage().name).toBe(expected);
    }
    vi.stubEnv('STORAGE_PROVIDER', 's4');
    expect(() => getStorage()).toThrow(/Unknown STORAGE_PROVIDER/);
    vi.stubEnv('STORAGE_PROVIDER', 'local');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getStorage()).toThrow(/development only/);
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('stores private and public uploads under owner folders and serves them back', async () => {
    const { storeUpload, readPrivateFile, readPublicFile, deleteStoredFile } =
      await import('../../lib/storage/files');
    const priv = await storeUpload({
      folder: 'profile',
      userId: 'u-1',
      fileName: 'My ID.pdf',
      contentType: 'application/pdf',
      data: bytes('%PDF'),
    });
    expect(priv.url.startsWith('stor:private:profile/u-1/')).toBe(true);
    expect(privateRefOwnerId(priv.url)).toBe('u-1');
    expect(await text((await readPrivateFile(priv.url))!.stream)).toBe('%PDF');

    const pub = await storeUpload({
      folder: 'properties',
      userId: 'u-1',
      fileName: 'house.png',
      contentType: 'image/png',
      data: bytes('png'),
    });
    expect(pub.url.startsWith('/api/v1/uploads/public?key=properties%2Fu-1%2F')).toBe(true);
    const publicKey = decodeURIComponent(pub.url.split('key=')[1]);
    expect(await text((await readPublicFile(publicKey))!.stream)).toBe('png');

    // The public reader cannot reach a private file, even with its key.
    const privateKey = priv.url.replace('stor:private:', '');
    expect(await readPublicFile(privateKey)).toBeNull();

    await deleteStoredFile(priv.url);
    expect(await readPrivateFile(priv.url)).toBeNull();
    await expect(deleteStoredFile('not-a-ref')).resolves.toBeUndefined();
  });
});
