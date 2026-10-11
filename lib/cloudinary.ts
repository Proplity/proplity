import 'server-only';
import crypto from 'crypto';

// Whether Cloudinary is configured. Mirrored client-side by
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME so the UI can show "not available"
// instead of a broken upload button.
export function cloudinaryEnabled(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

// Cloudinary's signed-upload scheme: every param sent to /upload (other than
// file/api_key/signature itself) is alphabetised, joined as
// "key=value&key=value", and SHA-1'd with the API secret appended -- the
// secret never goes over the wire. See https://cloudinary.com/documentation/signatures
export function signUploadParams(params: Record<string, string | number>) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) throw new Error('CLOUDINARY_API_SECRET is not configured');
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}
