import { Role } from '@prisma/client';
import type { UploadFolder } from './privateRef';

// Who may upload into each folder (ISS-032). A tenant cannot write into the
// property-listing folder, a vendor cannot write into identity documents, etc.
export const FOLDER_ROLES: Record<UploadFolder, Role[]> = {
  'maintenance-requests': [Role.TENANT, Role.MANAGER, Role.LANDLORD, Role.VENDOR],
  applications: [Role.TENANT],
  profile: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR],
  properties: [Role.LANDLORD, Role.MANAGER, Role.ADMIN],
};

export const UPLOAD_FOLDERS = Object.keys(FOLDER_ROLES) as [UploadFolder, ...UploadFolder[]];

/**
 * Limits for providers where the file passes through our server (everything
 * except Cloudinary's direct upload). Vercel functions reject request bodies
 * over ~4.5 MB, so the default stays below that.
 */
export const MAX_PROXY_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 4_000_000;

export const ALLOWED_PROXY_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;
