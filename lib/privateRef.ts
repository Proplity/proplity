// Client-safe (no Node crypto, no server-only) helpers for file references.
// Server-side signing and storage live in lib/cloudinary.ts and lib/storage/.

export type UploadFolder = 'maintenance-requests' | 'applications' | 'profile' | 'properties';
export type StorageAccess = 'private' | 'public';

/**
 * Whether a folder's files may be read by anyone with the link or only
 * through the authenticated gateway. One explicit table, so a new folder has
 * to choose (ISS-031).
 */
export const FOLDER_ACCESS: Record<UploadFolder, StorageAccess> = {
  'maintenance-requests': 'public',
  applications: 'private',
  profile: 'private',
  properties: 'public',
};

export function accessForFolder(folder: UploadFolder): StorageAccess {
  return FOLDER_ACCESS[folder];
}

export const PRIVATE_FOLDERS = (Object.keys(FOLDER_ACCESS) as UploadFolder[]).filter(
  (f) => FOLDER_ACCESS[f] === 'private',
);

export function isPrivateFolder(folder: string): boolean {
  return (PRIVATE_FOLDERS as string[]).includes(folder);
}

const CLOUDINARY_PREFIX = 'cldp:';
const STORED_PREFIX = 'stor:private:';

// ── Cloudinary authenticated assets ─────────────────────────────────────────

/** `cldp:<resource_type>/<public_id>[.<format>]` -- what gets stored in the DB. */
export function makePrivateRef(resourceType: string, publicId: string, format?: string): string {
  return `${CLOUDINARY_PREFIX}${resourceType}/${publicId}${format ? `.${format}` : ''}`;
}

export function isCloudinaryRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(CLOUDINARY_PREFIX);
}

export function parsePrivateRef(
  ref: string,
): { resourceType: string; publicId: string; format?: string } | null {
  if (!isCloudinaryRef(ref)) return null;
  const rest = ref.slice(CLOUDINARY_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const resourceType = rest.slice(0, slash);
  if (!['image', 'video', 'raw'].includes(resourceType)) return null;
  const path = rest.slice(slash + 1);
  if (!path || path.includes('..')) return null;
  // Images/videos are addressed by public_id + format; raw files keep the
  // extension inside the public_id.
  const dot = path.lastIndexOf('.');
  if (resourceType !== 'raw' && dot > 0 && dot > path.lastIndexOf('/')) {
    return { resourceType, publicId: path.slice(0, dot), format: path.slice(dot + 1) };
  }
  return { resourceType, publicId: path };
}

// ── Key-addressed private files (S3, R2, MinIO, Supabase, ImageKit, Blob, local) ──

/** `stor:private:<key>` where key is `<folder>/<ownerId>/<file>`. */
export function makeStoredRef(key: string): string {
  return `${STORED_PREFIX}${key}`;
}

export function isStoredRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(STORED_PREFIX);
}

export function parseStoredRef(ref: string): { key: string } | null {
  if (!isStoredRef(ref)) return null;
  const key = ref.slice(STORED_PREFIX.length);
  return isSafeKey(key) ? { key } : null;
}

/** No traversal, no absolute paths, no backslashes, no empty segments. */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 512 &&
    !key.startsWith('/') &&
    !key.includes('\\') &&
    !key.includes('\0') &&
    key.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
  );
}

// ── Common ──────────────────────────────────────────────────────────────────

/** Any reference we issued for a private file, whichever provider holds it. */
export function isPrivateRef(value: string | null | undefined): value is string {
  return isCloudinaryRef(value) || isStoredRef(value);
}

/** Folder that holds one user's files: `profile/<userId>`. */
export function privateFolderFor(folder: string, userId: string): string {
  return `${folder}/${userId}`;
}

/**
 * The user id a private reference was uploaded for (`<folder>/<ownerId>/<file>`),
 * or null for refs not in that shape.
 */
export function privateRefOwnerId(ref: string): string | null {
  const path = isStoredRef(ref) ? parseStoredRef(ref)?.key : parsePrivateRef(ref)?.publicId;
  if (!path) return null;
  const [folder, owner, ...file] = path.split('/');
  return folder && isPrivateFolder(folder) && owner && file.length > 0 ? owner : null;
}
