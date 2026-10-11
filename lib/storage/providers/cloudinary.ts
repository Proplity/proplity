import 'server-only';
import crypto from 'node:crypto';
import { cloudinaryEnabled, privateDownloadUrl, signUploadParams } from '@/lib/cloudinary';
import { parsePrivateRef, privateFolderFor } from '@/lib/privateRef';
import type { DirectStorageDriver } from '../types';

/** Cloudinary: the browser uploads directly; private files are `authenticated` assets. */
export const cloudinaryDriver: DirectStorageDriver = {
  name: 'cloudinary',
  mode: 'direct',
  isConfigured: cloudinaryEnabled,

  signUpload(folder, userId, access) {
    const timestamp = Math.round(Date.now() / 1000);
    // Private folders are namespaced by owner so a reference proves who it
    // belongs to without a database lookup (ISS-034).
    const target = access === 'private' ? privateFolderFor(folder, userId) : folder;
    const type = access === 'private' ? ('authenticated' as const) : undefined;
    const signature = signUploadParams({ folder: target, timestamp, ...(type ? { type } : {}) });
    return {
      mode: 'direct',
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

  /** Destroy an authenticated asset. Best effort: callers must not fail on this. */
  async deleteRef(ref) {
    const parsed = parsePrivateRef(ref);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!parsed || !cloudName || !apiKey || !secret) return;

    const params: Record<string, string | number> = {
      public_id: parsed.publicId,
      type: 'authenticated',
      timestamp: Math.round(Date.now() / 1000),
    };
    const signature = crypto
      .createHash('sha1')
      .update(
        Object.keys(params)
          .sort()
          .map((k) => `${k}=${params[k]}`)
          .join('&') + secret,
      )
      .digest('hex');
    const form = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: apiKey,
      signature,
    });
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${parsed.resourceType}/destroy`, {
      method: 'POST',
      body: form,
    });
  },
};
