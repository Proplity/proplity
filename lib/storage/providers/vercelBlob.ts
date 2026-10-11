import 'server-only';
import { get, put, del } from '@vercel/blob';
import type {
  ProxyStorageDriver,
  StorageAccess,
  StorageGetResult,
  StoragePutOptions,
  StoragePutResult,
} from '../types';

export class VercelBlobStorageDriver implements ProxyStorageDriver {
  readonly name = 'vercel-blob';
  readonly mode = 'proxy' as const;

  isConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  private token(): string {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error('STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN is not set');
    return token;
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | ReadableStream<Uint8Array>,
    options: StoragePutOptions,
  ): Promise<StoragePutResult> {
    const blob = await put(key, data instanceof Uint8Array ? Buffer.from(data) : data, {
      access: options.access,
      token: this.token(),
      contentType: options.contentType,
      addRandomSuffix: false,
    });
    return {
      pathname: blob.pathname,
      contentType: options.contentType,
      size: data instanceof Uint8Array ? data.byteLength : 0,
      url: options.access === 'public' ? blob.url : undefined,
    };
  }

  async get(key: string, options: { access: StorageAccess }): Promise<StorageGetResult | null> {
    try {
      const result = await get(key, { access: options.access, token: this.token() });
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

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token() });
  }
}
