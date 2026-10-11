import {
  cloudinaryEnabled,
  isPrivateFolder,
  privateDownloadUrl,
  signUploadParams,
} from '@/lib/cloudinary';
import { privateFolderFor } from '@/lib/privateRef';
import type { StorageDriver } from './types';

export const cloudinaryDriver: StorageDriver = {
  name: 'cloudinary',
  isConfigured: cloudinaryEnabled,
  signUpload(folder, userId) {
    const timestamp = Math.round(Date.now() / 1000);
    // Private folders are namespaced by owner so a reference proves who it
    // belongs to without a database lookup (ISS-034).
    const target = isPrivateFolder(folder) ? privateFolderFor(folder, userId) : folder;
    const type = isPrivateFolder(folder) ? ('authenticated' as const) : undefined;
    const signature = signUploadParams({ folder: target, timestamp, ...(type ? { type } : {}) });
    return {
      provider: 'cloudinary',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
      apiKey: process.env.CLOUDINARY_API_KEY as string,
      timestamp,
      signature,
      folder: target,
      ...(type ? { type } : {}),
    };
  },
  privateDownloadUrl,
};
