import 'server-only';
import crypto from 'node:crypto';
import type { FileLocator, StorageDriver, StorageGetResult } from '../types';
import { cleanFileName } from '../keys';

/**
 * ImageKit via its REST API. NOT yet verified against a real ImageKit
 * account: the signed private-URL scheme (HMAC-SHA1 over URL + expiry) is
 * written from the documentation and must be tried once before relying on it.
 */
export class ImageKitStorageDriver implements StorageDriver {
  readonly name = 'imagekit';
  readonly upload = 'proxy' as const;

  private cfg() {
    return {
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
      urlEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/+$/, ''),
    };
  }

  isConfigured(): boolean {
    const c = this.cfg();
    return Boolean(c.privateKey && c.publicKey && c.urlEndpoint);
  }

  private auth(): string {
    return `Basic ${Buffer.from(`${this.cfg().privateKey}:`).toString('base64')}`;
  }

  makeKey = ({
    access,
    folder,
    ownerId,
    fileId,
    fileName,
  }: Parameters<StorageDriver['makeKey']>[0]) =>
    `${access}/${folder}/${ownerId}/${fileId}-${cleanFileName(fileName)}`;

  async put(loc: FileLocator, data: Uint8Array, contentType: string): Promise<void> {
    if (!this.isConfigured())
      throw new Error('STORAGE_NOT_CONFIGURED: ImageKit credentials missing');
    const slash = loc.key.lastIndexOf('/');
    const fileName = loc.key.slice(slash + 1);
    const form = new FormData();
    form.append('file', new Blob([data as unknown as BlobPart], { type: contentType }), fileName);
    form.append('fileName', fileName);
    form.append('folder', `/${loc.key.slice(0, slash)}`);
    form.append('useUniqueFileName', 'false');
    form.append('isPrivateFile', loc.access === 'private' ? 'true' : 'false');
    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: this.auth() },
      body: form,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`ImageKit upload failed: ${body.message || res.statusText}`);
    }
  }

  async read(loc: FileLocator): Promise<StorageGetResult | null> {
    if (!this.isConfigured())
      throw new Error('STORAGE_NOT_CONFIGURED: ImageKit credentials missing');
    const { urlEndpoint, privateKey } = this.cfg();
    let url = `${urlEndpoint}/${loc.key}`;
    if (loc.access === 'private') {
      const expire = Math.floor(Date.now() / 1000) + 300;
      const signature = crypto
        .createHmac('sha1', privateKey)
        .update(url + expire)
        .digest('hex');
      url += `?ik-s=${signature}&ik-t=${expire}`;
    }
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) return null;
      return {
        stream: res.body as ReadableStream<Uint8Array>,
        contentType: res.headers.get('content-type') || 'application/octet-stream',
        size: Number(res.headers.get('content-length')) || 0,
      };
    } catch {
      return null;
    }
  }

  async remove(loc: FileLocator): Promise<void> {
    if (!this.isConfigured()) return;
    await fetch('https://api.imagekit.io/v1/files/batch/deleteByFilePaths', {
      method: 'POST',
      headers: { Authorization: this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePaths: [`/${loc.key}`] }),
    });
  }
}
