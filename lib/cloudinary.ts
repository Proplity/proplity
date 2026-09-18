import crypto from 'crypto';

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
