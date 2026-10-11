import 'server-only';
import crypto from 'node:crypto';
import { cloudinaryEnabled, signUploadParams } from '@/lib/cloudinary';
import type { StorageDriver } from '../types';

const IMAGE_FORMATS = 'jpg,jpeg,png,webp,gif,pdf';
const VIDEO_FORMATS = 'mp4,mov,webm';
const RESOURCE_TYPES = ['image', 'video', 'raw'];

function cloud() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    secret: process.env.CLOUDINARY_API_SECRET || '',
  };
}

function sign(params: Record<string, string | number>): string {
  const { secret } = cloud();
  return crypto
    .createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&') + secret,
    )
    .digest('hex');
}

/**
 * Cloudinary: the browser uploads directly. The server fixes the public_id
 * and allowed formats inside the signature, so the client cannot choose where
 * the file lands or what type it is. Private files are `authenticated`
 * assets and are read through the API download URL (signed, expiring).
 */
export const cloudinaryDriver: StorageDriver = {
  name: 'cloudinary',
  upload: 'direct',
  isConfigured: cloudinaryEnabled,

  // The public_id is the key; Cloudinary adds the extension on delivery.
  makeKey: ({ folder, ownerId, fileId }) => `${folder}/${ownerId}/${fileId}`,

  prepareDirectUpload({ key, access, folder }) {
    const timestamp = Math.round(Date.now() / 1000);
    const params: Record<string, string | number> = {
      allowed_formats:
        folder === 'properties' ? `${IMAGE_FORMATS},${VIDEO_FORMATS}` : IMAGE_FORMATS,
      public_id: key,
      timestamp,
      type: access === 'private' ? 'authenticated' : 'upload',
    };
    return {
      kind: 'form-post',
      url: `https://api.cloudinary.com/v1_1/${cloud().cloudName}/auto/upload`,
      fields: {
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        api_key: cloud().apiKey,
        signature: signUploadParams(params),
      },
    };
  },

  // Cloudinary's upload response is the source of truth for resource type and
  // format; the browser relays it. We only accept values we could have asked for.
  verifyUpload(_loc, claimed) {
    const resourceType = String(claimed.resource_type ?? '');
    const format = String(claimed.format ?? '').toLowerCase();
    const allowed = `${IMAGE_FORMATS},${VIDEO_FORMATS}`.split(',');
    if (!RESOURCE_TYPES.includes(resourceType) || !allowed.includes(format)) return null;
    return {
      size: typeof claimed.bytes === 'number' ? claimed.bytes : undefined,
      meta: { resourceType, format },
    };
  },

  signedUrl(loc, { ttlSeconds }) {
    const { cloudName, apiKey } = cloud();
    const resourceType = String(loc.meta?.resourceType ?? 'image');
    const format = loc.meta?.format ? String(loc.meta.format) : undefined;
    if (!cloudName || !apiKey) return null;

    if (loc.access === 'public') {
      return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${loc.key}${format ? `.${format}` : ''}`;
    }
    const now = Math.round(Date.now() / 1000);
    const params: Record<string, string | number> = {
      attachment: 'false',
      expires_at: now + ttlSeconds,
      public_id: loc.key,
      timestamp: now,
      type: 'authenticated',
      ...(format ? { format } : {}),
    };
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: apiKey,
      signature: sign(params),
    });
    return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download?${query}`;
  },

  /** Destroy the asset (best effort: callers must not fail on this). */
  async remove(loc) {
    const { cloudName, apiKey } = cloud();
    if (!cloudName || !apiKey) return;
    const params: Record<string, string | number> = {
      public_id: loc.key,
      timestamp: Math.round(Date.now() / 1000),
      type: loc.access === 'private' ? 'authenticated' : 'upload',
    };
    const form = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: apiKey,
      signature: sign(params),
    });
    await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${String(loc.meta?.resourceType ?? 'image')}/destroy`,
      { method: 'POST', body: form },
    );
  },
};
