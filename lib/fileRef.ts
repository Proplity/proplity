// Client-safe (no Node crypto, no server-only) description of uploaded files.
// Server-side storage lives in lib/storage/.

export type UploadFolder = 'maintenance-requests' | 'applications' | 'profile' | 'properties';
export type StorageAccess = 'private' | 'public';

/**
 * Whether a folder's files may be read by anyone with the link or only
 * through an authorised gateway request. One explicit table, so a new
 * folder has to choose (ISS-031).
 */
export const FOLDER_ACCESS: Record<UploadFolder, StorageAccess> = {
  'maintenance-requests': 'private',
  applications: 'private',
  profile: 'private',
  properties: 'public',
};

export function accessForFolder(folder: UploadFolder): StorageAccess {
  return FOLDER_ACCESS[folder];
}

const FILE_URL_PREFIX = '/api/v1/files/';
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const FILE_URL_RE = new RegExp(`^${FILE_URL_PREFIX}(${UUID})$`);

/** The stable URL stored in model fields for an uploaded file. */
export function fileUrl(id: string): string {
  return `${FILE_URL_PREFIX}${id}`;
}

/** The StoredFile id inside a gateway URL, or null for any other string. */
export function parseFileUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return FILE_URL_RE.exec(value)?.[1]?.toLowerCase() ?? null;
}
