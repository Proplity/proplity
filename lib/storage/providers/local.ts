import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { FileLocator, StorageDriver, StorageGetResult } from '../types';
import { cleanFileName } from '../keys';

/** Disk storage for development only (refused in production by getStorage()). */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  readonly upload = 'proxy' as const;
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath =
      basePath || process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), '.local-storage');
  }

  isConfigured(): boolean {
    return true;
  }

  makeKey = ({
    access,
    folder,
    ownerId,
    fileId,
    fileName,
  }: Parameters<StorageDriver['makeKey']>[0]) =>
    `${access}/${folder}/${ownerId}/${fileId}-${cleanFileName(fileName)}`;

  private resolve(key: string): string {
    const root = path.resolve(this.basePath);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw new Error('Invalid path: directory traversal detected');
    }
    return target;
  }

  async put(loc: FileLocator, data: Uint8Array, contentType: string): Promise<void> {
    const target = this.resolve(loc.key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, data);
    await fs.promises.writeFile(
      `${target}.meta.json`,
      JSON.stringify({ contentType, size: data.byteLength }),
      'utf-8',
    );
  }

  async read(loc: FileLocator): Promise<StorageGetResult | null> {
    const target = this.resolve(loc.key);
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

  async remove(loc: FileLocator): Promise<void> {
    const target = this.resolve(loc.key);
    await fs.promises.rm(target, { force: true });
    await fs.promises.rm(`${target}.meta.json`, { force: true });
  }
}
