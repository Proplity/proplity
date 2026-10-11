import 'server-only';
import crypto from 'crypto';
import { parsePrivateRef } from './privateRef';

// Whether real file uploads are configured. Checked server-side (this file)
// before signing, and mirrored client-side by
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME so the UI can show "not available"
// instead of a broken upload button, rather than the server silently
// refusing every attempt.
export function cloudinaryEnabled(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

// Cloudinary's signed-upload scheme: every param that will be sent to
// /upload (other than file/api_key/signature itself) gets alphabetized,
// joined as "key=value&key=value", and SHA-1'd with the API secret appended
// -- never sent over the wire. The browser then uploads the file directly
// to Cloudinary with this signature, so the file itself never touches our
// server. See https://cloudinary.com/documentation/signatures
export function signUploadParams(params: Record<string, string | number>) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new Error('CLOUDINARY_API_SECRET is not configured');
  }

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const signature = crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');

  return signature;
}

// ── Private (authenticated) assets ──────────────────────────────────────────
//
// Identity documents and rental-application files must not be reachable by
// anyone who merely holds a URL. Uploads to these folders are made with
// Cloudinary `type=authenticated`, which makes the plain delivery URL
// useless; the app stores an opaque reference instead and hands out a
// short-lived signed download link only to people allowed to see the file
// (GET /api/v1/uploads/private). See ISS-031.
/** Signed, expiring Cloudinary download URL for an authenticated asset. */
export function privateDownloadUrl(ref: string, ttlSeconds = 300): string | null {
  const parsed = parsePrivateRef(ref);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!parsed || !cloudName || !apiKey) return null;

  const params: Record<string, string | number> = {
    public_id: parsed.publicId,
    type: 'authenticated',
    timestamp: Math.round(Date.now() / 1000),
    expires_at: Math.round(Date.now() / 1000) + ttlSeconds,
    attachment: 'true',
  };
  if (parsed.format) params.format = parsed.format;

  const signature = signUploadParams(params);
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: apiKey,
    signature,
  });
  return `https://api.cloudinary.com/v1_1/${cloudName}/${parsed.resourceType}/download?${query}`;
}
