import type { StorageDriver } from './types';
import { cloudinaryDriver } from './cloudinary';

export type { StorageDriver, SignedUpload } from './types';

const DRIVERS: Record<string, StorageDriver> = {
  cloudinary: cloudinaryDriver,
};

/**
 * The active storage provider, chosen by STORAGE_PROVIDER (default
 * "cloudinary"). An unknown name is a configuration error and throws rather
 * than silently falling back to a provider the operator didn't pick.
 */
export function getStorage(): StorageDriver {
  const name = (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase();
  const driver = DRIVERS[name];
  if (!driver) {
    throw new Error(
      `Unknown STORAGE_PROVIDER "${name}". Available: ${Object.keys(DRIVERS).join(', ')}`,
    );
  }
  return driver;
}
