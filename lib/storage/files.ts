import 'server-only';
import crypto from 'node:crypto';
import {
  accessForFolder,
  isCloudinaryRef,
  isSafeKey,
  isStoredRef,
  makeStoredRef,
  parseStoredRef,
  privateFolderFor,
  type StorageAccess,
  type UploadFolder,
} from '@/lib/privateRef';
import { getStorage } from './index';
import type { ProxyStorageDriver, StorageGetResult } from './types';

/** Public URL prefix served by GET /api/v1/uploads/public for proxy providers. */
export const PUBLIC_FILE_PATH = '/api/v1/uploads/public';

/** Drivers see `private/…` / `public/…` keys, so access can never be confused. */
const physical = (access: StorageAccess, key: string) => `${access}/${key}`;

function proxyDriver(): ProxyStorageDriver {
  const driver = getStorage();
  if (driver.mode !== 'proxy') throw new Error(`${driver.name} uploads directly from the browser`);
  return driver;
}

function cleanName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .toLowerCase();
  return base.slice(-80) || 'file';
}

export interface StoredUpload {
  /** `stor:private:<key>` for private folders, a public URL otherwise. */
  url: string;
  name: string;
}

/** Store one uploaded file for `userId` in `folder` through the active proxy driver. */
export async function storeUpload(args: {
  folder: UploadFolder;
  userId: string;
  fileName: string;
  contentType: string;
  data: Uint8Array;
}): Promise<StoredUpload> {
  const driver = proxyDriver();
  const access = accessForFolder(args.folder);
  const key = `${privateFolderFor(args.folder, args.userId)}/${Date.now()}-${crypto
    .randomBytes(6)
    .toString('hex')}-${cleanName(args.fileName)}`;

  const result = await driver.put(physical(access, key), args.data, {
    access,
    contentType: args.contentType,
  });

  if (access === 'private') return { url: makeStoredRef(key), name: args.fileName };
  return {
    url: result.url ?? `${PUBLIC_FILE_PATH}?key=${encodeURIComponent(key)}`,
    name: args.fileName,
  };
}

/** Stream a public file by its logical key (never reaches `private/…`). */
export async function readPublicFile(key: string): Promise<StorageGetResult | null> {
  if (!isSafeKey(key)) return null;
  return proxyDriver().get(physical('public', key), { access: 'public' });
}

/** Stream a private file by its `stor:private:` reference (authorise first). */
export async function readPrivateFile(ref: string): Promise<StorageGetResult | null> {
  const parsed = parseStoredRef(ref);
  if (!parsed) return null;
  return proxyDriver().get(physical('private', parsed.key), { access: 'private' });
}

/** Best-effort removal of whatever a stored reference points at. Never throws. */
export async function deleteStoredFile(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try {
    const driver = getStorage();
    if (isCloudinaryRef(ref) && driver.mode === 'direct') {
      await driver.deleteRef(ref);
    } else if (isStoredRef(ref) && driver.mode === 'proxy') {
      const parsed = parseStoredRef(ref);
      if (parsed) await driver.delete(physical('private', parsed.key), { access: 'private' });
    }
  } catch (err) {
    console.error('Could not delete stored file', err);
  }
}
