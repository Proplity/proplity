import 'server-only';
import type { StorageDriver, StorageProviderName } from './types';
import { cloudinaryDriver } from './providers/cloudinary';
import { LocalStorageDriver } from './providers/local';
import { VercelBlobStorageDriver } from './providers/vercelBlob';
import { ImageKitStorageDriver } from './providers/imagekit';
import {
  createS3Driver,
  createR2Driver,
  createMinioDriver,
  createSupabaseDriver,
} from './providers/s3';

export * from './types';

const FACTORIES: Record<StorageProviderName, () => StorageDriver> = {
  cloudinary: () => cloudinaryDriver,
  s3: () => createS3Driver(),
  r2: () => createR2Driver(),
  minio: () => createMinioDriver(),
  supabase: () => createSupabaseDriver(),
  imagekit: () => new ImageKitStorageDriver(),
  'vercel-blob': () => new VercelBlobStorageDriver(),
  local: () => new LocalStorageDriver(),
};

const cache = new Map<string, StorageDriver>();

/**
 * The active storage provider, chosen explicitly by STORAGE_PROVIDER
 * (default "cloudinary"). There is deliberately no credential auto-detection
 * and no silent fallback: an unknown name, or "local" in production, throws.
 */
export function getStorage(): StorageDriver {
  return getStorageByName(process.env.STORAGE_PROVIDER || 'cloudinary');
}

/**
 * A specific provider by name. The gateway uses this to read a file from the
 * provider recorded on its StoredFile row, which may differ from the active
 * one after STORAGE_PROVIDER was changed.
 */
export function getStorageByName(rawName: string): StorageDriver {
  const name = rawName.toLowerCase() as StorageProviderName;
  const factory = FACTORIES[name];
  if (!factory) {
    throw new Error(
      `Unknown STORAGE_PROVIDER "${name}". Available: ${Object.keys(FACTORIES).join(', ')}`,
    );
  }
  if (name === 'local' && process.env.NODE_ENV === 'production') {
    throw new Error(
      'STORAGE_PROVIDER "local" is for development only and is refused in production',
    );
  }
  let driver = cache.get(name);
  if (!driver) {
    driver = factory();
    cache.set(name, driver);
  }
  return driver;
}
