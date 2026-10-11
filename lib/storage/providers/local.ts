import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type {
  ProxyStorageDriver,
  StorageAccess,
  StorageGetResult,
  StoragePutOptions,
  StoragePutResult,
} from '../types';

/** Disk storage for development only (refused in production by getStorage()). */
export class LocalStorageDriver implements ProxyStorageDriver {
  readonly name = 'local';
  readonly mode = 'proxy' as const;
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath =
      basePath || process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), '.local-storage');
  }

  isConfigured(): boolean {
    return true;
  }

  // Keys arrive already namespaced (`private/…` / `public/…`, see
  // lib/storage/files.ts), so the access flag needs no directory of its own.
  private resolveSafePath(key: string): string {
    const root = path.resolve(this.basePath);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw new Error('Invalid path: directory traversal detected');
    }
    return target;
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | ReadableStream<Uint8Array>,
    options: StoragePutOptions,
  ): Promise<StoragePutResult> {
    const target = this.resolveSafePath(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });

    let size: number;
    if (data instanceof Uint8Array) {
      await fs.promises.writeFile(target, data as unknown as Uint8Array);
      size = data.byteLength;
    } else {
      const node = Readable.fromWeb(data as import('node:stream/web').ReadableStream);
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(target);
        node
          .pipe(out)
          .on('finish', () => resolve())
          .on('error', reject);
        node.on('error', reject);
      });
      size = (await fs.promises.stat(target)).size;
    }

    await fs.promises.writeFile(
      `${target}.meta.json`,
      JSON.stringify({ contentType: options.contentType, size }),
      'utf-8',
    );
    return { pathname: key, contentType: options.contentType, size };
  }

  async get(key: string, _options: { access: StorageAccess }): Promise<StorageGetResult | null> {
    const target = this.resolveSafePath(key);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(target);
    } catch {
      return null;
    }
    let contentType = 'application/octet-stream';
    try {
      const meta = JSON.parse(await fs.promises.readFile(`${target}.meta.json`, 'utf-8'));
      if (typeof meta?.contentType === 'string') contentType = meta.contentType;
    } catch {
      // no metadata: serve as opaque bytes
    }
    return {
      stream: Readable.toWeb(fs.createReadStream(target)) as ReadableStream<Uint8Array>,
      contentType,
      size: stat.size,
    };
  }

  async delete(key: string, _options?: { access: StorageAccess }): Promise<void> {
    const target = this.resolveSafePath(key);
    await fs.promises.rm(target, { force: true });
    await fs.promises.rm(`${target}.meta.json`, { force: true });
  }
}
