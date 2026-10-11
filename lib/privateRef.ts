// Client-safe (no Node crypto) helpers for private Cloudinary asset references.
// Server-only signing lives in lib/cloudinary.ts.

export const PRIVATE_FOLDERS = ['profile', 'applications'] as const;

export function isPrivateFolder(folder: string): boolean {
  return (PRIVATE_FOLDERS as readonly string[]).includes(folder);
}

const PRIVATE_REF_PREFIX = 'cldp:';

/** `cldp:<resource_type>/<public_id>[.<format>]` -- what gets stored in the DB. */
export function makePrivateRef(resourceType: string, publicId: string, format?: string): string {
  return `${PRIVATE_REF_PREFIX}${resourceType}/${publicId}${format ? `.${format}` : ''}`;
}

export function isPrivateRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(PRIVATE_REF_PREFIX);
}

export function parsePrivateRef(
  ref: string,
): { resourceType: string; publicId: string; format?: string } | null {
  if (!isPrivateRef(ref)) return null;
  const rest = ref.slice(PRIVATE_REF_PREFIX.length);
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
