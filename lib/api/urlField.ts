import { z } from 'zod';
import { parseFileUrl } from '@/lib/fileRef';

// A URL field that the app later renders as a link, image or video (ISS-033).
// Accepts what the product actually stores and nothing that can run code:
//   - an uploaded file's gateway URL (/api/v1/files/<id>)
//   - a site-relative path (/images/..., not // and no backslashes)
//   - an https:// URL (a public CDN such as Cloudinary)
// Rejects javascript:, data:, http:, vbscript:, protocol-relative and
// anything else, so a stored value can never become a script link.
export function isSafeUrl(value: string): boolean {
  if (value.length > 2048) return false;
  if (parseFileUrl(value)) return true;
  if (value.startsWith('/')) {
    return !value.startsWith('//') && !value.includes('\\') && !/[\u0000-\u001f]/.test(value);
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname;
  } catch {
    return false;
  }
}

export const safeUrl = z.string().refine(isSafeUrl, {
  message: 'Must be an uploaded file, a site path, or an https:// link',
});

export const safeUrlList = z.array(safeUrl).max(50);

// The profile form lets someone who has not uploaded a scan type a file name
// instead; that is stored in the same field. A plain name has no scheme, no
// slash and no backslash, so it can never be mistaken for a script link.
export const safeUrlOrName = z
  .string()
  .refine((v) => isSafeUrl(v) || /^[^:/\\\u0000-\u001f]{1,255}$/.test(v), {
    message: 'Must be an uploaded file, an https:// link, or a plain file name',
  });
