import 'server-only';
import { get, put, del } from '@vercel/blob';
import type { FileLocator, StorageDriver, StorageGetResult } from '../types';
import { cleanFileName } from '../keys';

export class VercelBlobStorageDriver implements StorageDriver {
  readonly name = 'vercel-blob';
  readonly upload = 'proxy' as const;

  isConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  private token(): string {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error('STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN is not set');
    return token;
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
    await put(loc.key, Buffer.from(data), {
      access: loc.access,
      token: this.token(),
      contentType,
      addRandomSuffix: false,
    });
  }

  async read(loc: FileLocator): Promise<StorageGetResult | null> {
    try {
      const result = await get(loc.key, { access: loc.access, token: this.token() });
      if (!result || result.statusCode !== 200) return null;
      return {
        stream: result.stream,
        contentType: result.blob.contentType,
        size: result.blob.size,
      };
    } catch {
      return null;
    }
  }

  async remove(loc: FileLocator): Promise<void> {
    await del(loc.key, { token: this.token() });
  }
}
