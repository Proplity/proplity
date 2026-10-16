import { Role } from '@prisma/client';
import type { UploadFolder } from './fileRef';

// Who may upload into each folder (ISS-032). A tenant cannot write into the
// property-listing folder, a vendor cannot write into identity documents, etc.
export const FOLDER_ROLES: Record<UploadFolder, Role[]> = {
  'maintenance-requests': [Role.TENANT, Role.MANAGER, Role.LANDLORD, Role.VENDOR],
  applications: [Role.TENANT],
  profile: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR],
  properties: [Role.LANDLORD, Role.MANAGER, Role.ADMIN],
  notices: [Role.LANDLORD, Role.MANAGER, Role.ADMIN],
  leases: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.ADMIN],
  communications: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR, Role.ADMIN],
  reconciliation: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.ADMIN],
};

export const UPLOAD_FOLDERS = Object.keys(FOLDER_ROLES) as [UploadFolder, ...UploadFolder[]];

export const IMAGE_AND_PDF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'] as const;
export const DOCUMENT_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
] as const;

/** Property listings allow video walkthroughs; communications allow media & documents. */
export function allowedTypes(folder: UploadFolder): readonly string[] {
  if (folder === 'properties') return [...IMAGE_AND_PDF_TYPES, ...VIDEO_TYPES];
  if (folder === 'communications') {
    return [...IMAGE_AND_PDF_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES, ...DOCUMENT_TYPES];
  }
  return IMAGE_AND_PDF_TYPES;
}

/**
 * Size limits. Providers that receive the file themselves (direct) allow
 * more; those where the bytes pass through our server are capped below the
 * ~4.5 MB request-body limit Vercel enforces.
 */
export const MAX_PROXY_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 4_000_000;
export const MAX_DIRECT_IMAGE_BYTES = 15_000_000;
export const MAX_DIRECT_VIDEO_BYTES = 200_000_000;

export function maxBytes(contentType: string, mode: 'direct' | 'proxy'): number {
  if (mode === 'proxy') return MAX_PROXY_UPLOAD_BYTES;
  return contentType.startsWith('video/') ? MAX_DIRECT_VIDEO_BYTES : MAX_DIRECT_IMAGE_BYTES;
}

/** Types safe to render inline; anything else is served as a download. */
export function isInlineSafe(contentType: string): boolean {
  return (
    (IMAGE_AND_PDF_TYPES as readonly string[]).includes(contentType) ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    (contentType.startsWith('text/') && contentType !== 'text/html')
  );
}
